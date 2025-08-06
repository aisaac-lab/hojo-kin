import { useState, useRef, useEffect } from 'react';
import { Form, useFetcher } from '@remix-run/react';
import { Message } from './Message';
import { EnhancedFilterPanel } from './EnhancedFilterPanel';
import { Button } from './ui/Button';
import type { Message as MessageData, ChatResponse } from '~/types/chat';
import type { EnhancedSubsidyFilter, EnhancedFilterState } from '~/types/enhanced-filter';

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<EnhancedFilterState>({
    isOpen: false,
    filters: {},
    activeSection: 'basic'
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetcher = useFetcher<ChatResponse>();
  const lastProcessedResponse = useRef<string>('');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Derived state - no need for separate isLoading state
  const isLoading = fetcher.state === 'submitting' || fetcher.state === 'loading' || isStreaming;

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle fetcher response (fallback for non-streaming)
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success && fetcher.data.messages && fetcher.data.messages.length > 0) {
      // Use the responseId from the server if available, otherwise create one
      const responseId = fetcher.data.responseId || `${fetcher.data.threadId}-${fetcher.data.messages[0]}-${Date.now()}`;
      
      // Only process if we haven't seen this exact response before
      if (responseId !== lastProcessedResponse.current) {
        lastProcessedResponse.current = responseId;
        
        console.log('[ChatInterface] Processing response with ID:', responseId);
        console.log('[ChatInterface] Message count in response:', fetcher.data.messages.length);
        console.log('[ChatInterface] First message preview:', fetcher.data.messages[0].substring(0, 100) + '...');
        
        if (fetcher.data.threadId) {
          setThreadId(fetcher.data.threadId);
        }
        
        // 検証ループで複数のメッセージが返された場合は最初のもののみを使用
        const assistantMessage: MessageData = {
          role: 'assistant',
          content: fetcher.data.messages[0],
        };
        
        // 既存のメッセージと比較して重複を確認
        const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content === assistantMessage.content) {
          console.log('[ChatInterface] WARNING: Duplicate message detected, skipping');
          return;
        }
        
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.log('[ChatInterface] Skipping duplicate response with ID:', responseId);
      }
    }
  }, [fetcher.state, fetcher.data]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleStreamingSubmit = async (currentInput: string) => {
    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsStreaming(true);
    setStreamingMessage('');

    // Create form data for streaming request
    const formData = new FormData();
    formData.append('message', currentInput);
    formData.append('threadId', threadId || '');
    formData.append('userId', 'demo-user');
    formData.append('filters', JSON.stringify(filterState.filters));

    // Convert FormData to URLSearchParams for EventSource
    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      params.append(key, value.toString());
    });

    // Create EventSource with POST body (using polyfill or fetch + ReadableStream)
    // For now, we'll use a POST request with fetch API for better compatibility
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let currentThreadId = threadId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.threadId && !currentThreadId) {
                currentThreadId = data.threadId;
                setThreadId(data.threadId);
              }

              if (data.content) {
                setStreamingMessage(prev => prev + data.content);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          } else if (line.startsWith('event: ')) {
            const event = line.slice(7);
            
            if (event === 'complete') {
              // Add the complete message to messages
              setStreamingMessage(current => {
                if (current) {
                  setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: current
                  }]);
                }
                return '';
              });
              setIsStreaming(false);
            } else if (event === 'error') {
              console.error('Streaming error received');
              setIsStreaming(false);
              // Fallback to regular submission
              handleRegularSubmit(currentInput);
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      setIsStreaming(false);
      setStreamingMessage('');
      // Fallback to regular submission
      handleRegularSubmit(currentInput);
    }
  };

  const handleRegularSubmit = (currentInput: string) => {
    // Submit to API
    const formData = new FormData();
    formData.append('message', currentInput);
    formData.append('threadId', threadId || '');
    formData.append('userId', 'demo-user');
    formData.append('filters', JSON.stringify(filterState.filters));
    
    fetcher.submit(formData, {
      method: 'post',
      action: '/api/chat',
      encType: 'multipart/form-data',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: MessageData = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Try streaming first, with fallback to regular submission
    await handleStreamingSubmit(currentInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFiltersChange = (filters: EnhancedSubsidyFilter) => {
    setFilterState(prev => ({ ...prev, filters }));
  };

  const toggleFilterPanel = () => {
    setFilterState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  };

  const handleReset = () => {
    setMessages([]);
    setThreadId(null);
    setFilterState({ isOpen: false, filters: {}, activeSection: 'basic' });
    lastProcessedResponse.current = '';
    setStreamingMessage('');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">補助金検索アシスタント</h1>
        {threadId && (
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
          >
            新しいチャット
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      <EnhancedFilterPanel
        filters={filterState.filters}
        onFiltersChange={handleFiltersChange}
        isOpen={filterState.isOpen}
        onToggle={toggleFilterPanel}
      />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-lg mx-auto px-4">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">補助金検索アシスタント</h2>
              <p className="text-gray-700 mb-8">
                AIアシスタントがあなたのビジネスに最適な補助金・助成金を提案します
              </p>
              
              <div className="grid gap-4 text-left">
                <div className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => setInput('スタートアップ向けの補助金を教えて')}>
                  <h3 className="font-semibold mb-2 text-gray-900">💡 スタートアップ支援</h3>
                  <p className="text-sm text-gray-700">
                    スタートアップ向けの補助金を教えて
                  </p>
                </div>
                
                <div className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => setInput('IT企業が使える助成金はある？')}>
                  <h3 className="font-semibold mb-2 text-gray-900">💻 IT・テクノロジー</h3>
                  <p className="text-sm text-gray-700">
                    IT企業が使える助成金はある？
                  </p>
                </div>
                
                <div className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => setInput('研究開発の補助金について知りたい')}>
                  <h3 className="font-semibold mb-2 text-gray-900">🔬 研究開発</h3>
                  <p className="text-sm text-gray-700">
                    研究開発の補助金について知りたい
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          {messages.map((message, index) => (
            <Message
              key={`${message.role}-${index}`}
              role={message.role}
              content={message.content}
            />
          ))}

          {/* Streaming message */}
          {streamingMessage && (
            <Message
              role="assistant"
              content={streamingMessage}
            />
          )}

          {isLoading && !streamingMessage && (
            <div className="bg-gray-50">
              <div className="flex p-4 gap-4 text-base md:gap-6 md:max-w-2xl lg:max-w-[38rem] xl:max-w-3xl md:py-6 lg:px-0 m-auto">
                <div className="flex-shrink-0 flex flex-col relative items-end">
                  <div className="relative flex h-8 w-8 rounded-sm items-center justify-center text-white bg-emerald-600">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 15v1a1 1 0 0 1-2 0v-1c-1.654 0-3-1.346-3-3a1 1 0 0 1 2 0c0 .551.449 1 1 1h2c.551 0 1-.449 1-1s-.449-1-1-1H9c-1.654 0-3-1.346-3-3s1.346-3 3-3V4a1 1 0 0 1 2 0v1c1.654 0 3 1.346 3 3a1 1 0 0 1-2 0c0-.551-.449-1-1-1H9c-.551 0-1 .449-1 1s.449 1 1 1h2c1.654 0 3 1.346 3 3s-1.346 3-3 3z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                <div className="relative flex w-full flex-col gap-1 md:gap-3 lg:w-[calc(100%-115px)]">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white">
        <Form onSubmit={handleSubmit} className="m-2 md:m-4">
          <div className="relative flex flex-col w-full flex-grow p-4 border border-gray-300 rounded-lg shadow-sm focus-within:border-gray-400 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力..."
              className="m-0 w-full resize-none border-0 bg-transparent p-0 pr-10 focus:ring-0 focus-visible:ring-0 md:pr-12 max-h-[200px] outline-none text-gray-900 placeholder-gray-500"
              style={{ height: '24px' }}
              disabled={isLoading}
              rows={1}
            />
            
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              variant="ghost"
              size="sm"
              className="absolute bottom-3 right-3 !p-1"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </Button>
          </div>
          
          <div className="px-4 py-2 text-center text-xs text-gray-600 space-y-1">
            <span className="block">Shift+Enterで送信 / Enterで改行</span>
            <span className="block">AIが提供する情報は参考情報です。最新情報は各補助金の公式サイトでご確認ください。</span>
          </div>
        </Form>
      </div>
    </div>
  );
}