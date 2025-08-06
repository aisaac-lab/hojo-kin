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
import { generateAutoFilter } from '~/utils/auto-filter';
import { messageRepository } from '~/utils/database-simple';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Parse request body
  const formData = await request.formData();
  const message = formData.get('message')?.toString() || '';
  const threadId = formData.get('threadId')?.toString() || '';
  const userId = formData.get('userId')?.toString() || '';
  const filtersStr = formData.get('filters')?.toString() || '{}';
  const filters = JSON.parse(filtersStr);

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
  const parts: string[] = [];
  
  // Build filter context
  let filterContext = '';
  if (filters.purpose?.mainCategories?.length > 0 || filters.purpose?.keywords?.length > 0) {
    filterContext += '\n【ユーザーの関心分野】';
    if (filters.purpose.mainCategories?.length > 0) {
      filterContext += `\nカテゴリー: ${filters.purpose.mainCategories.join(', ')}`;
    }
    if (filters.purpose.keywords?.length > 0) {
      filterContext += `\nキーワード: ${filters.purpose.keywords.join(', ')}`;
    }
  }
  
  if (filters.company?.employeeCount) {
    filterContext += '\n【企業規模】';
    if (filters.company.employeeCount.min && filters.company.employeeCount.max) {
      filterContext += `\n従業員数: ${filters.company.employeeCount.min}〜${filters.company.employeeCount.max}名`;
    } else if (filters.company.employeeCount.max) {
      filterContext += `\n従業員数: ${filters.company.employeeCount.max}名以下`;
    } else if (filters.company.employeeCount.min) {
      filterContext += `\n従業員数: ${filters.company.employeeCount.min}名以上`;
    }
  }
  
  const baseInstructions = `
【最重要】file_search ツールを使用して補助金データを検索してください。

【検索の具体例】
Q: "IT企業で社員数50名以内の助成金を列挙する"

【重要】検索手順:
1. subsidies-master.json または subsidies-enhanced.json から条件に合う補助金を検索
2. 複数の結果がある場合は、マッチ度の高い順に整理
3. 各補助金について以下の情報を含める：
   - 補助金名
   - 対象者
   - 補助金額
   - 補助率
   - 申請期限
   - URL（データに含まれる場合のみ）

【応答形式】
申請可能な補助金は〇件です。

【内訳】
- カテゴリー1: ○件
- カテゴリー2: ○件

条件に合う補助金は以下の通りです。

【マッチ度の高い上位N件】
1. **補助金名**（マッチ度: ○点/100点）
   - 内訳：地域(○/30)、カテゴリー(○/25)、金額(○/20)、企業規模(○/15)、その他(○/10)
   - 対象者：[具体的な対象者]
   - 補助金額：上限○円
   - 補助率：○%
   - 申請期限：○年○月○日
   - URL：[公式サイトURL]

URLに関する注意事項：
- 公式サイトのURLを求められた場合、データに含まれているURLを正確に提示する
- URLが不明な場合は「URLは現在のデータに含まれていません」と明記する
- 推測や一般的なURLを提供しない

常に日本語で、丁寧かつ分かりやすく回答してください。${filterContext}
`;
  
  return baseInstructions;
}