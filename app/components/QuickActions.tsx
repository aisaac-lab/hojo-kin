import { useState } from 'react';

interface QuickAction {
  id: string;
  label: string;
  query: string;
  icon: string;
  category: string;
}

interface QuickActionsProps {
  onActionClick: (query: string) => void;
  isLoading?: boolean;
}

const quickActions: QuickAction[] = [
  {
    id: 'startup',
    label: 'スタートアップ支援',
    query: 'スタートアップ向けの補助金を教えてください',
    icon: '🚀',
    category: '起業・創業'
  },
  {
    id: 'it',
    label: 'IT・DX推進',
    query: 'IT企業やDX推進のための補助金を教えてください',
    icon: '💻',
    category: 'テクノロジー'
  },
  {
    id: 'research',
    label: '研究開発',
    query: '研究開発や技術開発のための補助金を教えてください',
    icon: '🔬',
    category: '研究・開発'
  },
  {
    id: 'equipment',
    label: '設備投資',
    query: '設備投資や機械導入のための補助金を教えてください',
    icon: '🏭',
    category: '設備・投資'
  },
  {
    id: 'hiring',
    label: '人材育成・雇用',
    query: '人材育成や雇用拡大のための補助金を教えてください',
    icon: '👥',
    category: '人材'
  },
  {
    id: 'overseas',
    label: '海外展開',
    query: '海外展開や輸出促進のための補助金を教えてください',
    icon: '🌍',
    category: '国際化'
  },
  {
    id: 'environment',
    label: '環境・エネルギー',
    query: '環境対策や省エネのための補助金を教えてください',
    icon: '🌱',
    category: 'SDGs'
  },
  {
    id: 'region',
    label: '地域活性化',
    query: '地域活性化や観光振興のための補助金を教えてください',
    icon: '🏘️',
    category: '地域振興'
  }
];

export function QuickActions({ onActionClick, isLoading = false }: QuickActionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(quickActions.map(action => action.category))];
  const filteredActions = selectedCategory
    ? quickActions.filter(action => action.category === selectedCategory)
    : quickActions;

  return (
    <div className="w-full">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            selectedCategory === null
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          すべて
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {filteredActions.map((action) => (
          <button
            key={action.id}
            onClick={() => !isLoading && onActionClick(action.query)}
            disabled={isLoading}
            className={`
              group relative p-4 bg-white border border-gray-200 rounded-lg
              hover:border-blue-500 hover:shadow-md transition-all
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <span className="text-2xl">{action.icon}</span>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                {action.label}
              </span>
            </div>
            
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {action.query.substring(0, 30)}...
            </div>
          </button>
        ))}
      </div>

      {/* Popular searches */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          🔥 よく検索される補助金
        </h3>
        <div className="flex flex-wrap gap-2">
          {['ものづくり補助金', 'IT導入補助金', '事業再構築補助金', '小規模事業者持続化補助金'].map(
            (keyword) => (
              <button
                key={keyword}
                onClick={() => !isLoading && onActionClick(`${keyword}について詳しく教えてください`)}
                disabled={isLoading}
                className="px-3 py-1 bg-white text-sm text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
              >
                {keyword}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}