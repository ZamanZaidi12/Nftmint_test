# 🖼️ Polygon NFT Minting System

A production-ready NFT minting system built on the **Polygon Mumbai testnet** comprising:

- **ERC-721 Smart Contract** — fixed supply of 5, configurable mint price, reentrancy-safe
- **Express REST API** — `/mint` endpoint with wallet validation and error handling
- **Full test suite** — Hardhat contract tests + Mocha/Sinon API unit tests

---

## 📁 Project Structure

```
polygon-nft-minting/
├── contracts/
│   └── PolygonNFT.sol          # ERC-721 contract (OpenZeppelin v5)
├── scripts/
│   └── deploy.js               # Hardhat deployment + Polygonscan verify
├── test/
│   ├── PolygonNFT.test.js      # Contract tests (Hardhat / Chai)
│   └── api.test.js             # API unit tests (Mocha / Sinon / Supertest)
├── api/
│   ├── server.js               # Express app entry point
│   ├── routes/
│   │   └── mint.js             # POST /mint route
│   ├── middleware/
│   │   ├── validateRequest.js  # Input validation
│   │   └── errorHandler.js     # Global error handler
│   └── utils/
│       └── blockchain.js       # ethers.js contract interaction
├── hardhat.config.js
├── package.json
├── .env.example                # Environment variable template
└── README.md
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Test MATIC | [Polygon Faucet](https://faucet.polygon.technology/) |

---

## 🚀 Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/polygon-nft-minting.git
cd polygon-nft-minting
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `RPC_URL` | Polygon Mumbai RPC URL (Alchemy / Infura / QuickNode) |
| `DEPLOYER_PRIVATE_KEY` | Server wallet private key (fund with test MATIC) |
| `CONTRACT_ADDRESS` | Filled in **after** deployment |
| `BASE_URI` | IPFS base URI for token metadata |
| `POLYGONSCAN_API_KEY` | Optional — enables contract verification |

> ⚠️ **Never commit your `.env` file or private key to version control.**

### 3. Compile the contract

```bash
npm run compile
```

---

## 🔗 Smart Contract Deployment

### Deploy to Polygon Mumbai

```bash
npm run deploy:mumbai
```

The script will:
1. Deploy `PolygonNFT` with your configured price and base URI
2. Print the contract address and Polygonscan link
3. Optionally verify the contract on Polygonscan
4. Save deployment details to `deployment.json`

### Update `.env`

After deployment, copy the contract address into `.env`:

```env
CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

### Local development (Hardhat node)

```bash
# Terminal 1 — start local node
npm run node:local

# Terminal 2 — deploy to local node
npm run deploy:local
```

---

## 🌐 Running the API

### Development (with auto-reload)

```bash
npm run api:dev
```

### Production

```bash
npm run api:start
```

The server starts on `PORT` (default `3000`).

---

## 📡 API Endpoints

### `GET /health`

Returns API status and contract configuration.

```json
{
  "status": "ok",
  "service": "NFT Minting API",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "network": "polygon-mumbai",
  "contract": "0x..."
}
```

---

### `POST /mint`

Mint one NFT to the specified wallet address.

**Request**

```http
POST /mint
Content-Type: application/json

{
  "walletAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

**Success Response `200`**

```json
{
  "success": true,
  "txHash": "0xabc123...",
  "tokenId": 1
}
```

**Error Responses**

| Status | Reason |
|--------|--------|
| `400` | Missing / invalid `walletAddress` |
| `409` | Max supply (5) reached |
| `503` | Server wallet has no funds / network error |
| `500` | Unexpected server error |

**cURL example**

```bash
curl -X POST http://localhost:3000/mint \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0xYOUR_WALLET_ADDRESS"}'
```

---

## 🧪 Running Tests

### Smart contract tests

```bash
npm run test:contracts
```

Covers:
- ✅ Successful mint and token ID assignment
- ✅ Supply limit enforcement (revert on 6th mint)
- ✅ Payment validation (exact, underpay, overpay refund)
- ✅ Owner-only: `setMintPrice`, `setBaseURI`, `withdraw`
- ✅ Event emission
- ✅ `tokenURI` correctness

### API unit tests

```bash
npm run test:api
```

Covers (all blockchain calls are mocked with Sinon):
- ✅ Happy path — returns `txHash` and `tokenId`
- ✅ Address normalisation (lowercase → checksum)
- ✅ Missing / invalid `walletAddress` → `400`
- ✅ Max supply error → `409`
- ✅ Insufficient funds → `503`
- ✅ Network error → `503`
- ✅ Unexpected error → `500`
- ✅ Health check
- ✅ Unknown route → `404`

### Run all tests

```bash
npm test
```

### Gas report

```bash
npm run gas-report
```

---

## 🔐 Security Measures

### Smart Contract

| Measure | Implementation |
|---------|---------------|
| Reentrancy protection | `ReentrancyGuard` from OpenZeppelin |
| Access control | `Ownable` — owner-only admin functions |
| Supply cap | Hard-coded `MAX_SUPPLY = 5` constant |
| Payment validation | Custom `InsufficientPayment` error with exact amounts |
| Overpayment refund | Excess ETH returned to sender automatically |
| Safe minting | `_safeMint` checks recipient can receive ERC-721 |
| Input validation | `ZeroAddress` check on recipient |
| Custom errors | Gas-efficient `revert` with typed errors |

### API

| Measure | Implementation |
|---------|---------------|
| Helmet | HTTP security headers |
| Rate limiting | 20 req / 15 min per IP |
| Input validation | `ethers.isAddress` check before any contract call |
| Private key security | Stored in `.env`, never logged or exposed |
| Error sanitisation | Production mode returns generic messages |
| Singleton provider | RPC connection reused (no connection leak) |

---

## 🗺️ Deployed Contract

| Network | Contract Address | Explorer |
|---------|-----------------|---------|
| Polygon Mumbai | `0xYOUR_CONTRACT_ADDRESS` | [View on Polygonscan](https://mumbai.polygonscan.com/address/0xYOUR_CONTRACT_ADDRESS) |

---

## 📝 Contract ABI (mint function)

```json
{
  "inputs": [{ "internalType": "address", "name": "to", "type": "address" }],
  "name": "mint",
  "outputs": [],
  "stateMutability": "payable",
  "type": "function"
}
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a PR

---

## 📄 License

MIT
