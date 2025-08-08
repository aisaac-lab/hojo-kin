import { useEffect, useState } from 'react';

interface LoadingIndicatorProps {
  isStreaming?: boolean;
  message?: string;
}

export function LoadingIndicator({ isStreaming = false, message }: LoadingIndicatorProps) {
  const [dots, setDots] = useState('');
  const [loadingPhase, setLoadingPhase] = useState(0);
  
  const loadingMessages = [
    '補助金データベースを検索中',
    '条件に合う補助金を分析中',
    '最適な提案を準備中',
    'まもなく結果を表示します',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isStreaming) {
      const phaseInterval = setInterval(() => {
        setLoadingPhase(prev => (prev + 1) % loadingMessages.length);
      }, 2000);
      return () => clearInterval(phaseInterval);
    }
  }, [isStreaming]);

  if (isStreaming) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm font-medium text-gray-700">
            AIアシスタントが回答を生成中...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="space-y-4">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {message || loadingMessages[loadingPhase]}{dots}
          </span>
          <span className="text-xs text-gray-500">
            {Math.min(25 * (loadingPhase + 1), 100)}%
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(25 * (loadingPhase + 1), 100)}%` }}
          />
        </div>

        {/* Skeleton content */}
        <div className="space-y-3 mt-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>

        {/* Tips while waiting */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            💡 ヒント: より具体的な条件（地域、業種、金額など）を指定すると、より精度の高い結果が得られます
          </p>
        </div>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-3 animate-pulse">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="flex space-x-2 mt-3">
            <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            <div className="h-6 bg-gray-200 rounded-full w-24"></div>
            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          </div>
        </div>
      </div>
    </div>
  );
}