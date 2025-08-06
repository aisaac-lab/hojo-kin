#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('[BUILD VERIFICATION] Starting build verification...');

const buildPath = path.join(process.cwd(), 'build/index.js');
const publicBuildPath = path.join(process.cwd(), 'public/build');

// Check if build directory exists
if (!fs.existsSync(buildPath)) {
  console.error('[BUILD VERIFICATION] ERROR: build/index.js not found!');
  process.exit(1);
}

// Check if public/build directory exists
if (!fs.existsSync(publicBuildPath)) {
  console.error('[BUILD VERIFICATION] ERROR: public/build directory not found!');
  process.exit(1);
}

// Try to load the build module
try {
  const build = require(buildPath);
  
  console.log('[BUILD VERIFICATION] Build module loaded successfully');
  console.log('[BUILD VERIFICATION] Build exports:', Object.keys(build));
  
  // Check for required exports
  const requiredExports = ['routes', 'assets', 'entry'];
  const missingExports = requiredExports.filter(exp => !build[exp]);
  
  if (missingExports.length > 0) {
    console.error('[BUILD VERIFICATION] ERROR: Missing required exports:', missingExports);
    console.error('[BUILD VERIFICATION] Available exports:', Object.keys(build));
    process.exit(1);
  }
  
  // Check routes
  if (build.routes) {
    const routeCount = Object.keys(build.routes).length;
    console.log(`[BUILD VERIFICATION] Found ${routeCount} routes`);
    
    if (routeCount === 0) {
      console.error('[BUILD VERIFICATION] WARNING: No routes found in build!');
    }
  }
  
  // Check entry points
  if (build.entry) {
    console.log('[BUILD VERIFICATION] Entry module:', build.entry.module);
  }
  
  // Check assets
  if (build.assets) {
    console.log('[BUILD VERIFICATION] Assets configured:', build.assets.version);
  }
  
  // List files in public/build
  const publicBuildFiles = fs.readdirSync(publicBuildPath);
  console.log(`[BUILD VERIFICATION] Found ${publicBuildFiles.length} files in public/build`);
  
  // Check for critical files
  const hasManifest = publicBuildFiles.some(f => f.startsWith('manifest-'));
  const hasEntryClient = publicBuildFiles.some(f => f.includes('entry.client'));
  
  if (!hasManifest) {
    console.error('[BUILD VERIFICATION] WARNING: No manifest file found in public/build');
  }
  
  if (!hasEntryClient) {
    console.error('[BUILD VERIFICATION] WARNING: No entry.client file found in public/build');
  }
  
  console.log('[BUILD VERIFICATION] Build verification completed successfully!');
  
} catch (error) {
  console.error('[BUILD VERIFICATION] ERROR: Failed to load build module:', error.message);
  console.error('[BUILD VERIFICATION] Stack:', error.stack);
  process.exit(1);
}