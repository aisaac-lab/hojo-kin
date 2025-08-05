/**
 * Common metadata processing utilities
 */

/**
 * Process thread metadata from userId and additional metadata
 */
export function processThreadMetadata(
  userId?: string,
  metadata?: Record<string, any>
): Record<string, string> {
  const threadMetadata: Record<string, string> = {};
  
  if (userId) {
    threadMetadata.userId = userId;
  }
  
  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      threadMetadata[key] = String(value);
    });
  }
  
  return threadMetadata;
}

/**
 * Validate and sanitize metadata
 */
export function sanitizeMetadata(
  metadata: Record<string, any>
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  Object.entries(metadata).forEach(([key, value]) => {
    // Skip null/undefined values
    if (value == null) return;
    
    // Convert to string
    sanitized[key] = String(value);
  });
  
  return sanitized;
}

/**
 * Merge multiple metadata objects
 */
export function mergeMetadata(
  ...metadataObjects: (Record<string, any> | undefined)[]
): Record<string, string> {
  const merged: Record<string, any> = {};
  
  for (const metadata of metadataObjects) {
    if (metadata) {
      Object.assign(merged, metadata);
    }
  }
  
  return sanitizeMetadata(merged);
}