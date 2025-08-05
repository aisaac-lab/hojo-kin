#!/bin/bash
# Production start script with error handling

echo "Starting production server..."

# Ensure we're in the correct directory
cd "$(dirname "$0")/.."

# Check if build exists
if [ ! -d "build" ]; then
  echo "ERROR: build directory not found. Please run the build process first."
  exit 1
fi

if [ ! -d "public/build" ]; then
  echo "ERROR: public/build directory not found. Please run the build process first."
  exit 1
fi

# Set production environment
export NODE_ENV=production

# Log environment status
echo "Environment: $NODE_ENV"
echo "Node version: $(node -v)"

# Check for required environment variables
if [ -z "$TURSO_DATABASE_URL" ]; then
  echo "WARNING: TURSO_DATABASE_URL is not set"
fi

if [ -z "$TURSO_AUTH_TOKEN" ]; then
  echo "WARNING: TURSO_AUTH_TOKEN is not set"
fi

if [ -z "$OPENAI_API_KEY" ]; then
  echo "WARNING: OPENAI_API_KEY is not set"
fi

# Start the server with proper error handling
echo "Starting server on port ${PORT:-10000}..."

# Use node with ES module support
exec node --experimental-modules --es-module-specifier-resolution=node server.production.js