const express    = require("express");
const router     = express.Router();
const { validateMintRequest } = require("./validateRequest");
const { mintNFT }             = require("./blockchain");

/**
 * POST /mint
 *
 * Body: { "walletAddress": "0x..." }
 *
 * Returns:
 *   { "success": true, "txHash": "0x...", "tokenId": 1 }
 */
router.post("/mint", validateMintRequest, async (req, res, next) => {
  const { walletAddress } = req.body;

  try {
    const result = await mintNFT(walletAddress);
    return res.status(200).json({
      success : true,
      txHash  : result.txHash,
      tokenId : result.tokenId,
    });
  } catch (err) {
    next(err); // forwarded to global error handler
  }
});

module.exports = router;
