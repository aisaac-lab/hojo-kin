import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';

/**
 * Compress response data using gzip
 */
export async function compressResponse(data: any): Promise<Buffer> {
  const jsonString = JSON.stringify(data);
  const buffer = Buffer.from(jsonString, 'utf-8');
  
  return new Promise((resolve, reject) => {
    const gzip = createGzip({
      level: 6, // Balanced compression level
    });
    
    const chunks: Buffer[] = [];
    
    gzip.on('data', (chunk) => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
    
    gzip.write(buffer);
    gzip.end();
  });
}

/**
 * Create compression transform stream for SSE
 */
export function createCompressionStream(): Transform {
  return createGzip({
    level: 6,
    flush: 2, // Z_SYNC_FLUSH for real-time streaming
  });
}

/**
 * Add compression headers to response
 */
export function addCompressionHeaders(headers: Headers): void {
  headers.set('Content-Encoding', 'gzip');
  headers.set('Vary', 'Accept-Encoding');
}

/**
 * Check if client accepts gzip encoding
 */
export function acceptsGzip(request: Request): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  return acceptEncoding.includes('gzip');
}