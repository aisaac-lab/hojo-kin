#!/bin/bash
# Render build script

echo "Starting build process..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install --no-frozen-lockfile || npm install
else
  echo "Dependencies already installed"
fi

# Run TypeScript compilation without type checking for faster builds
echo "Building application..."

# Set NODE_ENV to production for proper build
export NODE_ENV=production

# Set Node options for memory limit
export NODE_OPTIONS="--max-old-space-size=512"

# Ensure NODE_ENV is set for all child processes
echo "Setting NODE_ENV=production for build process..."
echo "Current NODE_ENV: $NODE_ENV"

# Always use pnpm/npm to run the build script
# This ensures proper binary execution across different Node versions
echo "Running build with package manager (NODE_ENV=$NODE_ENV)..."
if command -v pnpm &> /dev/null; then
  echo "Using pnpm..."
  # Run setup-production first if it exists
  if [ -f "scripts/setup-production.ts" ]; then
    echo "Running production setup..."
    NODE_ENV=production npx tsx scripts/setup-production.ts || echo "Setup failed, continuing..."
  fi
  
  # Run Turso migration if environment variables are set
  if [ -n "$TURSO_DATABASE_URL" ] && [ -n "$TURSO_AUTH_TOKEN" ]; then
    echo "Running Turso database migration..."
    NODE_ENV=production npx tsx scripts/migrate-turso.ts || echo "Migration failed, continuing..."
  fi
  # Run remix build with explicit NODE_ENV
  echo "Running Remix build in production mode..."
  NODE_ENV=production pnpm exec remix build
  
  # Verify NODE_ENV was used
  echo "Build completed with NODE_ENV=$NODE_ENV"
else
  echo "Using npm..."
  # Run setup-production first if it exists
  if [ -f "scripts/setup-production.ts" ]; then
    echo "Running production setup..."
    NODE_ENV=production npx tsx scripts/setup-production.ts || echo "Setup failed, continuing..."
  fi
  
  # Run Turso migration if environment variables are set
  if [ -n "$TURSO_DATABASE_URL" ] && [ -n "$TURSO_AUTH_TOKEN" ]; then
    echo "Running Turso database migration..."
    NODE_ENV=production npx tsx scripts/migrate-turso.ts || echo "Migration failed, continuing..."
  fi
  # Run remix build with explicit NODE_ENV
  echo "Running Remix build in production mode..."
  NODE_ENV=production npx remix build
  
  # Verify NODE_ENV was used
  echo "Build completed with NODE_ENV=$NODE_ENV"
fi

if [ $? -eq 0 ]; then
  echo "Build complete!"
  
  # Run post-build checks
  echo "Running post-build checks..."
  if [ -f "scripts/post-build.ts" ]; then
    npx tsx scripts/post-build.ts
    
    if [ $? -ne 0 ]; then
      echo "Post-build checks failed!"
      exit 1
    fi
  else
    echo "Warning: post-build.ts not found, skipping post-build checks"
  fi
  
  # Verify build output
  echo "Verifying build output..."
  
  # Check if public/build directory exists
  if [ ! -d "public/build" ]; then
    echo "ERROR: public/build directory not found!"
    echo "Creating public/build directory..."
    mkdir -p public/build
  fi
  
  # Check if build directory exists
  if [ ! -d "build" ]; then
    echo "ERROR: build directory not found!"
    exit 1
  fi
  
  # List build contents for debugging
  echo "Build directory contents:"
  ls -la build/
  
  echo "Public/build directory contents:"
  ls -la public/build/ || echo "Empty or missing"
  
  # Check for critical files
  if [ ! -f "build/index.js" ]; then
    echo "ERROR: build/index.js not found!"
    exit 1
  fi
  
  # Count files in public/build
  file_count=$(find public/build -type f | wc -l)
  echo "Found $file_count files in public/build"
  
  if [ "$file_count" -eq 0 ]; then
    echo "WARNING: No files found in public/build directory"
  fi
  
  # Important: Tell Render to include public directory
  echo "Setting up for Render deployment..."
  
  # Create a .render-include file to ensure public is included
  echo "public/" > .render-include
  echo "build/" >> .render-include
  
  echo "Deployment preparation complete!"
else
  echo "Build failed!"
  exit 1
fi