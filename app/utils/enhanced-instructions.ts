import type { EnhancedSubsidyFilter } from '~/types/enhanced-filter';

/**
 * エージェントの回答精度を向上させるための強化された指示を生成
 */
export function buildEnhancedInstructions(filters: EnhancedSubsidyFilter | any): string {
  const filterContext = buildFilterContext(filters);
  const searchStrategy = buildSearchStrategy();
  const responseFormat = buildResponseFormat();
  const qualityGuidelines = buildQualityGuidelines();
  
  return `
${searchStrategy}
${filterContext}
${responseFormat}
${qualityGuidelines}

【重要な注意事項】
- 必ず日本語で回答してください
- URLは実際のデータに含まれている場合のみ提供してください
- 推測や一般的なURLは提供しないでください
- 不明な情報は「データに含まれていません」と明記してください
`;
}

function buildFilterContext(filters: any): string {
  const parts: string[] = ['【ユーザーの検索条件】'];
  
  // 目的・カテゴリ
  if (filters?.purpose?.mainCategories?.length > 0) {
    parts.push(`主要カテゴリ: ${filters.purpose.mainCategories.join('、')}`);
  }
  if (filters?.purpose?.keywords?.length > 0) {
    parts.push(`キーワード: ${filters.purpose.keywords.join('、')}`);
  }
  
  // 企業情報
  if (filters?.company) {
    if (filters.company.industry) {
      parts.push(`業種: ${filters.company.industry}`);
    }
    if (filters.company.stage) {
      parts.push(`事業ステージ: ${filters.company.stage}`);
    }
    if (filters.company.employeeCount) {
      const emp = filters.company.employeeCount;
      if (emp.min && emp.max) {
        parts.push(`従業員数: ${emp.min}〜${emp.max}名`);
      } else if (emp.max) {
        parts.push(`従業員数: ${emp.max}名以下`);
      } else if (emp.min) {
        parts.push(`従業員数: ${emp.min}名以上`);
      }
    }
    if (filters.company.capital) {
      const cap = filters.company.capital;
      if (cap.min && cap.max) {
        parts.push(`資本金: ${cap.min}〜${cap.max}万円`);
      } else if (cap.max) {
        parts.push(`資本金: ${cap.max}万円以下`);
      } else if (cap.min) {
        parts.push(`資本金: ${cap.min}万円以上`);
      }
    }
  }
  
  // 地域
  if (filters?.location) {
    if (filters.location.prefecture) {
      parts.push(`都道府県: ${filters.location.prefecture}`);
    }
    if (filters.location.city) {
      parts.push(`市区町村: ${filters.location.city}`);
    }
  }
  
  // 金額
  if (filters?.amount) {
    if (filters.amount.min && filters.amount.max) {
      parts.push(`希望金額: ${filters.amount.min}〜${filters.amount.max}万円`);
    } else if (filters.amount.max) {
      parts.push(`希望金額: ${filters.amount.max}万円以下`);
    } else if (filters.amount.min) {
      parts.push(`希望金額: ${filters.amount.min}万円以上`);
    }
  }
  
  return parts.length > 1 ? parts.join('\n') : '';
}

function buildSearchStrategy(): string {
  return `
【検索戦略】
1. データ検索フェーズ
   - file_searchツールを使用して補助金データを検索
   - subsidies_database.json, subsidies-master.json, subsidies-enhanced.jsonを優先的に検索
   - カテゴリ、地域、金額、対象者でフィルタリング

2. マッチング評価フェーズ
   - 各補助金とユーザー条件の適合度を0-100点でスコアリング
   - スコアリング基準:
     * カテゴリ一致: 30点
     * 地域一致: 25点
     * 金額適合: 20点
     * 企業規模適合: 15点
     * その他条件: 10点

3. 結果整理フェーズ
   - スコアの高い順に上位5件を選出
   - 各補助金の詳細情報を整理
   - メリット・デメリットを分析
`;
}

function buildResponseFormat(): string {
  return `
【回答フォーマット】
必ず以下の構成で回答してください：

## 🔍 検索結果サマリー
申請可能な補助金: **X件**見つかりました

## 📊 おすすめ度ランキング

### 🥇 第1位: [補助金名]（マッチ度: XX点/100点）
**スコア内訳**: カテゴリ(XX/30) | 地域(XX/25) | 金額(XX/20) | 企業規模(XX/15) | その他(XX/10)

- 📍 **対象地域**: [地域名]
- 💰 **補助金額**: 上限XXX万円（補助率XX%）
- 📅 **申請期限**: YYYY年MM月DD日
- 🏢 **対象者**: [対象者の詳細]
- 📝 **主な要件**:
  * 要件1
  * 要件2
  * 要件3
- ✅ **メリット**: [この補助金の強み]
- ⚠️ **注意点**: [申請時の注意事項]
- 🔗 **詳細URL**: [公式URL]（データに含まれる場合のみ）

### 🥈 第2位: [補助金名]（マッチ度: XX点/100点）
[同様の形式で記載]

### 🥉 第3位: [補助金名]（マッチ度: XX点/100点）
[同様の形式で記載]

## 💡 申請成功のポイント
1. **優先順位**: [どの補助金から申請すべきか]
2. **準備事項**: [必要な書類や準備]
3. **注意事項**: [共通の注意点]

## 📝 次のステップ
1. [具体的なアクション1]
2. [具体的なアクション2]
3. [具体的なアクション3]
`;
}

function buildQualityGuidelines(): string {
  return `
【品質ガイドライン】
1. 正確性
   - データに基づいた事実のみを提供
   - 不確実な情報には「※要確認」を付記
   - 最新性が不明な場合は注意喚起

2. 完全性
   - 最低3件以上の選択肢を提示
   - 各補助金の長所と短所を明記
   - 申請難易度の目安を提供

3. 実用性
   - 具体的な申請ステップを説明
   - 必要書類のチェックリスト提供
   - タイムラインの目安を提示

4. ユーザビリティ
   - 視覚的に見やすい形式
   - 重要情報を強調表示
   - 段階的な説明構成
`;
}

/**
 * ユーザーメッセージから自動的にフィルターを生成
 */
export function generateAutoFilter(message: string): Partial<EnhancedSubsidyFilter> {
  const filters: Partial<EnhancedSubsidyFilter> = {};
  const lowerMessage = message.toLowerCase();
  
  // カテゴリの自動検出
  const categories: string[] = [];
  const categoryPatterns = {
    'IT・デジタル': /(?:IT|it|デジタル|DX|dx|システム|ソフトウェア|AI|ai|IoT|iot)/i,
    '設備投資': /(?:設備|機械|装置|導入|購入)/i,
    '人材育成': /(?:人材|育成|研修|教育|スキル|採用|雇用)/i,
    '研究開発': /(?:研究|開発|R&D|r&d|技術|イノベーション|特許)/i,
    '販路開拓': /(?:販路|販売|マーケティング|展示会|PR|pr|海外展開|輸出)/i,
    '事業承継': /(?:事業承継|後継者|M&A|m&a|継承)/i,
    '創業・起業': /(?:創業|起業|スタートアップ|開業|ベンチャー)/i,
    '環境・エネルギー': /(?:環境|エネルギー|省エネ|脱炭素|SDGs|sdgs|エコ|グリーン)/i,
  };
  
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    if (pattern.test(message)) {
      categories.push(category);
    }
  }
  
  if (categories.length > 0) {
    filters.purpose = {
      mainCategories: categories,
      subCategories: [],
      keywords: [],
    };
  }
  
  // 地域の自動検出
  const prefecturePattern = /(東京|大阪|京都|福岡|北海道|神奈川|埼玉|千葉|愛知|兵庫|[^市]{1,3}[都道府県])/;
  const prefectureMatch = message.match(prefecturePattern);
  if (prefectureMatch) {
    filters.location = {
      prefecture: prefectureMatch[1],
      city: '',
      postalCode: '',
    };
  }
  
  // 市区町村の自動検出（東京23区と主要都市）
  const cityPattern = /(千代田|中央|港|新宿|文京|台東|墨田|江東|品川|目黒|大田|世田谷|渋谷|中野|杉並|豊島|北|荒川|板橋|練馬|足立|葛飾|江戸川|八王子|立川|武蔵野|三鷹|青梅|府中|昭島|調布|町田|小金井|小平|日野|東村山|国分寺|国立|福生|狛江|東大和|清瀬|東久留米|武蔵村山|多摩|稲城|羽村|あきる野|西東京)区?/;
  const cityMatch = message.match(cityPattern);
  if (cityMatch) {
    const cityName = cityMatch[1] + (cityMatch[0].includes('区') ? '区' : '');
    if (!filters.location) {
      filters.location = {
        prefecture: '東京都',
        city: cityName,
        postalCode: '',
      };
    } else {
      filters.location.city = cityName;
    }
  }
  
  // 金額の自動検出
  const amountPattern = /(\d+)\s*(?:万円|万)/;
  const amountMatch = message.match(amountPattern);
  if (amountMatch) {
    const amount = parseInt(amountMatch[1]);
    filters.amount = {
      min: Math.max(0, amount - 500),
      max: amount + 500,
      preferred: amount,
    };
  }
  
  // 企業規模の自動検出
  const employeePattern = /(\d+)\s*(?:名|人)/;
  const employeeMatch = message.match(employeePattern);
  if (employeeMatch) {
    const count = parseInt(employeeMatch[1]);
    if (!filters.company) {
      filters.company = {
        name: '',
        industry: '',
        stage: '',
        employeeCount: {},
        capital: {},
        revenue: {},
        establishedYear: 0,
      };
    }
    
    // 従業員数から規模を推定
    if (count <= 20) {
      filters.company.employeeCount = { min: 1, max: 20 };
      filters.company.stage = '創業期';
    } else if (count <= 50) {
      filters.company.employeeCount = { min: 20, max: 50 };
      filters.company.stage = '成長期';
    } else if (count <= 300) {
      filters.company.employeeCount = { min: 50, max: 300 };
      filters.company.stage = '成熟期';
    } else {
      filters.company.employeeCount = { min: 300 };
      filters.company.stage = '大企業';
    }
  }
  
  // 業界の自動検出
  const industryKeywords = {
    '製造業': /(?:製造|工場|生産|メーカー)/i,
    '情報通信業': /(?:IT|ソフトウェア|通信|Web|アプリ)/i,
    '小売業': /(?:小売|店舗|販売|ショップ)/i,
    '飲食業': /(?:飲食|レストラン|カフェ|食品)/i,
    'サービス業': /(?:サービス|コンサル|支援)/i,
    '建設業': /(?:建設|建築|土木|工事)/i,
    '医療・福祉': /(?:医療|福祉|介護|病院|クリニック)/i,
  };
  
  for (const [industry, pattern] of Object.entries(industryKeywords)) {
    if (pattern.test(message)) {
      if (!filters.company) {
        filters.company = {
          name: '',
          industry,
          stage: '',
          employeeCount: {},
          capital: {},
          revenue: {},
          establishedYear: 0,
        };
      } else {
        filters.company.industry = industry;
      }
      break;
    }
  }
  
  return filters;
}