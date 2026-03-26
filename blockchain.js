const { ethers } = require("ethers");

const NFT_ABI = [
  
  "function mint(address to) external payable",
  "function mintPrice() external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function remainingSupply() external view returns (uint256)",
  "function MAX_SUPPLY() external view returns (uint256)",
  
  "event NFTMinted(address indexed to, uint256 indexed tokenId, uint256 price)",
];

let _provider = null;
let _wallet   = null;
let _contract = null;

function getContractInstance() {
  if (_contract) return _contract;

  const { RPC_URL, DEPLOYER_PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;

  if (!RPC_URL)              throw new Error("Missing env: RPC_URL");
  if (!DEPLOYER_PRIVATE_KEY) throw new Error("Missing env: DEPLOYER_PRIVATE_KEY");
  if (!CONTRACT_ADDRESS)     throw new Error("Missing env: CONTRACT_ADDRESS");

  _provider = new ethers.JsonRpcProvider(RPC_URL);
  _wallet   = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, _provider);
  _contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, _wallet);

  return _contract;
}

/**
 * Mint one NFT to `recipientAddress`.
 *
 * @param {string} recipientAddress  Checksummed EVM address
 * @returns {{ txHash: string, tokenId: number }}
 */
async function mintNFT(recipientAddress) {
  const contract = getContractInstance();

  // ── Fetch current mint price from contract 
  const mintPrice = await contract.mintPrice();

  // ── Estimate gas and add 20% buffer 
  const gasEstimate = await contract.mint.estimateGas(
    recipientAddress,
    { value: mintPrice }
  );
  const gasLimit = (gasEstimate * 120n) / 100n;

  // ── Send transaction 
  const tx = await contract.mint(recipientAddress, {
    value   : mintPrice,
    gasLimit,
  });

  
  const receipt = await tx.wait(1);

  if (!receipt || receipt.status === 0) {
    throw new Error("Transaction failed on-chain");
  }

  // ── Parse tokenId from NFTMinted event 
  const tokenId = parseTokenIdFromReceipt(contract, receipt);

  return {
    txHash : receipt.hash,
    tokenId,
  };
}

/**
 * Parse the tokenId from the NFTMinted event in a transaction receipt.
 *
 * @param {ethers.Contract} contract
 * @param {ethers.TransactionReceipt} receipt
 * @returns {number}
 */
function parseTokenIdFromReceipt(contract, receipt) {
  const eventFragment = contract.interface.getEvent("NFTMinted");

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "NFTMinted") {
        return Number(parsed.args.tokenId);
      }
    } catch {
      
    }
  }

  // Fallback
  throw new Error("Could not parse tokenId from transaction receipt");
}

// ─── Export helpers (also used in tests via mocking)
module.exports = {
  mintNFT,
  getContractInstance,
  _resetSingletons: () => { _provider = null; _wallet = null; _contract = null; },
};
