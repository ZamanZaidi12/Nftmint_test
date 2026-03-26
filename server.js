require("dotenv").config();
const express    = require("express");
const helmet     = require("helmet");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");
const morgan     = require("morgan");

const mintRouter = require("./mint");
const { errorHandler } = require("./errorHandler");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs : 15 * 60 * 1000, // 15 minutes
  max      : 20,              // 20 requests per window per IP
  message  : { success: false, error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders  : false,
});
app.use(limiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// ─── Request Logging ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status   : "ok",
    service  : "NFT Minting API",
    timestamp: new Date().toISOString(),
    network  : process.env.NETWORK || "polygon-mumbai",
    contract : process.env.CONTRACT_ADDRESS || "not configured",
  });
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/", mintRouter);

// ─── 404 Handler ───────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ──────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 NFT Minting API running on port ${PORT}`);
    console.log(`🌐 Network  : ${process.env.NETWORK || "polygon-mumbai"}`);
    console.log(`📄 Contract : ${process.env.CONTRACT_ADDRESS}`);
    console.log(`💡 Health   : http://localhost:${PORT}/health`);
  });
}

module.exports = app; // exported for tests
