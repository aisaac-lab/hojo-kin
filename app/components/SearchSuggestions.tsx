import { useState, useEffect, useRef } from 'react';

interface SearchSuggestionsProps {
  inputValue: string;
  onSuggestionClick: (suggestion: string) => void;
  isVisible: boolean;
}

// 検索キーワードのサジェストデータ
const suggestionData = {
  keywords: [
    'ものづくり補助金',
    'IT導入補助金',
    '事業再構築補助金',
    '小規模事業者持続化補助金',
    '雇用調整助成金',
    'キャリアアップ助成金',
    '創業支援補助金',
    '研究開発助成金',
    '設備投資補助金',
    '省エネ補助金',
    '海外展開支援補助金',
    '農業補助金',
    '観光振興補助金',
    '地域活性化補助金',
    'DX推進補助金'
  ],
  conditions: [
    '従業員10名以下',
    '従業員50名以下',
    '資本金1000万円以下',
    '創業3年以内',
    '製造業',
    'サービス業',
    '小売業',
    '飲食業',
    'IT企業',
    'スタートアップ'
  ],
  regions: [
    '東京都',
    '大阪府',
    '愛知県',
    '神奈川県',
    '福岡県',
    '北海道',
    '京都府',
    '兵庫県',
    '埼玉県',
    '千葉県'
  ],
  purposes: [
    '設備投資',
    '人材育成',
    '研究開発',
    '販路開拓',
    '生産性向上',
    'デジタル化',
    '環境対策',
    '国際展開',
    '事業承継',
    '働き方改革'
  ]
};

export function SearchSuggestions({ 
  inputValue, 
  onSuggestionClick, 
  isVisible 
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    const lowerInput = inputValue.toLowerCase();
    const allSuggestions = [
      ...suggestionData.keywords,
      ...suggestionData.conditions,
      ...suggestionData.regions,
      ...suggestionData.purposes
    ];

    // Filter and sort suggestions
    const filtered = allSuggestions
      .filter(item => item.toLowerCase().includes(lowerInput))
      .sort((a, b) => {
        // Prioritize exact starts
        const aStarts = a.toLowerCase().startsWith(lowerInput);
        const bStarts = b.toLowerCase().startsWith(lowerInput);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.length - b.length;
      })
      .slice(0, 8);

    // Add smart suggestions based on input
    const smartSuggestions: string[] = [];
    
    if (lowerInput.includes('補助金')) {
      smartSuggestions.push(`${inputValue} 申請方法`);
      smartSuggestions.push(`${inputValue} 対象企業`);
      smartSuggestions.push(`${inputValue} 申請期限`);
    }
    
    if (lowerInput.includes('企業') || lowerInput.includes('会社')) {
      smartSuggestions.push('中小企業向け補助金');
      smartSuggestions.push('スタートアップ向け補助金');
    }

    setSuggestions([...filtered, ...smartSuggestions].slice(0, 10));
  }, [inputValue]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isVisible || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          e.preventDefault();
          onSuggestionClick(suggestions[highlightedIndex]);
          setHighlightedIndex(-1);
        }
        break;
      case 'Escape':
        setHighlightedIndex(-1);
        setSuggestions([]);
        break;
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, highlightedIndex, isVisible]);

  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div 
      ref={suggestionsRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50"
    >
      <div className="p-2">
        <div className="text-xs font-semibold text-gray-500 px-3 py-2">
          検索候補
        </div>
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            onClick={() => {
              onSuggestionClick(suggestion);
              setHighlightedIndex(-1);
            }}
            className={`
              w-full text-left px-3 py-2 rounded-md text-sm
              transition-colors cursor-pointer
              ${highlightedIndex === index 
                ? 'bg-blue-50 text-blue-700' 
                : 'hover:bg-gray-50 text-gray-700'}
            `}
          >
            <div className="flex items-center justify-between">
              <span>{suggestion}</span>
              <svg 
                className="w-4 h-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5l7 7-7 7" 
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
      
      {/* Recent searches */}
      <div className="border-t border-gray-100 p-2">
        <div className="text-xs font-semibold text-gray-500 px-3 py-2">
          最近の検索
        </div>
        {['IT導入補助金', 'スタートアップ支援'].map((recent) => (
          <button
            key={recent}
            onClick={() => onSuggestionClick(recent)}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <svg 
                className="w-4 h-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span>{recent}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}