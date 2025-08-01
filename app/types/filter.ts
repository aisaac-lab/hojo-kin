/**
 * Filter types for subsidy search functionality
 */

export interface SubsidyFilter {
  // 地域フィルター
  region?: string;
  
  // 補助金額範囲
  amountRange?: {
    min?: number;
    max?: number;
  };
  
  // 従業員数
  employeeCount?: 'no_limit' | 'under_50' | 'under_300' | 'over_300';
  
  // 申請期限
  deadline?: {
    from?: Date;
    to?: Date;
  };
  
  // カテゴリー
  categories?: string[];
  
  // 現在受付中のみ
  activeOnly?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterState {
  isOpen: boolean;
  filters: SubsidyFilter;
}

// 補助金額の範囲オプション
export const AMOUNT_RANGES = [
  { value: 'all', label: 'すべて' },
  { value: 'under_1m', label: '〜100万円' },
  { value: '1m_5m', label: '100万円〜500万円' },
  { value: '5m_10m', label: '500万円〜1000万円' },
  { value: 'over_10m', label: '1000万円以上' },
];

// 従業員数オプション
export const EMPLOYEE_COUNT_OPTIONS = [
  { value: 'no_limit', label: '制限なし' },
  { value: 'under_50', label: '50名以下' },
  { value: 'under_300', label: '300名以下' },
  { value: 'over_300', label: '300名以上' },
];

// カテゴリーオプション
export const CATEGORY_OPTIONS = [
  { value: 'it', label: 'IT導入' },
  { value: 'manufacturing', label: 'ものづくり' },
  { value: 'startup', label: '創業支援' },
  { value: 'succession', label: '事業承継' },
  { value: 'employment', label: '雇用・人材' },
  { value: 'rd', label: '研究開発' },
  { value: 'overseas', label: '海外展開' },
  { value: 'environment', label: '環境・エネルギー' },
];