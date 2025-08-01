/**
 * Utility functions for normalizing and categorizing subsidy data
 */

import type { PurposeFilter } from '~/types/enhanced-filter';

// キーワードマッピング（説明文から目的カテゴリーを推定）
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  equipment: [
    '設備投資', '機械', '設備', '工具', '器具', 'システム導入', '設備購入',
    '設備更新', '生産設備', '製造設備', 'リターナブル容器'
  ],
  employment: [
    '雇用', '人材', '採用', '人材確保', '人材育成', '従業員', 'スタッフ',
    '研修', '教育', 'トレーニング', '就労', '雇用創出'
  ],
  research: [
    '研究開発', '研究', '開発', 'R&D', '技術開発', '新技術', '実証実験',
    '試作', 'プロトタイプ', '技術革新'
  ],
  expansion: [
    '販路拡大', '販路開拓', 'PR', 'マーケティング', '販売促進', '広告',
    '展示会', '見本市', '海外進出', '輸出', 'EC', 'オンライン'
  ],
  startup: [
    '創業', '起業', 'スタートアップ', 'ベンチャー', '新事業', '新規事業',
    '事業立ち上げ', '開業', '独立', '新分野'
  ],
  digitalization: [
    'IT', 'ICT', 'DX', 'デジタル', 'システム', 'ソフトウェア', 'アプリ',
    'IoT', 'AI', '人工知能', 'クラウド', 'テレワーク', 'リモート'
  ],
  environment: [
    '環境', 'エネルギー', '省エネ', '再生可能', 'CO2', '脱炭素', 'SDGs',
    'リサイクル', 'エコ', 'グリーン', '太陽光', '蓄電池'
  ],
  welfare: [
    '福祉', '健康', '医療', '介護', 'ヘルスケア', 'ウェルネス', '高齢者',
    '障害者', 'バリアフリー', 'ワクチン', '保健', '衛生'
  ]
};

// 企業規模キーワード
const COMPANY_SIZE_KEYWORDS = {
  micro: ['個人事業', '個人', 'フリーランス', 'マイクロ'],
  small: ['小規模', '小企業', '従業員20名以下', '従業員50名以下'],
  medium: ['中小企業', '中堅企業', 'SME', '従業員300名以下'],
  large: ['大企業', '大手企業', '上場企業']
};

// 特別条件キーワード
const SPECIAL_CONDITION_KEYWORDS = {
  woman_owned: ['女性経営', '女性起業', '女性代表', '女性活躍'],
  young_entrepreneur: ['若手起業', '39歳以下', '35歳以下', '青年', 'U-40'],
  succession: ['事業承継', '後継者', '事業継承', 'M&A', '第二創業'],
  nonprofit: ['NPO', '非営利', '一般社団', '一般財団', '公益', 'NGO']
};

/**
 * 金額文字列を数値に変換
 */
export function parseAmountString(amountStr: string): number | null {
  if (!amountStr) return null;
  
  // 数字と単位を抽出
  const normalized = amountStr
    .replace(/[\s,，]/g, '') // スペースとカンマを除去
    .replace(/円/g, '');     // 円を除去
  
  // 億の処理
  const okuMatch = normalized.match(/(\d+(?:\.\d+)?)\s*億/);
  if (okuMatch) {
    return parseFloat(okuMatch[1]) * 100000000;
  }
  
  // 万の処理
  const manMatch = normalized.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10000;
  }
  
  // 通常の数値
  const numberMatch = normalized.match(/(\d+)/);
  if (numberMatch) {
    return parseInt(numberMatch[1]);
  }
  
  return null;
}

/**
 * 説明文からカテゴリーを推定
 */
export function inferCategories(text: string): string[] {
  const categories: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      categories.push(category);
    }
  }
  
  // カテゴリーが見つからない場合は「その他」
  if (categories.length === 0) {
    categories.push('other');
  }
  
  return categories;
}

/**
 * 説明文から企業規模を推定
 */
export function inferCompanySize(text: string): string | null {
  for (const [size, keywords] of Object.entries(COMPANY_SIZE_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return size;
    }
  }
  
  // 従業員数の明示的な記載をチェック
  const employeeMatch = text.match(/従業員(\d+)名/);
  if (employeeMatch) {
    const count = parseInt(employeeMatch[1]);
    if (count <= 5) return 'micro';
    if (count <= 20) return 'small';
    if (count <= 300) return 'medium';
    return 'large';
  }
  
  return null;
}

/**
 * 説明文から特別条件を推定
 */
export function inferSpecialConditions(text: string): string[] {
  const conditions: string[] = [];
  
  for (const [condition, keywords] of Object.entries(SPECIAL_CONDITION_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      conditions.push(condition);
    }
  }
  
  return conditions;
}

/**
 * 補助率の文字列から数値を抽出
 */
export function parseSubsidyRate(rateStr: string): { min: number; max: number } | null {
  if (!rateStr) return null;
  
  // パーセント表記を探す
  const percentMatches = rateStr.matchAll(/(\d+(?:\.\d+)?)\s*[%％]/g);
  const rates: number[] = [];
  
  for (const match of percentMatches) {
    rates.push(parseFloat(match[1]));
  }
  
  // 分数表記を探す（例: 1/2, 2/3）
  const fractionMatch = rateStr.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const rate = (parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])) * 100;
    rates.push(rate);
  }
  
  if (rates.length === 0) return null;
  
  return {
    min: Math.min(...rates),
    max: Math.max(...rates)
  };
}

/**
 * 日付文字列を解析
 */
export function parseDateString(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'null') return null;
  
  // ISO形式
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(dateStr);
  }
  
  // 和暦形式（令和7年4月1日）
  const warekiMatch = dateStr.match(/令和(\d+)年(\d+)月(\d+)日/);
  if (warekiMatch) {
    const year = 2019 + parseInt(warekiMatch[1]) - 1;
    const month = parseInt(warekiMatch[2]) - 1;
    const day = parseInt(warekiMatch[3]);
    return new Date(year, month, day);
  }
  
  // 西暦形式（2025年4月1日）
  const seirekiMatch = dateStr.match(/(\d{4})年(\d+)月(\d+)日/);
  if (seirekiMatch) {
    const year = parseInt(seirekiMatch[1]);
    const month = parseInt(seirekiMatch[2]) - 1;
    const day = parseInt(seirekiMatch[3]);
    return new Date(year, month, day);
  }
  
  return null;
}

/**
 * 申請期限ステータスを判定
 */
export function getDeadlineStatus(
  startDate: Date | null,
  endDate: Date | null
): 'accepting' | 'upcoming' | 'closed' | null {
  const now = new Date();
  
  if (!endDate) return null;
  
  if (endDate < now) {
    return 'closed';
  }
  
  if (startDate && startDate > now) {
    return 'upcoming';
  }
  
  return 'accepting';
}

/**
 * スクレイピングデータを正規化
 */
export function normalizeSubsidyData(rawData: any): any {
  const amount = parseAmountString(rawData.subsidy_max_limit?.toString() || rawData.maxAmount || '');
  const categories = inferCategories(rawData.detail || rawData.description || '');
  const companySize = inferCompanySize(rawData.detail || rawData.description || '');
  const specialConditions = inferSpecialConditions(rawData.detail || rawData.description || '');
  const subsidyRate = parseSubsidyRate(rawData.subsidy_rate || '');
  const startDate = parseDateString(rawData.acceptance_start_datetime);
  const endDate = parseDateString(rawData.acceptance_end_datetime);
  const deadlineStatus = getDeadlineStatus(startDate, endDate);
  
  return {
    ...rawData,
    // 正規化されたフィールド
    normalized: {
      amount: amount,
      categories: categories,
      companySize: companySize,
      specialConditions: specialConditions,
      subsidyRate: subsidyRate,
      startDate: startDate,
      endDate: endDate,
      deadlineStatus: deadlineStatus
    }
  };
}