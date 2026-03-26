
function errorHandler(err, _req, res, _next) {
  console.error("[Error]", err.message);

  if (err.code === "CALL_EXCEPTION" || err.reason) {
    const reason = err.reason || "Contract call reverted";

    if (reason.includes("MaxSupplyReached")) {
      return res.status(409).json({
        success: false,
        error  : "NFT collection is sold out (max supply reached)",
      });
    }

    if (reason.includes("InsufficientPayment")) {
      return res.status(400).json({
        success: false,
        error  : "Insufficient payment sent to contract",
      });
    }

    return res.status(400).json({
      success: false,
      error  : `Contract error: ${reason}`,
    });
  }


  if (err.code === "INSUFFICIENT_FUNDS") {
    return res.status(503).json({
      success: false,
      error  : "Server wallet has insufficient funds",
    });
  }

  // ── Network / RPC errors
  if (err.code === "NETWORK_ERROR" || err.code === "SERVER_ERROR") {
    return res.status(503).json({
      success: false,
      error  : "Blockchain network unavailable, please retry",
    });
  }

  // ── Fallback 
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error  : process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
}

module.exports = { errorHandler };
