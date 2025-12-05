# Confidential Web3 Social Graph Protocol

**SocialCipher** is a groundbreaking solution that empowers users to create encrypted social relationships while maintaining the utmost privacy. Built on **Zama's Fully Homomorphic Encryption technology**, this protocol allows applications to provide personalized recommendations and analytics without compromising users' relationship networks.

## The Challenge of Privacy in Social Connectivity

In today's digital age, social networks play a pivotal role in our lives. However, they often expose sensitive information, risking user privacy. Users are concerned about how their social connections are managed and exploited by platforms, which can lead to unwanted intrusion and data misuse. **SocialCipher** addresses this critical issue by enabling a privacy-preserving approach to social networking.

## FHE: The Protective Shield

Fully Homomorphic Encryption (FHE) is a revolutionary technology that lets computations be performed on encrypted data without needing to decrypt it first. By implementing **Zama's open-source libraries**, including the **zama-fhe SDK**, SocialCipher allows users to maintain a secure social graph where their relationships remain confidential. The platform can deliver personalized experiences such as friend recommendations and analytics without ever revealing the underlying sensitive data, thereby ensuring user privacy remains intact.

## Core Functionalities

### Key Features

- **Encrypted Social Graph**: Users can create and manage their social relationships in a secure environment.
- **Recommendation Algorithms**: Leverage encrypted graph-based algorithms to calculate potential friends, mutual connections, and other relevant insights without exposing users' data.
- **Third-Party Authorization**: Users can authorize trusted third parties to perform computations on their encrypted social graph for tailored services.
- **Privacy Protection**: Advanced mechanisms safeguard users' social graph data from misuse by platforms, ensuring confidence in their digital interactions.

## Technology Stack

- **Zama FHE SDK**: The core technology enabling confidential computations on encrypted data.
- **Node.js**: JavaScript runtime environment for backend development.
- **Hardhat/Foundry**: Frameworks for Ethereum smart contract development and testing.
- **Solidity**: Programming language for writing smart contracts on Ethereum.

## Directory Structure

```plaintext
SocialCipher/
├── contracts/
│   └── SocialCipher.sol
├── src/
│   └── index.js
├── test/
│   └── SocialCipher.test.js
├── package.json
└── hardhat.config.js
```

## Installation Instructions

To set up and run SocialCipher, follow these steps:

1. **Download the Project**: Ensure you have the project downloaded on your local machine.
2. **Install Node.js**: Ensure you have Node.js installed. If not, download and install it from the official Node.js website.
3. **Install Dependencies**: In your terminal, navigate to the project directory and run the following command to install the required packages, including Zama FHE libraries:

   ```bash
   npm install
   ```

This command will fetch all necessary libraries, including those required for the Zama FHE functionalities.

## Build & Run Guide

Once you have completed the installation, you can build and run the project using the following commands:

1. **Compile the Smart Contracts**:

   ```bash
   npx hardhat compile
   ```

2. **Run Tests**:

   ```bash
   npx hardhat test
   ```

3. **Deploy to a Local Blockchain**:

   ```bash
   npx hardhat run scripts/deploy.js
   ```

4. **Start the Development Server**:

   ```bash
   node src/index.js
   ```

This will launch the backend, allowing you to interact with the protocol.

## Example Usage

Here's a simple code snippet that demonstrates how to initialize a social graph in the SocialCipher protocol:

```javascript
const { SocialCipher } = require('./contracts/SocialCipher');

async function initializeGraph(userId) {
    const socialCipher = new SocialCipher();
    
    await socialCipher.createUserNode(userId);
    console.log(`User node for ${userId} created successfully!`);
    
    const friends = await socialCipher.getFriendRecommendations(userId);
    console.log(`Recommendations for ${userId}:`, friends);
}

// Initialize for a hypothetical user
initializeGraph('user123');
```

## Acknowledgements

**Powered by Zama**: We extend our heartfelt gratitude to the Zama team for their innovative work in the field of Fully Homomorphic Encryption. Their open-source tools empower developers to create revolutionary applications that prioritize user privacy in the blockchain landscape. Thanks to their commitment, SocialCipher can redefine social interaction in the Web3 world!
