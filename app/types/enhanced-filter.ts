/**
 * Enhanced filter types for improved subsidy search functionality
 */

// 地域フィルター
export interface AreaFilter {
  // 都道府県レベル
  prefecture?: string; // "東京都"
  
  // 市区町村レベル
  cities?: string[]; // ["渋谷区", "港区", "新宿区"]
  
  // 全国対象フラグ
  includeNationwide?: boolean;
}

// 補助金額フィルター
export interface AmountFilter {
  // 金額範囲（数値型で管理）
  min?: number;
  max?: number;
  
  // プリセット範囲
  presetRange?: 'under_100k' | 'under_1m' | '1m_5m' | '5m_10m' | 'over_10m';
  
  // 補助率でのフィルタリング
  subsidyRate?: {
    min?: number; // 0-100 (%)
    max?: number; // 0-100 (%)
  };
}

// カテゴリー・目的フィルター
export interface PurposeFilter {
  // 主要カテゴリー
  mainCategories?: Array<
    | 'equipment' // 設備投資
    | 'employment' // 人材・雇用
    | 'research' // 研究開発
    | 'expansion' // 販路拡大・PR
    | 'startup' // 創業・新事業
    | 'digitalization' // DX・IT導入
    | 'environment' // 環境・エネルギー
    | 'welfare' // 福祉・健康
    | 'other'
  >;
  
  // キーワード検索（説明文やタイトルから）
  keywords?: string[];
  
  // タグベース（categoriesフィールドから）
  tags?: string[]; // ["おすすめ", "人気", etc.]
}

// 申請期限フィルター
export interface DeadlineFilter {
  // 受付状況
  status?: 'accepting' | 'upcoming' | 'closed';
  
  // 期限までの日数
  daysUntilDeadline?: {
    min?: number;
    max?: number;
  };
  
  // 特定期間内
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

// 企業属性フィルター
export interface CompanyFilter {
  // 業種（説明文から推定）
  estimatedIndustries?: string[];
  
  // 企業規模
  companySize?: 'micro' | 'small' | 'medium' | 'large' | 'any';
  
  // 従業員数
  employeeCount?: {
    min?: number;
    max?: number;
  };
  
  // 設立年数（スタートアップ向けなど）
  yearsInBusiness?: {
    min?: number;
    max?: number;
  };
  
  // 特別条件
  specialConditions?: Array<
    | 'woman_owned' // 女性経営
    | 'young_entrepreneur' // 若手起業家
    | 'succession' // 事業承継
    | 'nonprofit' // NPO・非営利
  >;
}

// 統合フィルターインターフェース
export interface EnhancedSubsidyFilter {
  // 地域
  area?: AreaFilter;
  
  // 金額・補助率
  amount?: AmountFilter;
  
  // 目的・カテゴリー
  purpose?: PurposeFilter;
  
  // 申請期限
  deadline?: DeadlineFilter;
  
  // 企業属性
  company?: CompanyFilter;
  
  // ソート順
  sortBy?: 'relevance' | 'amount_desc' | 'amount_asc' | 'deadline_asc' | 'newest';
  
  // ページネーション
  pagination?: {
    page: number;
    limit: number;
  };
}

// フィルター状態管理
export interface EnhancedFilterState {
  isOpen: boolean;
  filters: EnhancedSubsidyFilter;
  activeSection?: 'basic' | 'advanced'; // 基本/詳細フィルターの切り替え
}

// フィルターオプション（UI表示用）
export interface EnhancedFilterOption {
  value: string;
  label: string;
  count?: number;
  description?: string;
}

// プリセット金額範囲の定義
export const AMOUNT_PRESET_RANGES: Record<string, { label: string; min?: number; max?: number }> = {
  'under_100k': { label: '〜10万円', max: 100000 },
  'under_1m': { label: '〜100万円', max: 1000000 },
  '1m_5m': { label: '100万円〜500万円', min: 1000000, max: 5000000 },
  '5m_10m': { label: '500万円〜1000万円', min: 5000000, max: 10000000 },
  'over_10m': { label: '1000万円以上', min: 10000000 },
};

// カテゴリーラベル
export const PURPOSE_CATEGORY_LABELS: Record<string, string> = {
  'equipment': '設備投資',
  'employment': '人材・雇用',
  'research': '研究開発',
  'expansion': '販路拡大・PR',
  'startup': '創業・新事業',
  'digitalization': 'DX・IT導入',
  'environment': '環境・エネルギー',
  'welfare': '福祉・健康',
  'other': 'その他',
};

// 企業規模ラベル
export const COMPANY_SIZE_LABELS: Record<string, string> = {
  'micro': '個人事業主・マイクロ法人',
  'small': '小規模事業者',
  'medium': '中小企業',
  'large': '大企業',
  'any': '規模不問',
};

// 特別条件ラベル
export const SPECIAL_CONDITION_LABELS: Record<string, string> = {
  'woman_owned': '女性経営',
  'young_entrepreneur': '若手起業家',
  'succession': '事業承継',
  'nonprofit': 'NPO・非営利団体',
};

// 東京都の区リスト（よく使うもの）
export const TOKYO_CITIES = [
  '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区',
  '墨田区', '江東区', '品川区', '目黒区', '大田区', '世田谷区',
  '渋谷区', '中野区', '杉並区', '豊島区', '北区', '荒川区',
  '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区'
];