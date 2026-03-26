const request = require("supertest");
const sinon   = require("sinon");
const { expect } = require("chai");

process.env.NODE_ENV        = "test";
process.env.RPC_URL         = "https://rpc-mumbai.maticvigil.com";
process.env.DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.CONTRACT_ADDRESS     = "0x1234567890123456789012345678901234567890";

const app              = require("../api/server");
const blockchainUtils  = require("../api/utils/blockchain");

const VALID_ADDRESS  = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MOCK_TX_HASH   = "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1";
const MOCK_TOKEN_ID  = 1;

describe("POST /mint — API Unit Tests", function () {
  let mintStub;

  beforeEach(function () {
    // Replace the real blockchain call with a stub
    mintStub = sinon.stub(blockchainUtils, "mintNFT");
  });

  afterEach(function () {
    sinon.restore();
  });

  describe("✅ Success cases", function () {
    it("should return 200 with txHash and tokenId on successful mint", async function () {
      mintStub.resolves({ txHash: MOCK_TX_HASH, tokenId: MOCK_TOKEN_ID });

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.txHash).to.equal(MOCK_TX_HASH);
      expect(res.body.tokenId).to.equal(MOCK_TOKEN_ID);
    });

    it("should call mintNFT with the checksummed wallet address", async function () {
      mintStub.resolves({ txHash: MOCK_TX_HASH, tokenId: MOCK_TOKEN_ID });

      // Send lowercase address; 
      await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS.toLowerCase() })
        .expect(200);

      expect(mintStub.calledOnce).to.be.true;
      // ethers.getAddress produces the checksummed version
      expect(mintStub.firstCall.args[0]).to.equal(VALID_ADDRESS);
    });

    it("should return incrementing tokenIds on sequential mints", async function () {
      mintStub.onFirstCall().resolves({ txHash: MOCK_TX_HASH, tokenId: 1 });
      mintStub.onSecondCall().resolves({ txHash: MOCK_TX_HASH, tokenId: 2 });

      const res1 = await request(app).post("/mint").send({ walletAddress: VALID_ADDRESS });
      const res2 = await request(app).post("/mint").send({ walletAddress: VALID_ADDRESS });

      expect(res1.body.tokenId).to.equal(1);
      expect(res2.body.tokenId).to.equal(2);
    });
  });

  describe("❌ Validation failures (no blockchain call)", function () {
    it("should return 400 when walletAddress is missing", async function () {
      const res = await request(app)
        .post("/mint")
        .send({})
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(res.body.error).to.include("walletAddress is required");
      expect(mintStub.called).to.be.false;
    });

    it("should return 400 when walletAddress is not a valid address", async function () {
      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: "not-an-address" })
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(res.body.error).to.include("valid Ethereum address");
      expect(mintStub.called).to.be.false;
    });

    it("should return 400 when walletAddress is an empty string", async function () {
      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: "" })
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(mintStub.called).to.be.false;
    });

    it("should return 400 when body is not JSON", async function () {
      const res = await request(app)
        .post("/mint")
        .set("Content-Type", "text/plain")
        .send("walletAddress=0x123")
        .expect(400);

      expect(res.body.success).to.be.false;
    });
  });

  // ── Blockchain errors
  describe("⚠️  Blockchain error handling", function () {
    it("should return 409 when max supply is reached", async function () {
      const err     = new Error("MaxSupplyReached");
      err.code      = "CALL_EXCEPTION";
      err.reason    = "MaxSupplyReached";
      mintStub.rejects(err);

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(409);

      expect(res.body.success).to.be.false;
      expect(res.body.error).to.include("sold out");
    });

    it("should return 400 for insufficient payment error", async function () {
      const err  = new Error("InsufficientPayment");
      err.code   = "CALL_EXCEPTION";
      err.reason = "InsufficientPayment";
      mintStub.rejects(err);

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(400);

      expect(res.body.success).to.be.false;
      expect(res.body.error).to.include("Insufficient payment");
    });

    it("should return 503 when the server wallet has insufficient funds", async function () {
      const err  = new Error("insufficient funds");
      err.code   = "INSUFFICIENT_FUNDS";
      mintStub.rejects(err);

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(503);

      expect(res.body.success).to.be.false;
      expect(res.body.error).to.include("insufficient funds");
    });

    it("should return 503 on network error", async function () {
      const err  = new Error("network error");
      err.code   = "NETWORK_ERROR";
      mintStub.rejects(err);

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(503);

      expect(res.body.success).to.be.false;
    });

    it("should return 500 on an unexpected error", async function () {
      mintStub.rejects(new Error("Unexpected internal error"));

      const res = await request(app)
        .post("/mint")
        .send({ walletAddress: VALID_ADDRESS })
        .expect(500);

      expect(res.body.success).to.be.false;
    });
  });

  //Health check
  describe("GET /health", function () {
    it("should return 200 with status ok", async function () {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).to.equal("ok");
    });
  });

  // ── 404 handler ─────────────────────────────────────────────────────────────
  describe("Unknown routes", function () {
    it("should return 404 for unknown routes", async function () {
      const res = await request(app).get("/unknown-route").expect(404);
      expect(res.body.success).to.be.false;
    });
  });
});
