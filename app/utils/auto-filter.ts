import type { EnhancedSubsidyFilter, AmountFilter, AreaFilter } from '~/types/enhanced-filter';
import categoriesData from '../../data/subsidies/subsidy-categories.json';
import { TOKYO_CITIES, AMOUNT_PRESET_RANGES } from '~/types/enhanced-filter';

/**
 * ユーザーの質問から自動的にフィルターを生成する
 * subsidy-categories.jsonを参照してカテゴリーマッチングを行う
 */
export function generateAutoFilter(message: string): EnhancedSubsidyFilter | null {
  const lowerMessage = message.toLowerCase();
  const filter: EnhancedSubsidyFilter = {};
  const matchedCategories: string[] = [];
  const matchedKeywords: string[] = [];
  
  // カテゴリーごとにキーワードマッチングを行う（部分一致と同義語対応）
  for (const [categoryId, category] of Object.entries(categoriesData.categories)) {
    let categoryMatched = false;
    
    // キーワードの部分一致チェック
    for (const keyword of category.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        categoryMatched = true;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
    
    // カテゴリー名自体のチェック
    if (lowerMessage.includes(category.name.toLowerCase())) {
      categoryMatched = true;
    }
    
    // 同義語・関連語のチェック
    const synonyms = getCategorySynonyms(categoryId);
    for (const synonym of synonyms) {
      if (lowerMessage.includes(synonym.toLowerCase())) {
        categoryMatched = true;
        break;
      }
    }
    
    if (categoryMatched && !matchedCategories.includes(categoryId)) {
      matchedCategories.push(categoryId);
    }
  }
  
  // 金額のマッチング
  const amountFilter = detectAmountFilter(message);
  if (amountFilter) {
    filter.amount = amountFilter;
  }
  
  // 地域のマッチング
  const areaFilter = detectAreaFilter(message);
  if (areaFilter) {
    filter.area = areaFilter;
  }
  
  // 従業員数のマッチング
  let employeeCount: { min?: number; max?: number } | undefined;
  const employeePatterns = [
    { pattern: /(\d+)\s*[名人]\s*以下/, type: 'max' },
    { pattern: /(\d+)\s*[名人]\s*以上/, type: 'min' },
    { pattern: /(\d+)\s*[名人]\s*[~〜]\s*(\d+)\s*[名人]/, type: 'range' },
    { pattern: /社員数\s*(\d+)\s*[名人]/, type: 'exact' },
    { pattern: /従業員\s*(\d+)\s*[名人]/, type: 'exact' },
    { pattern: /従業員数\s*(\d+)\s*[名人]/, type: 'exact' }
  ];
  
  for (const { pattern, type } of employeePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (!employeeCount) employeeCount = {};
      if (type === 'min') {
        employeeCount.min = parseInt(match[1]);
      } else if (type === 'max') {
        employeeCount.max = parseInt(match[1]);
      } else if (type === 'range') {
        employeeCount.min = parseInt(match[1]);
        employeeCount.max = parseInt(match[2]);
      } else if (type === 'exact') {
        // 「社員数50名」の場合は「50名以下」として扱う
        employeeCount.max = parseInt(match[1]);
      }
      break;
    }
  }
  
  // 企業規模のマッチング
  const sizeKeywords = {
    'micro': ['個人事業', 'フリーランス', '副業', '個人', 'マイクロ'],
    'small': ['小規模', '小企業', '零細'],
    'medium': ['中小企業', '中企業', 'SME', '中堅'],
    'large': ['大企業', '大手', '大規模']
  };
  
  let matchedSize: string | undefined;
  for (const [sizeId, keywords] of Object.entries(sizeKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchedSize = sizeId;
        break;
      }
    }
    if (matchedSize) break;
  }
  
  // 特別条件のマッチング（拡張版）
  const matchedConditions: string[] = [];
  const conditionPatterns = {
    'woman_owned': ['女性経営', '女性起業', '女性社長', '女性代表'],
    'young_entrepreneur': ['若手', '若い', '若年', '39歳以下', '35歳以下', 'U40', 'U35'],
    'succession': ['事業承継', '後継', '継承', '引き継ぎ', '代替わり'],
    'nonprofit': ['npo', '非営利', 'ＮＰＯ', '公益', '社会福祉法人']
  };
  
  for (const [conditionId, patterns] of Object.entries(conditionPatterns)) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        if (!matchedConditions.includes(conditionId)) {
          matchedConditions.push(conditionId);
        }
        break;
      }
    }
  }
  
  // 申請期限のマッチング
  const deadlineKeywords = {
    accepting: ['受付中', '申請中', '募集中', '現在募集', '今申請できる'],
    upcoming: ['もうすぐ', '今後', '予定', '来月', '来週'],
    urgent: ['急ぎ', '締切間近', '締切迫る', '残りわずか']
  };
  
  let deadlineStatus = null;
  for (const [status, keywords] of Object.entries(deadlineKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        if (status === 'urgent') {
          deadlineStatus = 'accepting';
          filter.deadline = {
            status: 'accepting',
            daysUntilDeadline: { max: 14 }
          };
        } else {
          filter.deadline = { status: status as 'accepting' | 'upcoming' };
        }
        break;
      }
    }
    if (deadlineStatus) break;
  }
  
  // フィルターの構築
  if (matchedCategories.length > 0) {
    // カテゴリーIDを日本語キーワードにマッピング
    const categoryToJapaneseKeywords: Record<string, string[]> = {
      'equipment': ['設備投資', '設備', '機械', '装置', '導入', '更新', '改修'],
      'employment': ['人材', '雇用', '採用', '育成', '研修', '正社員', '人件費'],
      'research': ['研究開発', '研究', '開発', 'R&D', '技術', 'イノベーション', '実証実験'],
      'expansion': ['販路拡大', '販路', 'マーケティング', 'PR', '展示会', '海外展開', '輸出'],
      'startup': ['創業', '起業', 'スタートアップ', '新事業', 'ベンチャー', '開業'],
      'digitalization': ['IT', 'DX', 'デジタル', 'システム', 'IoT', 'AI', 'IT導入', 'ソフトウェア'],
      'environment': ['環境', 'エネルギー', '省エネ', '脱炭素', 'SDGs', 'カーボンニュートラル', 'CO2'],
      'welfare': ['福祉', '介護', '医療', '健康', '高齢者', '障害者', 'バリアフリー']
    };
    
    // マッチしたカテゴリーの日本語キーワードを収集
    const allJapaneseKeywords: string[] = [];
    for (const categoryId of matchedCategories) {
      const japaneseKeywords = categoryToJapaneseKeywords[categoryId];
      if (japaneseKeywords) {
        allJapaneseKeywords.push(...japaneseKeywords);
      }
    }
    
    filter.purpose = {
      mainCategories: matchedCategories as any,
      keywords: [...new Set([...matchedKeywords, ...allJapaneseKeywords])]
    };
  }
  
  if (matchedSize || matchedConditions.length > 0 || employeeCount) {
    filter.company = {};
    if (matchedSize) {
      filter.company.companySize = matchedSize as 'micro' | 'small' | 'medium' | 'large' | 'any';
    }
    if (matchedConditions.length > 0) {
      filter.company.specialConditions = matchedConditions as ('woman_owned' | 'young_entrepreneur' | 'succession' | 'nonprofit')[];
    }
    if (employeeCount) {
      filter.company.employeeCount = employeeCount;
    }
  }
  
  // フィルターが生成されなかった場合はnullを返す
  return Object.keys(filter).length > 0 ? filter : null;
}

/**
 * カテゴリーの同義語を取得
 */
function getCategorySynonyms(categoryId: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'equipment': ['機器', '設備投資', '施設', 'ハード'],
    'employment': ['人手不足', '人材確保', 'リクルート', '働き方改革'],
    'research': ['技術開発', '商品開発', '製品開発', '新技術'],
    'expansion': ['営業', 'セールス', '顧客開拓', '市場開拓'],
    'startup': ['開業', '独立', '新規事業', '第二創業'],
    'digitalization': ['デジタル化', 'ICT', 'システム化', 'オンライン化'],
    'environment': ['グリーン', 'エコ', '再生可能エネルギー', '循環型'],
    'welfare': ['ヘルスケア', '社会福祉', '地域福祉', 'ウェルビーイング']
  };
  
  return synonymMap[categoryId] || [];
}

/**
 * 金額フィルターの検出
 */
function detectAmountFilter(message: string): AmountFilter | null {
  const amountFilter: AmountFilter = {};
  const lowerMessage = message.toLowerCase();
  
  // 数値パターンのマッチング（〇万円、〇百万円など）
  const amountPatterns = [
    { pattern: /(\d+)\s*万円?\s*以下/, type: 'max', multiplier: 10000 },
    { pattern: /(\d+)\s*万円?\s*以上/, type: 'min', multiplier: 10000 },
    { pattern: /(\d+)\s*百万円?\s*以下/, type: 'max', multiplier: 1000000 },
    { pattern: /(\d+)\s*百万円?\s*以上/, type: 'min', multiplier: 1000000 },
    { pattern: /(\d+)\s*千万円?\s*以下/, type: 'max', multiplier: 10000000 },
    { pattern: /(\d+)\s*千万円?\s*以上/, type: 'min', multiplier: 10000000 },
    { pattern: /(\d+)\s*万円?\s*[~〜]\s*(\d+)\s*万円?/, type: 'range', multiplier: 10000 }
  ];
  
  for (const { pattern, type, multiplier } of amountPatterns) {
    const match = message.match(pattern);
    if (match) {
      if (type === 'min') {
        amountFilter.min = parseInt(match[1]) * multiplier;
      } else if (type === 'max') {
        amountFilter.max = parseInt(match[1]) * multiplier;
      } else if (type === 'range') {
        amountFilter.min = parseInt(match[1]) * multiplier;
        amountFilter.max = parseInt(match[2]) * multiplier;
      }
    }
  }
  
  // プリセット範囲のマッチング
  const presetKeywords = {
    'under_100k': ['10万以下', '少額', '小額'],
    'under_1m': ['100万以下', '百万以下'],
    '1m_5m': ['100万から500万', '中規模'],
    '5m_10m': ['500万から1000万', '大規模'],
    'over_10m': ['1000万以上', '高額', '大型']
  };
  
  for (const [presetId, keywords] of Object.entries(presetKeywords)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        amountFilter.presetRange = presetId as any;
        const preset = AMOUNT_PRESET_RANGES[presetId];
        if (preset.min) amountFilter.min = preset.min;
        if (preset.max) amountFilter.max = preset.max;
        break;
      }
    }
  }
  
  // 補助率のマッチング
  const subsidyRateMatch = message.match(/(\d+)\s*[%％]\s*(以上|以下)?/);
  if (subsidyRateMatch) {
    const rate = parseInt(subsidyRateMatch[1]);
    if (!amountFilter.subsidyRate) amountFilter.subsidyRate = {};
    
    if (subsidyRateMatch[2] === '以上') {
      amountFilter.subsidyRate.min = rate;
    } else if (subsidyRateMatch[2] === '以下') {
      amountFilter.subsidyRate.max = rate;
    } else {
      amountFilter.subsidyRate.min = rate;
      amountFilter.subsidyRate.max = rate;
    }
  }
  
  return Object.keys(amountFilter).length > 0 ? amountFilter : null;
}

/**
 * 地域フィルターの検出
 */
function detectAreaFilter(message: string): AreaFilter | null {
  const areaFilter: AreaFilter = {};
  const lowerMessage = message.toLowerCase();
  
  // 都道府県の検出
  const prefectures = ['東京都', '大阪府', '神奈川県', '埼玉県', '千葉県', '愛知県', '北海道', '福岡県'];
  for (const prefecture of prefectures) {
    if (message.includes(prefecture)) {
      areaFilter.prefecture = prefecture;
      break;
    }
  }
  
  // 東京23区の検出
  const detectedCities: string[] = [];
  for (const city of TOKYO_CITIES) {
    if (message.includes(city)) {
      detectedCities.push(city);
    }
  }
  
  if (detectedCities.length > 0) {
    areaFilter.cities = detectedCities;
    if (!areaFilter.prefecture) {
      areaFilter.prefecture = '東京都';
    }
  }
  
  // 全国対象の検出
  if (lowerMessage.includes('全国') || lowerMessage.includes('どこでも')) {
    areaFilter.includeNationwide = true;
  }
  
  return Object.keys(areaFilter).length > 0 ? areaFilter : null;
}