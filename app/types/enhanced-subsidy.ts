/**
 * Enhanced subsidy data types with detailed metadata
 */

// 企業対象情報
export interface TargetCompanyMetadata {
  // 従業員数
  employeeCount?: {
    min?: number;
    max?: number;
  };
  
  // 企業規模（複数選択可）
  companySize?: Array<'micro' | 'small' | 'medium' | 'large'>;
  
  // 対象業種
  industries?: string[];
  
  // 特別条件
  specialConditions?: Array<'woman_owned' | 'young_entrepreneur' | 'succession' | 'nonprofit' | 'startup'>;
  
  // 設立年数
  yearsInBusiness?: {
    min?: number;
    max?: number;
  };
}

// カテゴリー情報
export interface CategoryMetadata {
  // 主カテゴリー
  primary: 'equipment' | 'employment' | 'research' | 'expansion' | 'startup' | 'digitalization' | 'environment' | 'welfare' | 'other';
  
  // 副カテゴリー（複数選択可）
  secondary?: Array<'equipment' | 'employment' | 'research' | 'expansion' | 'startup' | 'digitalization' | 'environment' | 'welfare' | 'other'>;
  
  // 検索用キーワード
  keywords: string[];
}

// 申請詳細情報
export interface ApplicationMetadata {
  // 受付状況
  status: 'accepting' | 'upcoming' | 'closed' | 'unknown';
  
  // 締切日
  deadlineDate?: string; // ISO date format
  
  // 締切までの日数
  daysUntilDeadline?: number;
  
  // 申請方法
  applicationMethod?: 'online' | 'paper' | 'both';
  
  // 申請期間（構造化）
  applicationPeriod?: {
    start?: string; // ISO date format
    end?: string;   // ISO date format
  };
}

// 金額詳細情報
export interface AmountMetadata {
  // 最小金額（円）
  minAmount?: number;
  
  // 最大金額（円）
  maxAmount?: number;
  
  // 補助率（最小）
  subsidyRateMin?: number; // percentage (0-100)
  
  // 補助率（最大）
  subsidyRateMax?: number; // percentage (0-100)
  
  // 対象経費の上限
  eligibleExpensesCap?: number;
}

// 地域情報
export interface AreaMetadata {
  // 都道府県
  prefectures: string[];
  
  // 市区町村
  cities?: string[];
  
  // 全国対象フラグ
  isNationwide: boolean;
  
  // 地域限定フラグ
  isRegionSpecific: boolean;
}

// 統合メタデータ
export interface SubsidyMetadata {
  // 対象企業情報
  targetCompany: TargetCompanyMetadata;
  
  // カテゴリー情報
  categoryTags: CategoryMetadata;
  
  // 申請詳細情報
  applicationDetails: ApplicationMetadata;
  
  // 金額詳細情報
  amountDetails: AmountMetadata;
  
  // 地域情報
  areaDetails: AreaMetadata;
  
  // 信頼度スコア（メタデータの完全性）
  confidenceScore?: number; // 0-100
  
  // 最終更新日
  lastUpdated: string; // ISO date format
}

// 拡張された補助金データ型
export interface EnhancedSubsidy {
  // 既存フィールド
  id: string;
  name?: string;
  title: string;
  description: string;
  maxAmount?: string;
  categories?: string[];
  detailUrl?: string;
  officialUrl?: string;
  organizationName?: string;
  targetArea: string;
  applicationPeriod?: string;
  subsidyRate?: string;
  targetBusiness?: string;
  useCase?: string;
  front_subsidy_detail_page_url?: string;
  
  // 新規：構造化メタデータ
  metadata: SubsidyMetadata;
}

// 補助金データセット型
export interface EnhancedSubsidyDataset {
  metadata: {
    createdAt: string;
    lastUpdated: string;
    totalCount: number;
    sources: string[];
    version: string;
  };
  subsidies: EnhancedSubsidy[];
}