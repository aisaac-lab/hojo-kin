import { createRequestHandler } from "@remix-run/express";
import express from "express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readdirSync } from "fs";
import * as build from "./build/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      build: existsSync('./build'),
      publicBuild: existsSync('./public/build'),
      buildIndex: existsSync('./build/index.js'),
    },
    files: {
      publicBuild: [],
      manifest: [],
      entryClient: [],
    },
  };
  
  // List files in public/build if it exists
  if (existsSync('./public/build')) {
    try {
      const files = readdirSync('./public/build');
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
// Log the actual path being used
const publicBuildPath = path.join(process.cwd(), 'public/build');
try {
  console.log('[STATIC] Configuring static file serving from:', publicBuildPath);
  console.log('[STATIC] Directory exists:', existsSync(publicBuildPath));
  if (existsSync(publicBuildPath)) {
    console.log('[STATIC] Files in directory:', readdirSync(publicBuildPath).slice(0, 10));
  }
} catch (err) {
  console.error('[STATIC] Error checking build directory:', err);
}

app.use(
  "/build",
  express.static(publicBuildPath, {
    immutable: true,
    maxAge: "1y",
    setHeaders: (res, filePath) => {
      // Set proper headers for JavaScript files
      if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        // For entry.client files, ensure they're treated as modules
        if (filePath.includes("entry.client")) {
          res.setHeader("X-Content-Type-Options", "nosniff");
        }
      }
      if (filePath.includes("manifest-")) {
        res.setHeader("Cache-Control", "public, max-age=3600");
      }
      console.log(`[STATIC] Serving: ${filePath}`);
    },
    fallthrough: true, // Allow Remix to handle if file not found
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

// Redirect entry.client.js to the actual hashed file
app.get("/build/entry.client.js", async (req, res, next) => {
  try {
    console.log('[BUILD] Handling entry.client.js request');
    
    // Import the build to get the manifest
    const buildModule = await import('./build/index.js');
    if (buildModule.default?.manifest?.entry?.module) {
      const actualPath = buildModule.default.manifest.entry.module;
      console.log(`[BUILD] Redirecting to actual entry module: ${actualPath}`);
      return res.redirect(actualPath);
    }
    
    // Fallback: find the actual file
    const buildDir = path.join(process.cwd(), 'public/build');
    if (existsSync(buildDir)) {
      const files = readdirSync(buildDir);
      const entryClientFile = files.find(f => f.startsWith('entry.client-') && f.endsWith('.js'));
      if (entryClientFile) {
        console.log(`[BUILD] Redirecting to found entry.client file: /build/${entryClientFile}`);
        return res.redirect(`/build/${entryClientFile}`);
      }
    }
  } catch (err) {
    console.error('[BUILD] Error handling entry.client.js:', err);
  }
  
  console.error('[BUILD] Could not find entry.client.js');
  return res.status(404).json({ error: 'Entry client file not found' });
});

// Handle specific build file requests with detailed logging
app.get("/build/*", (req, res, next) => {
  try {
    const filePath = path.join(process.cwd(), 'public', req.path);
    console.log(`[BUILD] Request for: ${req.path}`);
    console.log(`[BUILD] Looking for file at: ${filePath}`);
    console.log(`[BUILD] File exists: ${existsSync(filePath)}`);
    
    if (!existsSync(filePath)) {
      console.error(`[BUILD] 404 - File not found: ${req.path}`);
      console.error(`[BUILD] Expected location: ${filePath}`);
      
      // List available files for debugging
      const buildDir = path.join(process.cwd(), 'public/build');
      if (existsSync(buildDir)) {
        try {
          const files = readdirSync(buildDir);
          console.error(`[BUILD] Available files in build directory:`, files.slice(0, 10));
        } catch (err) {
          console.error(`[BUILD] Error reading build directory:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`[BUILD] Error in build handler:`, err);
  }
  
  next();
});

// Remix handler with error handling
app.all(
  "*",
  (req, res, next) => {
    // Log all requests that reach Remix handler
    console.log(`[REMIX] Handling: ${req.method} ${req.url}`);
    
    // Log additional details for POST requests to help debug 400 errors
    if (req.method === 'POST' && req.url.includes('/api/')) {
      console.log(`[REMIX] POST request details:`, {
        url: req.url,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        body: req.body ? '(body present)' : '(no body)',
      });
    }
    
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
  console.error('[SERVER] Stack:', error.stack);
  // Don't exit in production to prevent 502 errors
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise);
  console.error('[SERVER] Reason:', reason);
  // Don't exit in production to prevent 502 errors
  // process.exit(1);
});