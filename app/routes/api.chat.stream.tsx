import type { ActionFunctionArgs } from '@remix-run/node';
import { 
  createSSEHeaders, 
  createSSEEncoderStream, 
  createHeartbeatInterval,
  closeStreamWriter,
  StreamEventType,
  type SSEMessage 
} from '~/utils/streaming';
import { AssistantService } from '~/services/assistant.service';
import { generateAutoFilter, buildEnhancedInstructions as enhancedInstructionsBuilder } from '~/utils/enhanced-instructions';
import { messageRepository } from '~/utils/database-simple';

export async function loader() {
  return new Response('This endpoint only accepts POST requests', { 
    status: 405,
    headers: { 'Content-Type': 'text/plain' }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Parse request body as JSON
  let message = '';
  let threadId = '';
  let userId = '';
  let filters = {};
  
  try {
    const json = await request.json();
    message = json.message || '';
    threadId = json.threadId || '';
    userId = json.userId || '';
    filters = json.filters || {};
  } catch (error) {
    // Fallback to FormData if JSON parsing fails
    try {
      const formData = await request.formData();
      message = formData.get('message')?.toString() || '';
      threadId = formData.get('threadId')?.toString() || '';
      userId = formData.get('userId')?.toString() || '';
      const filtersStr = formData.get('filters')?.toString() || '{}';
      filters = JSON.parse(filtersStr);
    } catch {
      return new Response('Invalid request body', { status: 400 });
    }
  }

  if (!message) {
    return new Response('Message is required', { status: 400 });
  }

  // Create streaming response
  const stream = new ReadableStream<SSEMessage>({
    async start(controller) {
      let heartbeatInterval: NodeJS.Timeout | undefined;
      
      try {
        // Send initial connection event
        controller.enqueue({
          event: StreamEventType.START,
          data: JSON.stringify({ 
            message: 'Connection established',
            timestamp: Date.now() 
          }),
        });

        // Initialize assistant service
        const assistantService = new AssistantService();
        
        // Create or get thread
        let currentThreadId = threadId;
        if (!currentThreadId) {
          const thread = await assistantService.createThread(userId);
          currentThreadId = thread.id;
          
          // Send thread info
          controller.enqueue({
            event: 'thread',
            data: JSON.stringify({ threadId: currentThreadId }),
          });
        }

        // Add user message
        await assistantService.addMessage(currentThreadId, message, 'user');

        // Generate auto filters
        const autoFilters = generateAutoFilter(message);
        const effectiveFilters = { ...filters, ...autoFilters };
        
        // Build enhanced instructions
        const enhancedInstructions = buildEnhancedInstructions(effectiveFilters);

        // Run assistant with streaming
        const run = await assistantService.openaiClient.beta.threads.runs.create(
          currentThreadId,
          {
            assistant_id: process.env.OPENAI_ASSISTANT_ID!,
            additional_instructions: enhancedInstructions,
            stream: true,
          }
        );

        // Setup heartbeat to keep connection alive
        const writable = new WritableStream<SSEMessage>({
          write(chunk) {
            controller.enqueue(chunk);
          },
        });
        const writer = writable.getWriter();
        heartbeatInterval = createHeartbeatInterval(writer, 15000);

        let accumulatedContent = '';
        let messageId: string | undefined;

        // Process streaming events
        for await (const event of run) {
          if (event.event === 'thread.message.created') {
            messageId = event.data.id;
            controller.enqueue({
              event: 'message.start',
              data: JSON.stringify({ messageId }),
            });
          } else if (event.event === 'thread.message.delta') {
            const delta = event.data.delta;
            if (delta.content) {
              for (const content of delta.content) {
                if (content.type === 'text' && content.text) {
                  const chunk = content.text.value || '';
                  accumulatedContent += chunk;
                  
                  // Remove citation marks from chunk
                  const cleanChunk = chunk.replace(/【\d+:\d+†[^】]+】/g, '');
                  
                  controller.enqueue({
                    event: StreamEventType.CHUNK,
                    data: JSON.stringify({ 
                      content: cleanChunk,
                      messageId 
                    }),
                  });
                }
              }
            }
          } else if (event.event === 'thread.run.completed') {
            // Save to database
            if (messageId && accumulatedContent) {
              const result = await messageRepository.create({
                threadId: currentThreadId,
                role: 'assistant',
                content: accumulatedContent.replace(/【\d+:\d+†[^】]+】/g, ''),
              });
              
              if ('ok' in result && !result.ok) {
                console.error('[Streaming] Failed to save message:', result.error);
              }
            }

            controller.enqueue({
              event: StreamEventType.COMPLETE,
              data: JSON.stringify({ 
                success: true,
                messageId,
                threadId: currentThreadId,
              }),
            });
          } else if (event.event === 'thread.run.failed') {
            controller.enqueue({
              event: StreamEventType.ERROR,
              data: JSON.stringify({ 
                error: 'Assistant run failed',
                details: event.data.last_error,
              }),
            });
          }
        }

        // Cleanup
        await closeStreamWriter(writer, heartbeatInterval);
      } catch (error) {
        console.error('[Streaming] Error:', error);
        
        controller.enqueue({
          event: StreamEventType.ERROR,
          data: JSON.stringify({ 
            error: 'Streaming error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      } finally {
        controller.close();
      }
    },
  });

  // Transform to SSE format
  const sseStream = stream.pipeThrough(createSSEEncoderStream());
  
  return new Response(sseStream, {
    headers: createSSEHeaders(),
  });
}

function buildEnhancedInstructions(filters: any): string {
  return enhancedInstructionsBuilder(filters);
}