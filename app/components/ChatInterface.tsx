import { useState, useRef, useEffect } from 'react';
import { Form, useFetcher } from '@remix-run/react';
import { Message } from './Message';
import { EnhancedFilterPanel } from './EnhancedFilterPanel';
import type { Message as MessageData, ChatResponse } from '~/types/chat';
import type { EnhancedSubsidyFilter, EnhancedFilterState } from '~/types/enhanced-filter';

export function ChatInterface() {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterState, setFilterState] = useState<EnhancedFilterState>({
    isOpen: false,
    filters: {},
    activeSection: 'basic'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fetcher = useFetcher<ChatResponse>();
  const lastProcessedDataRef = useRef<ChatResponse | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    
    // Handle loading state
    if (fetcher.state === 'submitting' || fetcher.state === 'loading') {
      // Ensure loading state is true
      if (!isLoading) {
        setIsLoading(true);
      }
    }
    
    // Handle response when fetcher completes
    if (fetcher.state === 'idle' && fetcher.data) {
      
      // Check if we already processed this data
      if (lastProcessedDataRef.current === fetcher.data) {
        return;
      }
      
      // Mark as processed
      lastProcessedDataRef.current = fetcher.data;
      
      // Process the response
      if (fetcher.data.success !== false) {
        if (fetcher.data.threadId) {
          setThreadId(fetcher.data.threadId);
        }
        
        if (fetcher.data.messages && fetcher.data.messages.length > 0) {
          const assistantMessage: MessageData = {
            role: 'assistant',
            content: fetcher.data.messages[0],
            timestamp: new Date(),
          };
          setMessages((prev) => {
            return [...prev, assistantMessage];
          });
        } else {
        }
      } else if (fetcher.data.error) {
        console.error('ChatInterface - Error in response:', fetcher.data.error);
        // You might want to show an error message to the user here
      }
      
      // Always clear loading state when idle
      setIsLoading(false);
    }
  }, [fetcher, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: MessageData = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }


    // Create FormData for Remix fetcher
    const formData = new FormData();
    console.log('[ChatInterface] Submitting message:', currentInput);
    formData.append('message', currentInput);
    formData.append('threadId', threadId || '');
    formData.append('userId', 'demo-user');
    formData.append('filters', JSON.stringify(filterState.filters));
    
    fetcher.submit(
      formData,
      {
        method: 'post',
        action: '/api/chat',
        encType: 'multipart/form-data',
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enterで送信、Enterのみは改行
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

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">補助金検索アシスタント</h1>
        {threadId && (
          <button
            onClick={() => {
              setMessages([]);
              setThreadId(null);
              setFilterState({ isOpen: false, filters: {} });
            }}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            新しいチャット
          </button>
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
        {messages.length === 0 && (
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
              key={index}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
            />
          ))}

          {isLoading && (
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
            
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute p-1 rounded-md bottom-3 right-3 text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
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