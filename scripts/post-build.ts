#!/usr/bin/env tsx
/**
 * Post-build script to ensure proper file structure and module handling
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createLogger } from '../app/utils/logger';

const logger = createLogger('Post-Build');

async function postBuild() {
  logger.info('Starting post-build checks...');
  
  const publicBuildDir = join(process.cwd(), 'public/build');
  const buildDir = join(process.cwd(), 'build');
  
  // Check if directories exist
  if (!existsSync(publicBuildDir)) {
    logger.error('ERROR: public/build directory not found!');
    process.exit(1);
  }
  
  if (!existsSync(buildDir)) {
    logger.error('ERROR: build directory not found!');
    process.exit(1);
  }
  
  try {
    // List files in public/build
    const files = await readdir(publicBuildDir);
    logger.info(`Found ${files.length} files in public/build`);
    
    // Find entry.client file
    const entryClientFile = files.find(f => f.startsWith('entry.client-') && f.endsWith('.js'));
    if (!entryClientFile) {
      logger.error('ERROR: entry.client file not found!');
      process.exit(1);
    }
    
    logger.info(`Found entry.client file: ${entryClientFile}`);
    
    // Check file size
    const filePath = join(publicBuildDir, entryClientFile);
    const stats = await stat(filePath);
    logger.info(`Entry client file size: ${stats.size} bytes`);
    
    // Check if file starts with proper module syntax
    const content = await readFile(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];
    
    if (!content.includes('import') && !content.includes('export')) {
      logger.warn('WARNING: Entry client file does not appear to use ES module syntax');
    } else {
      logger.info('Entry client file uses ES module syntax ✓');
    }
    
    // Check manifest
    const manifestFile = files.find(f => f.startsWith('manifest-') && f.endsWith('.js'));
    if (!manifestFile) {
      logger.error('ERROR: manifest file not found!');
      process.exit(1);
    }
    
    logger.info(`Found manifest file: ${manifestFile}`);
    
    // Create a simple redirect file for compatibility
    const redirectContent = `
// Redirect to the actual entry.client file
window.location.replace('/build/${entryClientFile}');
`;
    
    // Don't create the redirect file as it might cause issues
    // await writeFile(join(publicBuildDir, 'entry.client.js'), redirectContent);
    
    logger.info('Post-build checks completed successfully!');
    
  } catch (error) {
    logger.error('Error during post-build checks:', error);
    process.exit(1);
  }
}

// Run the post-build checks
postBuild()
  .then(() => {
    logger.info('Done!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Failed:', error);
    process.exit(1);
  });