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

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Health check endpoint (before static files)
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// API health check with environment variables status
app.get("/api/health", (req, res) => {
  const envStatus = {
    NODE_ENV: process.env.NODE_ENV || 'not set',
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL ? 'configured' : 'missing',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'configured' : 'missing',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID ? 'configured' : 'missing',
    OPENAI_VECTOR_STORE_ID: process.env.OPENAI_VECTOR_STORE_ID ? 'configured' : 'missing',
    OPENAI_REVIEW_MODEL: process.env.OPENAI_REVIEW_MODEL || 'not set',
  };
  
  const allConfigured = Object.entries(envStatus).every(
    ([key, value]) => value !== 'missing'
  );
  
  res.status(allConfigured ? 200 : 503).json({
    status: allConfigured ? 'healthy' : 'unhealthy',
    environment: envStatus,
    timestamp: new Date().toISOString(),
  });
});

// Diagnostic endpoint for debugging build issues
app.get("/api/diagnostics", (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    cwd: process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    },
    paths: {
      build: fs.existsSync('./build'),
      publicBuild: fs.existsSync('./public/build'),
      buildIndex: fs.existsSync('./build/index.js'),
    },
    files: {
      publicBuild: [],
      manifest: [],
      entryClient: [],
    },
  };
  
  // List files in public/build if it exists
  if (fs.existsSync('./public/build')) {
    try {
      const files = fs.readdirSync('./public/build');
      diagnostics.files.publicBuild = files.slice(0, 20);
      diagnostics.files.manifest = files.filter(f => f.startsWith('manifest-'));
      diagnostics.files.entryClient = files.filter(f => f.startsWith('entry.client'));
    } catch (err) {
      diagnostics.files.error = err.message;
    }
  }
  
  // Check if we can access the build module
  try {
    diagnostics.buildModule = {
      loaded: !!build,
      hasRoutes: !!build.routes,
      routeCount: build.routes ? Object.keys(build.routes).length : 0,
    };
  } catch (err) {
    diagnostics.buildModule = { error: err.message };
  }
  
  res.json(diagnostics);
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
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      }
      if (path.includes("manifest-")) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
      console.log(`[STATIC] Serving: ${path}`);
    },
  })
);

// Serve static files from public root
app.use(
  express.static("public", {
    maxAge: "1h",
    index: false, // Don't serve index.html, let Remix handle it
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
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// JSON parsing error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[SERVER] JSON parse error:', err.message);
    return res.status(400).json({ 
      error: 'Invalid JSON', 
      details: err.message 
    });
  }
  next();
});

// Specific manifest handling
app.get("/build/manifest-*.js", (req, res, next) => {
  console.log(`[SERVER] Manifest request: ${req.url}`);
  next();
});

// Remix handler with error handling
app.all(
  "*",
  (req, res, next) => {
    // Log all requests that reach Remix handler
    console.log(`[REMIX] Handling: ${req.method} ${req.url}`);
    next();
  },
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
  console.log(`🔐 Environment status:`);
  console.log(`   - Turso DB: ${process.env.TURSO_DATABASE_URL ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - Turso Auth: ${process.env.TURSO_AUTH_TOKEN ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - OpenAI Assistant ID: ${process.env.OPENAI_ASSISTANT_ID ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - OpenAI Vector Store: ${process.env.OPENAI_VECTOR_STORE_ID ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   - Review Model: ${process.env.OPENAI_REVIEW_MODEL || 'Not set (using default)'}`);
  
  // Warn if critical environment variables are missing
  const criticalVars = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'OPENAI_API_KEY', 'OPENAI_ASSISTANT_ID'];
  const missingVars = criticalVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`⚠️  WARNING: Critical environment variables are missing: ${missingVars.join(', ')}`);
    console.error(`   The application may not function properly.`);
  }
});

// Unmatched routes handler (before global error handler)
app.use((req, res, next) => {
  console.error(`[SERVER] 404 - Not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not found',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  console.error('[SERVER] Error stack:', err.stack);
  console.error('[SERVER] Request:', req.method, req.url);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    details: isDevelopment ? err.message : 'An unexpected error occurred',
    path: req.url,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});