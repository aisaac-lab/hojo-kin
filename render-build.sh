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

# Always use pnpm/npm to run the build script
# This ensures proper binary execution across different Node versions
echo "Running build with package manager..."
if command -v pnpm &> /dev/null; then
  echo "Using pnpm..."
  pnpm run build
else
  echo "Using npm..."
  npm run build
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