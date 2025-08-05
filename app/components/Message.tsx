import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Message as MessageProps } from '~/types/chat';

export function Message({ role, content }: MessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`group w-full ${isUser ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex p-4 gap-4 text-base md:gap-6 md:max-w-2xl lg:max-w-[38rem] xl:max-w-3xl md:py-6 lg:px-0 m-auto">
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`relative flex h-8 w-8 rounded-sm items-center justify-center text-white ${
            isUser 
              ? 'bg-blue-600' 
              : 'bg-emerald-600'
          }`}>
            {isUser ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 10C12.7614 10 15 7.76142 15 5C15 2.23858 12.7614 0 10 0C7.23858 0 5 2.23858 5 5C5 7.76142 7.23858 10 10 10Z" fill="currentColor"/>
                <path d="M10 12C4.47715 12 0 16.4772 0 22H20C20 16.4772 15.5228 12 10 12Z" fill="currentColor"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm1 15v1a1 1 0 0 1-2 0v-1c-1.654 0-3-1.346-3-3a1 1 0 0 1 2 0c0 .551.449 1 1 1h2c.551 0 1-.449 1-1s-.449-1-1-1H9c-1.654 0-3-1.346-3-3s1.346-3 3-3V4a1 1 0 0 1 2 0v1c1.654 0 3 1.346 3 3a1 1 0 0 1-2 0c0-.551-.449-1-1-1H9c-.551 0-1 .449-1 1s.449 1 1 1h2c1.654 0 3 1.346 3 3s-1.346 3-3 3z" fill="currentColor"/>
              </svg>
            )}
          </div>
        </div>
        
        <div className="relative flex w-full flex-col gap-1 md:gap-3 lg:w-[calc(100%-115px)]">
          <div className="flex flex-grow flex-col gap-3">
            <div className="min-h-[20px] flex flex-col items-start gap-4 whitespace-pre-wrap break-words">
              {isUser ? (
                <div className="text-gray-900">{content}</div>
              ) : (
                <div className="markdown prose w-full break-words prose-gray max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      pre: ({ children, ...props }) => (
                        <div className="relative">
                          <pre className="overflow-x-auto rounded-md bg-gray-900 p-4" {...props}>
                            {children}
                          </pre>
                        </div>
                      ),
                      code: ({ children, className, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        return isInline ? (
                          <code className="bg-gray-100 text-gray-900 px-1 py-0.5 rounded text-sm" {...props}>
                            {children}
                          </code>
                        ) : (
                          <code className={className} {...props}>{children}</code>
                        );
                      },
                      ul: ({ children }) => (
                        <ul className="list-disc pl-6 space-y-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-6 space-y-2">{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li className="pl-1">{children}</li>
                      ),
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h3>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-4 py-2 italic text-gray-700">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto">
                          <table className="border-collapse border border-gray-300">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-300 px-4 py-2 bg-gray-100 text-gray-900 font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 px-4 py-2 text-gray-900">
                          {children}
                        </td>
                      ),
                      a: ({ children, href, ...props }) => (
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}