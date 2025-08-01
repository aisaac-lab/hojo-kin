import { useState } from 'react';
import type { SubsidyFilter, FilterState } from '~/types/filter';
import { AMOUNT_RANGES, EMPLOYEE_COUNT_OPTIONS, CATEGORY_OPTIONS } from '~/types/filter';

interface FilterPanelProps {
  filters: SubsidyFilter;
  onFiltersChange: (filters: SubsidyFilter) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function FilterPanel({ filters, onFiltersChange, isOpen, onToggle }: FilterPanelProps) {
  const handleAmountRangeChange = (value: string) => {
    let amountRange: SubsidyFilter['amountRange'] = undefined;
    
    switch (value) {
      case 'under_1m':
        amountRange = { max: 1000000 };
        break;
      case '1m_5m':
        amountRange = { min: 1000000, max: 5000000 };
        break;
      case '5m_10m':
        amountRange = { min: 5000000, max: 10000000 };
        break;
      case 'over_10m':
        amountRange = { min: 10000000 };
        break;
    }
    
    onFiltersChange({ ...filters, amountRange });
  };

  const handleEmployeeCountChange = (value: string) => {
    onFiltersChange({ 
      ...filters, 
      employeeCount: value as SubsidyFilter['employeeCount'] 
    });
  };

  const handleCategoryToggle = (category: string) => {
    const currentCategories = filters.categories || [];
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleActiveOnlyToggle = () => {
    onFiltersChange({ ...filters, activeOnly: !filters.activeOnly });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const getSelectedAmountRange = () => {
    if (!filters.amountRange) return 'all';
    const { min, max } = filters.amountRange;
    
    if (!min && max === 1000000) return 'under_1m';
    if (min === 1000000 && max === 5000000) return '1m_5m';
    if (min === 5000000 && max === 10000000) return '5m_10m';
    if (min === 10000000 && !max) return 'over_10m';
    
    return 'all';
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-sm font-medium text-gray-900">フィルター</span>
            {Object.keys(filters).length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                {Object.keys(filters).length}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
          {/* 補助金額 */}
          <div className="pt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">補助金額</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {AMOUNT_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => handleAmountRangeChange(range.value)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    getSelectedAmountRange() === range.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* 従業員数 */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">従業員数</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EMPLOYEE_COUNT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleEmployeeCountChange(option.value)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    filters.employeeCount === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* カテゴリー */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">カテゴリー</h3>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category.value}
                  onClick={() => handleCategoryToggle(category.value)}
                  className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                    filters.categories?.includes(category.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>

          {/* その他のオプション */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.activeOnly || false}
                onChange={handleActiveOnlyToggle}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-700">現在受付中のみ表示</span>
            </label>

            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              フィルターをクリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}