const { ethers } = require("ethers");

/**
 * Validates the incoming /mint request body.
 * Ensures `walletAddress` is present and is a valid checksummed EVM address.
 */
function validateMintRequest(req, res, next) {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({
      success: false,
      error  : "walletAddress is required",
    });
  }

  if (typeof walletAddress !== "string") {
    return res.status(400).json({
      success: false,
      error  : "walletAddress must be a string",
    });
  }

  if (!ethers.isAddress(walletAddress)) {
    return res.status(400).json({
      success: false,
      error  : "walletAddress is not a valid Ethereum address",
    });
  }

  // Normalise to checksum form before passing downstream
  req.body.walletAddress = ethers.getAddress(walletAddress);
  next();
}

module.exports = { validateMintRequest };
