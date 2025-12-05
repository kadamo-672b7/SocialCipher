pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract SocialCipherFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error InvalidBatch();
    error InvalidArgument();
    error ReplayDetected();
    error StateMismatch();
    error ProofVerificationFailed();

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event CooldownSet(uint256 cooldownSeconds);
    event Paused(address account);
    event Unpaused(address account);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event ConnectionSubmitted(uint256 indexed batchId, address indexed userA, address indexed userB);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 commonFriends);

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }

    struct Connection {
        euint32 userAId;
        euint32 userBId;
    }

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;
    mapping(uint256 => Connection[]) public batchConnections;
    mapping(uint256 => mapping(address, euint32)) public userToEncryptedId; // batchId -> userAddress -> euint32
    mapping(uint256 => mapping(euint32, address)) public encryptedIdToUser; // batchId -> euint32 -> userAddress

    mapping(uint256 => DecryptionContext) public decryptionContexts;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    constructor() {
        owner = msg.sender;
        providers[owner] = true;
        emit ProviderAdded(owner);
        cooldownSeconds = 60; // Default cooldown
    }

    function addProvider(address _provider) external onlyOwner {
        providers[_provider] = true;
        emit ProviderAdded(_provider);
    }

    function removeProvider(address _provider) external onlyOwner {
        providers[_provider] = false;
        emit ProviderRemoved(_provider);
    }

    function setCooldown(uint256 _cooldownSeconds) external onlyOwner {
        if (_cooldownSeconds == 0) revert InvalidArgument();
        cooldownSeconds = _cooldownSeconds;
        emit CooldownSet(_cooldownSeconds);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        batchClosed[currentBatchId] = false;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        if (batchClosed[currentBatchId]) revert InvalidBatch();
        batchClosed[currentBatchId] = true;
        emit BatchClosed(currentBatchId);
    }

    function _initIfNeeded(uint256 _batchId, address _user, euint32 _encryptedId) private {
        if (!FHE.isInitialized(userToEncryptedId[_batchId][_user])) {
            userToEncryptedId[_batchId][_user] = _encryptedId;
            encryptedIdToUser[_batchId][_encryptedId] = _user;
        }
    }

    function _hashCiphertexts(bytes32[] memory _cts) private pure returns (bytes32) {
        return keccak256(abi.encode(_cts, address(this)));
    }

    function submitConnection(
        uint256 _batchId,
        address _userA,
        address _userB,
        euint32 _encryptedUserAId,
        euint32 _encryptedUserBId
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (_batchId != currentBatchId || batchClosed[_batchId]) revert InvalidBatch();

        _initIfNeeded(_batchId, _userA, _encryptedUserAId);
        _initIfNeeded(_batchId, _userB, _encryptedUserBId);

        batchConnections[_batchId].push(Connection(_encryptedUserAId, _encryptedUserBId));
        lastSubmissionTime[msg.sender] = block.timestamp;
        emit ConnectionSubmitted(_batchId, _userA, _userB);
    }

    function requestCommonFriendsCalculation(uint256 _batchId) external onlyProvider whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (batchClosed[_batchId] == false) revert InvalidBatch(); // Batch must be closed

        euint32 memory commonFriendsCount = FHE.asEuint32(0);
        Connection[] memory connections = batchConnections[_batchId];

        uint256 numConnections = connections.length;
        for (uint256 i = 0; i < numConnections; i++) {
            for (uint256 j = i + 1; j < numConnections; j++) {
                // Check if connection i and j share a common friend
                // (A,B) and (A,C) -> A is common
                // (A,B) and (C,B) -> B is common
                ebool memory isCommon1 = connections[i].userAId.eq(connections[j].userAId);
                ebool memory isCommon2 = connections[i].userAId.eq(connections[j].userBId);
                ebool memory isCommon3 = connections[i].userBId.eq(connections[j].userAId);
                ebool memory isCommon4 = connections[i].userBId.eq(connections[j].userBId);

                ebool memory isCommon = isCommon1.or(isCommon2).or(isCommon3).or(isCommon4);

                // If common, increment count
                commonFriendsCount = commonFriendsCount.add(isCommon.toEuint32());
            }
        }
        
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(commonFriendsCount);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: _batchId, stateHash: stateHash, processed: false });

        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, _batchId);
    }

    function myCallback(
        uint256 _requestId,
        bytes memory _cleartexts,
        bytes memory _proof
    ) public {
        DecryptionContext memory context = decryptionContexts[_requestId];
        if (context.processed) revert ReplayDetected();

        // Rebuild ciphertexts array in the same order as during requestDecryption
        // For this contract, it's always one ciphertext: the commonFriendsCount
        // The actual ciphertext value isn't needed for the hash, just its presence in the array
        // to match the structure hashed during requestDecryption.
        // We use a dummy euint32 to form the ciphertext array for hashing.
        euint32 memory dummyEuint;
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(dummyEuint);

        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != context.stateHash) {
            revert StateMismatch();
        }

        try FHE.checkSignatures(_requestId, _cleartexts, _proof) {
            // If checkSignatures succeeds, proceed
        } catch {
            revert ProofVerificationFailed();
        }

        // Decode cleartexts
        // _cleartexts is abi.encodePacked(uint256_value1, uint256_value2, ...)
        // We expect one uint256 value for commonFriendsCount
        uint256 commonFriends = abi.decode(_cleartexts, (uint256));

        context.processed = true;
        decryptionContexts[_requestId] = context; // Update storage

        emit DecryptionCompleted(_requestId, context.batchId, commonFriends);
    }
}