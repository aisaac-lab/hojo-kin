/**
 * Streaming utilities for Server-Sent Events (SSE)
 */

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * Format a message for Server-Sent Events
 */
export function formatSSE(message: SSEMessage): string {
  let output = '';
  
  if (message.id) {
    output += `id: ${message.id}\n`;
  }
  
  if (message.event) {
    output += `event: ${message.event}\n`;
  }
  
  if (message.retry) {
    output += `retry: ${message.retry}\n`;
  }
  
  // Split data by newlines and format each line
  const dataLines = message.data.split('\n');
  for (const line of dataLines) {
    output += `data: ${line}\n`;
  }
  
  // SSE messages must end with double newline
  output += '\n';
  
  return output;
}

/**
 * Create SSE headers for streaming response
 */
export function createSSEHeaders(): Headers {
  return new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  });
}

/**
 * Create a transform stream for SSE encoding
 */
export function createSSEEncoderStream(): TransformStream<SSEMessage, string> {
  const encoder = new TextEncoder();
  
  return new TransformStream({
    transform(chunk, controller) {
      const formatted = formatSSE(chunk);
      controller.enqueue(formatted);
    },
  });
}

/**
 * Stream event types
 */
export enum StreamEventType {
  START = 'start',
  CHUNK = 'chunk',
  COMPLETE = 'complete',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

/**
 * Create a heartbeat interval to keep connection alive
 */
export function createHeartbeatInterval(
  writer: WritableStreamDefaultWriter<SSEMessage>,
  intervalMs: number = 30000
): NodeJS.Timeout {
  return setInterval(() => {
    writer.write({
      event: StreamEventType.HEARTBEAT,
      data: JSON.stringify({ timestamp: Date.now() }),
    }).catch(() => {
      // Connection closed, ignore error
    });
  }, intervalMs);
}

/**
 * Safely close a writer and cleanup resources
 */
export async function closeStreamWriter(
  writer: WritableStreamDefaultWriter<SSEMessage>,
  heartbeatInterval?: NodeJS.Timeout
): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  try {
    await writer.close();
  } catch (error) {
    // Stream might already be closed
    console.error('[Streaming] Error closing writer:', error);
  }
}