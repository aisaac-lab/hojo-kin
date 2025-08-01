import { useState } from 'react';
import { 
  AMOUNT_PRESET_RANGES,
  PURPOSE_CATEGORY_LABELS,
  COMPANY_SIZE_LABELS,
  SPECIAL_CONDITION_LABELS,
  TOKYO_CITIES
} from '~/types/enhanced-filter';
import type { 
  EnhancedSubsidyFilter, 
  EnhancedFilterState
} from '~/types/enhanced-filter';

interface EnhancedFilterPanelProps {
  filters: EnhancedSubsidyFilter;
  onFiltersChange: (filters: EnhancedSubsidyFilter) => void;
  isOpen: boolean;
  onToggle: () => void;
  subsidyCount?: number;
  isLoading?: boolean;
}

export function EnhancedFilterPanel({
  filters,
  onFiltersChange,
  isOpen,
  onToggle,
  subsidyCount,
  isLoading
}: EnhancedFilterPanelProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [customAmountRange, setCustomAmountRange] = useState({
    min: filters.amount?.min || '',
    max: filters.amount?.max || ''
  });

  const handleAreaChange = (field: string, value: any) => {
    onFiltersChange({
      ...filters,
      area: {
        ...filters.area,
        [field]: value
      }
    });
  };

  const handleCityToggle = (city: string) => {
    const currentCities = filters.area?.cities || [];
    const newCities = currentCities.includes(city)
      ? currentCities.filter(c => c !== city)
      : [...currentCities, city];
    
    handleAreaChange('cities', newCities);
  };

  const handleAmountPresetChange = (preset: string) => {
    const range = AMOUNT_PRESET_RANGES[preset];
    onFiltersChange({
      ...filters,
      amount: {
        ...filters.amount,
        presetRange: preset as any,
        min: range?.min,
        max: range?.max
      }
    });
  };

  const handleCustomAmountChange = () => {
    onFiltersChange({
      ...filters,
      amount: {
        ...filters.amount,
        min: customAmountRange.min ? Number(customAmountRange.min) : undefined,
        max: customAmountRange.max ? Number(customAmountRange.max) : undefined,
        presetRange: undefined
      }
    });
  };

  const handlePurposeCategoryToggle = (category: string) => {
    const currentCategories = filters.purpose?.mainCategories || [];
    const newCategories = currentCategories.includes(category as any)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category as any];
    
    onFiltersChange({
      ...filters,
      purpose: {
        ...filters.purpose,
        mainCategories: newCategories
      }
    });
  };

  const handleCompanySizeChange = (size: string) => {
    onFiltersChange({
      ...filters,
      company: {
        ...filters.company,
        companySize: size as any
      }
    });
  };

  const handleSpecialConditionToggle = (condition: string) => {
    const currentConditions = filters.company?.specialConditions || [];
    const newConditions = currentConditions.includes(condition as any)
      ? currentConditions.filter(c => c !== condition)
      : [...currentConditions, condition as any];
    
    onFiltersChange({
      ...filters,
      company: {
        ...filters.company,
        specialConditions: newConditions
      }
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
    setCustomAmountRange({ min: '', max: '' });
  };

  const hasActiveFilters = () => {
    return Object.keys(filters).length > 0 && 
           Object.values(filters).some(v => 
             v !== undefined && 
             (typeof v === 'object' ? Object.keys(v).length > 0 : true)
           );
  };

  if (!isOpen) {
    return (
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          フィルター
          {hasActiveFilters() && (
            <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
              適用中
            </span>
          )}
          {subsidyCount !== undefined && (
            <span className="ml-auto text-xs text-gray-500">
              {subsidyCount}件
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">検索フィルター</h3>
          <div className="flex items-center gap-2">
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                クリア
              </button>
            )}
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* タブ切り替え */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'basic'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            基本条件
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'advanced'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            詳細条件
          </button>
        </div>

        {activeTab === 'basic' ? (
          <div className="space-y-4">
            {/* 地域フィルター */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">地域</h4>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.area?.includeNationwide || false}
                    onChange={(e) => handleAreaChange('includeNationwide', e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">全国対象を含む</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TOKYO_CITIES.slice(0, 9).map(city => (
                    <label key={city} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.area?.cities?.includes(city) || false}
                        onChange={() => handleCityToggle(city)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="ml-1 text-xs text-gray-700">{city}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('advanced')}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  もっと見る →
                </button>
              </div>
            </div>

            {/* 補助金額フィルター */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">補助金額</h4>
              <div className="space-y-2">
                {Object.entries(AMOUNT_PRESET_RANGES).map(([key, range]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="radio"
                      name="amountPreset"
                      checked={filters.amount?.presetRange === key}
                      onChange={() => handleAmountPresetChange(key)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">{range.label}</span>
                  </label>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="最小金額"
                    value={customAmountRange.min}
                    onChange={(e) => setCustomAmountRange({ ...customAmountRange, min: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <span className="text-gray-500">〜</span>
                  <input
                    type="number"
                    placeholder="最大金額"
                    value={customAmountRange.max}
                    onChange={(e) => setCustomAmountRange({ ...customAmountRange, max: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <button
                    onClick={handleCustomAmountChange}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    適用
                  </button>
                </div>
              </div>
            </div>

            {/* 目的・カテゴリー */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">目的・カテゴリー</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PURPOSE_CATEGORY_LABELS).slice(0, 6).map(([key, label]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.purpose?.mainCategories?.includes(key as any) || false}
                      onChange={() => handlePurposeCategoryToggle(key)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 全地域リスト */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">東京都内の地域</h4>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {TOKYO_CITIES.map(city => (
                  <label key={city} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.area?.cities?.includes(city) || false}
                      onChange={() => handleCityToggle(city)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-1 text-xs text-gray-700">{city}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 企業規模 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">企業規模</h4>
              <div className="space-y-2">
                {Object.entries(COMPANY_SIZE_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="radio"
                      name="companySize"
                      checked={filters.company?.companySize === key}
                      onChange={() => handleCompanySizeChange(key)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 特別条件 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">特別条件</h4>
              <div className="space-y-2">
                {Object.entries(SPECIAL_CONDITION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.company?.specialConditions?.includes(key as any) || false}
                      onChange={() => handleSpecialConditionToggle(key)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 補助率フィルター */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">補助率</h4>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="最小 %"
                  min="0"
                  max="100"
                  value={filters.amount?.subsidyRate?.min || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    amount: {
                      ...filters.amount,
                      subsidyRate: {
                        ...filters.amount?.subsidyRate,
                        min: e.target.value ? Number(e.target.value) : undefined
                      }
                    }
                  })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-gray-500">〜</span>
                <input
                  type="number"
                  placeholder="最大 %"
                  min="0"
                  max="100"
                  value={filters.amount?.subsidyRate?.max || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    amount: {
                      ...filters.amount,
                      subsidyRate: {
                        ...filters.amount?.subsidyRate,
                        max: e.target.value ? Number(e.target.value) : undefined
                      }
                    }
                  })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-gray-700">%</span>
              </div>
            </div>
          </div>
        )}

        {/* 適用ボタン */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onToggle}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? '検索中...' : 'フィルターを適用'}
          </button>
        </div>
      </div>
    </div>
  );
}