import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import morgan from "morgan";
import * as build from "./build/index.js";

installGlobals();

const app = express();

// Logging
app.use(morgan("tiny"));

// Compression
app.use(compression());

// Health check endpoint (before static files)
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Serve static files from public/build
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
    setHeaders: (res, path) => {
      // Set proper headers for JavaScript files
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      }
    },
  })
);

// Serve static files from public root
app.use(
  express.static("public", {
    maxAge: "1h",
  })
);

// Disable WebSocket for production
app.use((req, res, next) => {
  if (req.url === "/socket" || req.url.includes("8002")) {
    return res.status(404).end();
  }
  next();
});

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Remix handler
app.all(
  "*",
  createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
    getLoadContext: () => ({
      // Add any context you need here
    }),
  })
);

const port = process.env.PORT || 10000;
const host = '0.0.0.0'; // Bind to all interfaces for Render

const server = app.listen(port, host, () => {
  console.log(`✅ Server ready at http://${host}:${port}`);
  console.log(`📦 Build mode: ${process.env.NODE_ENV}`);
  console.log(`🔐 Turso DB: ${process.env.TURSO_DATABASE_URL ? 'Configured' : 'Not configured'}`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});