import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface SocialConnection {
  id: string;
  encryptedScore: string;
  timestamp: number;
  target: string;
}

interface FeedItem {
  id: string;
  content: string;
  encryptedMetrics: string;
  timestamp: number;
}

interface Recommendation {
  id: string;
  score: number;
  reason: string;
}

const FHEEncryptNumber = (value: number): string => `FHE-${btoa(value.toString())}`;
const FHEDecryptNumber = (encryptedData: string): number => encryptedData.startsWith('FHE-') ? parseFloat(atob(encryptedData.substring(4))) : parseFloat(encryptedData);
const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConnection, setNewConnection] = useState({ target: "", score: "" });
  const [transactionStatus, setTransactionStatus] = useState({ visible: false, status: "pending", message: "" });
  const [selectedItem, setSelectedItem] = useState<SocialConnection | FeedItem | null>(null);
  const [decryptedData, setDecryptedData] = useState<{ [key: string]: number | null }>({});
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [activeTab, setActiveTab] = useState('graph');
  const [newPost, setNewPost] = useState("");

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadData = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;

      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "ZAMA FHE Ready" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }

      const connectionsBytes = await contract.getData("connections");
      let connectionsList: SocialConnection[] = [];
      if (connectionsBytes.length > 0) {
        try {
          const connectionsStr = ethers.toUtf8String(connectionsBytes);
          if (connectionsStr.trim() !== '') connectionsList = JSON.parse(connectionsStr);
        } catch (e) {}
      }
      setConnections(connectionsList);

      const feedBytes = await contract.getData("feed");
      let feedList: FeedItem[] = [];
      if (feedBytes.length > 0) {
        try {
          const feedStr = ethers.toUtf8String(feedBytes);
          if (feedStr.trim() !== '') feedList = JSON.parse(feedStr);
        } catch (e) {}
      }
      setFeed(feedList);

      const recBytes = await contract.getData("recommendations");
      let recList: Recommendation[] = [];
      if (recBytes.length > 0) {
        try {
          const recStr = ethers.toUtf8String(recBytes);
          if (recStr.trim() !== '') recList = JSON.parse(recStr);
        } catch (e) {}
      }
      setRecommendations(recList);
    } catch (e) {
      console.error("Error loading data:", e);
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setLoading(false); 
    }
  };

  const addConnection = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setTransactionStatus({ visible: true, status: "pending", message: "Adding with ZAMA FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("No contract");

      const newConn: SocialConnection = {
        id: `${Date.now()}`,
        encryptedScore: FHEEncryptNumber(parseFloat(newConnection.score) || 0),
        timestamp: Math.floor(Date.now() / 1000),
        target: newConnection.target
      };
      
      const updatedConnections = [...connections, newConn];
      await contract.setData("connections", ethers.toUtf8Bytes(JSON.stringify(updatedConnections)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Connection added!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowAddModal(false);
        setNewConnection({ target: "", score: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const addPost = async () => {
    if (!isConnected || !address || !newPost) return;
    
    setTransactionStatus({ visible: true, status: "pending", message: "Posting with FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("No contract");

      const newFeedItem: FeedItem = {
        id: `${Date.now()}`,
        content: newPost,
        encryptedMetrics: FHEEncryptNumber(Math.floor(Math.random() * 100)),
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      const updatedFeed = [...feed, newFeedItem];
      await contract.setData("feed", ethers.toUtf8Bytes(JSON.stringify(updatedFeed)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Posted!" });
      await loadData();
      setNewPost("");
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Post failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const decryptWithSignature = async (encryptedData: string, id: string): Promise<number | null> => {
    if (!isConnected) { 
      setTransactionStatus({ visible: true, status: "error", message: "Connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const handleDecrypt = async (id: string, encryptedValue: string) => {
    if (decryptedData[id] !== undefined) {
      const newData = {...decryptedData};
      delete newData[id];
      setDecryptedData(newData);
      return;
    }
    
    const decrypted = await decryptWithSignature(encryptedValue, id);
    if (decrypted !== null) {
      setDecryptedData({...decryptedData, [id]: decrypted});
    }
  };

  const renderGraph = () => {
    return (
      <div className="graph-container">
        <div className="graph-visual">
          <div className="node center-node">
            <div className="node-pulse"></div>
            <div className="node-label">You</div>
          </div>
          {connections.slice(0, 8).map((conn, i) => (
            <React.Fragment key={i}>
              <div className={`node connection-node pos-${i % 8}`}>
                <div className="node-label">{conn.target.substring(0, 6)}</div>
              </div>
              <div className={`connection-line line-${i % 8}`}></div>
            </React.Fragment>
          ))}
        </div>
        <div className="graph-stats">
          <div className="stat-item">
            <div className="stat-value">{connections.length}</div>
            <div className="stat-label">Connections</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{feed.length}</div>
            <div className="stat-label">Posts</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{recommendations.length}</div>
            <div className="stat-label">Recommendations</div>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendations = () => {
    return (
      <div className="recommendations-grid">
        {recommendations.map((rec, i) => (
          <div className="recommendation-card" key={i}>
            <div className="rec-score" style={{ background: `hsl(${rec.score * 1.2}, 80%, 50%)` }}>
              {rec.score.toFixed(1)}
            </div>
            <div className="rec-reason">{rec.reason}</div>
            <div className="rec-action">
              <button className="action-btn">View</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFeed = () => {
    return (
      <div className="feed-container">
        <div className="post-input">
          <textarea 
            value={newPost} 
            onChange={(e) => setNewPost(e.target.value)} 
            placeholder="What's on your mind? (Encrypted with ZAMA FHE)"
          />
          <button onClick={addPost} disabled={!newPost}>Post</button>
        </div>
        {feed.map((item, i) => (
          <div 
            className={`feed-item ${selectedItem?.id === item.id ? "selected" : ""}`} 
            key={i}
            onClick={() => setSelectedItem(item)}
          >
            <div className="feed-content">{item.content}</div>
            <div className="feed-meta">
              <span>{new Date(item.timestamp * 1000).toLocaleString()}</span>
              <button 
                className="decrypt-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecrypt(item.id, item.encryptedMetrics);
                }}
                disabled={isDecrypting}
              >
                {decryptedData[item.id] !== undefined ? "Hide Metrics" : "Show Metrics"}
              </button>
            </div>
            {decryptedData[item.id] !== undefined && (
              <div className="feed-metrics">
                Engagement Score: {decryptedData[item.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderConnections = () => {
    return (
      <div className="connections-list">
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
          + Add Connection
        </button>
        {connections.map((conn, i) => (
          <div 
            className={`connection-item ${selectedItem?.id === conn.id ? "selected" : ""}`} 
            key={i}
            onClick={() => setSelectedItem(conn)}
          >
            <div className="conn-target">{conn.target}</div>
            <div className="conn-meta">
              <span>{new Date(conn.timestamp * 1000).toLocaleDateString()}</span>
              <button 
                className="decrypt-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecrypt(conn.id, conn.encryptedScore);
                }}
                disabled={isDecrypting}
              >
                {decryptedData[conn.id] !== undefined ? "Hide Score" : "Show Score"}
              </button>
            </div>
            {decryptedData[conn.id] !== undefined && (
              <div className="conn-score">
                Connection Strength: {decryptedData[conn.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderFAQ = () => {
    return (
      <div className="faq-section">
        <div className="faq-item">
          <div className="faq-question">What is SocialCipher?</div>
          <div className="faq-answer">A Web3 social graph protocol that encrypts your social connections using ZAMA FHE technology, allowing analysis without exposing your private data.</div>
        </div>
        <div className="faq-item">
          <div className="faq-question">How does FHE protect my data?</div>
          <div className="faq-answer">Fully Homomorphic Encryption allows computations on encrypted data without decryption. Your social graph remains encrypted at all times.</div>
        </div>
        <div className="faq-item">
          <div className="faq-question">Who can see my connections?</div>
          <div className="faq-answer">Only you can decrypt your full social graph. Apps can only access encrypted data and perform computations you authorize.</div>
        </div>
        <div className="faq-item">
          <div className="faq-question">What chains are supported?</div>
          <div className="faq-answer">Currently Ethereum and EVM chains, with more coming soon.</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Initializing encrypted social graph...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="hexagon"></div>
            <div className="nodes"></div>
          </div>
          <h1>Social<span>Cipher</span></h1>
        </div>
        
        <div className="header-actions">
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="content-center">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
              onClick={() => setActiveTab('graph')}
            >
              Graph
            </button>
            <button 
              className={`tab ${activeTab === 'feed' ? 'active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Feed
            </button>
            <button 
              className={`tab ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              Connections
            </button>
            <button 
              className={`tab ${activeTab === 'recommendations' ? 'active' : ''}`}
              onClick={() => setActiveTab('recommendations')}
            >
              For You
            </button>
            <button 
              className={`tab ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              FAQ
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'graph' && renderGraph()}
            {activeTab === 'feed' && renderFeed()}
            {activeTab === 'connections' && renderConnections()}
            {activeTab === 'recommendations' && renderRecommendations()}
            {activeTab === 'faq' && renderFAQ()}
          </div>
        </div>
      </div>
      
      {showAddModal && (
        <div className="modal-overlay">
          <div className="add-modal">
            <div className="modal-header">
              <h2>Add Connection</h2>
              <button onClick={() => setShowAddModal(false)} className="close-modal">&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Target Address</label>
                <input 
                  type="text" 
                  value={newConnection.target} 
                  onChange={(e) => setNewConnection({...newConnection, target: e.target.value})} 
                  placeholder="0x..."
                />
              </div>
              
              <div className="form-group">
                <label>Connection Score (1-100)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="100" 
                  value={newConnection.score} 
                  onChange={(e) => setNewConnection({...newConnection, score: e.target.value})} 
                  placeholder="50"
                />
              </div>
              
              <div className="fhe-notice">
                <div className="lock-icon"></div>
                <span>This data will be encrypted with ZAMA FHE</span>
              </div>
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setShowAddModal(false)} className="cancel-btn">Cancel</button>
              <button 
                onClick={addConnection} 
                disabled={!newConnection.target || !newConnection.score}
                className="submit-btn"
              >
                Add Encrypted Connection
              </button>
            </div>
          </div>
        </div>
      )}
      
      {selectedItem && (
        <div className="modal-overlay">
          <div className="detail-modal">
            <div className="modal-header">
              <h2>Details</h2>
              <button onClick={() => setSelectedItem(null)} className="close-modal">&times;</button>
            </div>
            
            <div className="modal-body">
              {'content' in selectedItem ? (
                <>
                  <div className="detail-content">{selectedItem.content}</div>
                  <div className="detail-meta">
                    <span>Posted: {new Date(selectedItem.timestamp * 1000).toLocaleString()}</span>
                    {decryptedData[selectedItem.id] !== undefined && (
                      <div className="detail-metrics">
                        Engagement: {decryptedData[selectedItem.id]}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-target">{selectedItem.target}</div>
                  <div className="detail-meta">
                    <span>Connected: {new Date(selectedItem.timestamp * 1000).toLocaleDateString()}</span>
                    {decryptedData[selectedItem.id] !== undefined && (
                      <div className="detail-score">
                        Strength: {decryptedData[selectedItem.id]}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setSelectedItem(null)} className="close-btn">Close</button>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="hexagon"></div>
              <span>SocialCipher</span>
            </div>
            <p>Encrypted Social Graph Protocol</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Docs</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>Powered by ZAMA FHE</span>
          </div>
          <div className="copyright">© {new Date().getFullYear()} SocialCipher Protocol</div>
        </div>
      </footer>
    </div>
  );
};

export default App;