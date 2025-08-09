import type { EnhancedSubsidyFilter } from '~/types/enhanced-filter';

export interface SubsidyScoreResult {
  subsidyId: string;
  title: string;
  totalScore: number;
  scoreBreakdown: {
    categoryMatch: number;
    areaMatch: number;
    amountMatch: number;
    companySizeMatch: number;
    otherFactors: number;
  };
  matchDetails: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string;
  };
}

export interface SubsidyData {
  id: string;
  title: string;
  categories?: string[];
  area?: {
    nationwide?: boolean;
    prefectures?: string[];
    cities?: string[];
  };
  amount?: {
    min?: number;
    max?: number;
    type?: string;
  };
  target?: {
    companySize?: {
      employees?: { min?: number; max?: number };
      capital?: { min?: number; max?: number };
    };
    industries?: string[];
    stages?: string[];
  };
  applicationPeriod?: {
    status?: string;
    endDate?: Date;
  };
  popularity?: number;
  successRate?: number;
}

export class SubsidyScoringService {
  private readonly weights = {
    category: 30,
    area: 25,
    amount: 20,
    companySize: 15,
    other: 10,
  };

  /**
   * 補助金とユーザー条件のマッチ度を計算
   */
  calculateScore(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): SubsidyScoreResult {
    const scoreBreakdown = {
      categoryMatch: this.calculateCategoryScore(subsidy, userContext),
      areaMatch: this.calculateAreaScore(subsidy, userContext),
      amountMatch: this.calculateAmountScore(subsidy, userContext),
      companySizeMatch: this.calculateCompanySizeScore(subsidy, userContext),
      otherFactors: this.calculateOtherFactors(subsidy, userContext),
    };

    const totalScore = Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0);

    const matchDetails = this.generateMatchDetails(subsidy, userContext, scoreBreakdown);

    return {
      subsidyId: subsidy.id,
      title: subsidy.title,
      totalScore: Math.min(100, Math.round(totalScore)),
      scoreBreakdown,
      matchDetails,
    };
  }

  /**
   * カテゴリマッチスコア計算（最大30点）
   */
  private calculateCategoryScore(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): number {
    if (!subsidy.categories || !userContext.purpose?.mainCategories) {
      return 0;
    }

    const userCategories = new Set(userContext.purpose.mainCategories);
    const subsidyCategories = new Set(subsidy.categories);
    
    // 完全一致
    let matches = 0;
    for (const category of userCategories) {
      if (subsidyCategories.has(category)) {
        matches++;
      }
    }

    if (matches === 0) {
      // 部分一致を検討
      const partialMatches = this.checkPartialCategoryMatch(
        Array.from(userCategories),
        Array.from(subsidyCategories)
      );
      return Math.round(this.weights.category * partialMatches * 0.5);
    }

    const matchRatio = matches / userCategories.size;
    return Math.round(this.weights.category * matchRatio);
  }

  /**
   * 地域マッチスコア計算（最大25点）
   */
  private calculateAreaScore(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): number {
    if (!subsidy.area || !userContext.area) {
      return this.weights.area * 0.5; // 地域指定なしの場合は半分のスコア
    }

    // 全国対象の場合
    if (subsidy.area?.nationwide) {
      return this.weights.area;
    }

    // 都道府県マッチ
    if (userContext.area?.cities && subsidy.area?.prefectures) {
      const userPrefecture = userContext.area.cities[0]?.split('都')[0] + '都' || 
                             userContext.area.cities[0]?.split('府')[0] + '府' ||
                             userContext.area.cities[0]?.split('県')[0] + '県';
      if (subsidy.area?.prefectures?.includes(userPrefecture)) {
        return this.weights.area;
      }
    }

    // 市区町村マッチ
    if (userContext.area?.cities && subsidy.area?.cities) {
      const matchingCities = userContext.area.cities.filter(city => 
        subsidy.area?.cities?.includes(city)
      );
      if (matchingCities.length > 0) {
        return this.weights.area;
      }
    }

    return 0;
  }

  /**
   * 金額マッチスコア計算（最大20点）
   */
  private calculateAmountScore(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): number {
    if (!subsidy.amount || !userContext.amount) {
      return this.weights.amount * 0.5;
    }

    const userMin = userContext.amount.min || 0;
    const userMax = userContext.amount.max || Number.MAX_SAFE_INTEGER;
    const userPreferred = (userMin + userMax) / 2;

    const subsidyMin = subsidy.amount.min || 0;
    const subsidyMax = subsidy.amount.max || Number.MAX_SAFE_INTEGER;

    // 範囲の重なりを計算
    const overlapMin = Math.max(userMin, subsidyMin);
    const overlapMax = Math.min(userMax, subsidyMax);

    if (overlapMin > overlapMax) {
      // 範囲が重ならない
      return 0;
    }

    // 希望額が補助金範囲内にあるか
    if (userPreferred >= subsidyMin && userPreferred <= subsidyMax) {
      return this.weights.amount;
    }

    // 部分的な重なり
    const userRange = userMax - userMin || 1;
    const overlapRange = overlapMax - overlapMin;
    const overlapRatio = overlapRange / userRange;

    return Math.round(this.weights.amount * overlapRatio);
  }

  /**
   * 企業規模マッチスコア計算（最大15点）
   */
  private calculateCompanySizeScore(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): number {
    if (!subsidy.target?.companySize || !userContext.company) {
      return this.weights.companySize * 0.5;
    }

    let score = 0;
    let factors = 0;

    // 従業員数マッチ
    if (userContext.company.employeeCount && subsidy.target.companySize.employees) {
      factors++;
      const userEmployees = userContext.company.employeeCount;
      const subsidyEmployees = subsidy.target.companySize.employees;

      if (this.isRangeMatch(userEmployees, subsidyEmployees)) {
        score += 1;
      }
    }

    // 企業規模マッチ
    if (userContext.company.companySize && subsidy.target.companySize.capital) {
      factors++;
      // 企業規模から推定される資本金範囲でマッチング
      const sizeToCapital: Record<string, { min: number; max: number }> = {
        'micro': { min: 0, max: 3000000 },
        'small': { min: 0, max: 50000000 },
        'medium': { min: 50000000, max: 300000000 },
        'large': { min: 300000000, max: Number.MAX_SAFE_INTEGER },
        'any': { min: 0, max: Number.MAX_SAFE_INTEGER }
      };
      const userCapital = sizeToCapital[userContext.company.companySize] || { min: 0, max: Number.MAX_SAFE_INTEGER };
      const subsidyCapital = subsidy.target.companySize.capital;

      if (this.isRangeMatch(userCapital, subsidyCapital)) {
        score += 1;
      }
    }

    // 業界マッチ
    if (userContext.company.estimatedIndustries && subsidy.target?.industries) {
      factors++;
      const matchingIndustries = userContext.company.estimatedIndustries.filter(
        industry => subsidy.target?.industries?.includes(industry)
      );
      if (matchingIndustries.length > 0) {
        score += 1;
      }
    }

    // 設立年数から事業ステージを推定してマッチ
    if (userContext.company.yearsInBusiness && subsidy.target?.stages) {
      factors++;
      const years = userContext.company.yearsInBusiness.min || 0;
      let estimatedStage = 'growth';
      if (years < 1) estimatedStage = 'startup';
      else if (years < 3) estimatedStage = 'early';
      else if (years < 10) estimatedStage = 'growth';
      else estimatedStage = 'established';
      
      if (subsidy.target?.stages?.includes(estimatedStage)) {
        score += 1;
      }
    }

    if (factors === 0) {
      return this.weights.companySize * 0.5;
    }

    const matchRatio = score / factors;
    return Math.round(this.weights.companySize * matchRatio);
  }

  /**
   * その他の要因スコア計算（最大10点）
   */
  private calculateOtherFactors(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter
  ): number {
    let score = 0;

    // 申請期限の緊急度
    if (subsidy.applicationPeriod?.status === 'open') {
      score += 3;
      
      if (subsidy.applicationPeriod.endDate) {
        const daysUntilDeadline = this.getDaysUntilDeadline(subsidy.applicationPeriod.endDate);
        if (daysUntilDeadline < 30) {
          score += 2; // 締切が近い場合は追加点
        }
      }
    } else if (subsidy.applicationPeriod?.status === 'ongoing') {
      score += 5; // 常時募集は高評価
    }

    // 人気度・成功率
    if (subsidy.popularity && subsidy.popularity > 70) {
      score += 2;
    }
    if (subsidy.successRate && subsidy.successRate > 60) {
      score += 3;
    }

    return Math.min(this.weights.other, score);
  }

  /**
   * 部分的なカテゴリマッチを確認
   */
  private checkPartialCategoryMatch(
    userCategories: string[],
    subsidyCategories: string[]
  ): number {
    let partialMatches = 0;
    const maxMatches = Math.min(userCategories.length, subsidyCategories.length);

    for (const userCat of userCategories) {
      for (const subsidyCat of subsidyCategories) {
        if (this.areCategoriesRelated(userCat, subsidyCat)) {
          partialMatches++;
          break;
        }
      }
    }

    return maxMatches > 0 ? partialMatches / maxMatches : 0;
  }

  /**
   * カテゴリの関連性をチェック
   */
  private areCategoriesRelated(cat1: string, cat2: string): boolean {
    const relatedCategories: Record<string, string[]> = {
      'IT・デジタル': ['設備投資', '人材育成', '研究開発'],
      '研究開発': ['IT・デジタル', '設備投資', '環境・エネルギー'],
      '人材育成': ['雇用・労働', 'IT・デジタル'],
      '販路開拓': ['海外展開', 'マーケティング'],
      '創業・起業': ['設備投資', 'IT・デジタル', '人材育成'],
    };

    if (cat1 === cat2) return true;

    const related1 = relatedCategories[cat1] || [];
    const related2 = relatedCategories[cat2] || [];

    return related1.includes(cat2) || related2.includes(cat1);
  }

  /**
   * 範囲のマッチング確認
   */
  private isRangeMatch(
    userRange: { min?: number; max?: number },
    subsidyRange: { min?: number; max?: number }
  ): boolean {
    const userMin = userRange.min || 0;
    const userMax = userRange.max || Number.MAX_SAFE_INTEGER;
    const subsidyMin = subsidyRange.min || 0;
    const subsidyMax = subsidyRange.max || Number.MAX_SAFE_INTEGER;

    // ユーザーの範囲が補助金の範囲内に収まるか確認
    return userMin >= subsidyMin && userMax <= subsidyMax;
  }

  /**
   * 締切までの日数を計算
   */
  private getDaysUntilDeadline(deadline: Date): number {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * マッチ詳細の生成
   */
  private generateMatchDetails(
    subsidy: SubsidyData,
    userContext: EnhancedSubsidyFilter,
    scoreBreakdown: SubsidyScoreResult['scoreBreakdown']
  ): SubsidyScoreResult['matchDetails'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // 強みの分析
    if (scoreBreakdown.categoryMatch >= this.weights.category * 0.7) {
      strengths.push('カテゴリが高度に一致');
    }
    if (scoreBreakdown.areaMatch >= this.weights.area * 0.8) {
      strengths.push('対象地域が完全に一致');
    }
    if (scoreBreakdown.amountMatch >= this.weights.amount * 0.8) {
      strengths.push('希望金額と補助金額が適合');
    }
    if (scoreBreakdown.companySizeMatch >= this.weights.companySize * 0.7) {
      strengths.push('企業規模の要件を満たす');
    }

    // 弱みの分析
    if (scoreBreakdown.categoryMatch < this.weights.category * 0.3) {
      weaknesses.push('カテゴリの一致度が低い');
    }
    if (scoreBreakdown.areaMatch === 0) {
      weaknesses.push('対象地域外の可能性');
    }
    if (scoreBreakdown.amountMatch < this.weights.amount * 0.3) {
      weaknesses.push('補助金額が希望と乖離');
    }
    if (scoreBreakdown.companySizeMatch < this.weights.companySize * 0.3) {
      weaknesses.push('企業規模要件との不一致');
    }

    // 推奨事項の生成
    const totalScore = Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0);
    let recommendations = '';

    if (totalScore >= 80) {
      recommendations = '非常に高い適合度です。早急な申請準備を推奨します。';
    } else if (totalScore >= 60) {
      recommendations = '良好な適合度です。要件を詳細に確認の上、申請をご検討ください。';
    } else if (totalScore >= 40) {
      recommendations = '一定の適合性があります。他の選択肢と比較検討することを推奨します。';
    } else {
      recommendations = '適合度が低めです。要件の再確認または他の補助金の検討を推奨します。';
    }

    return {
      strengths,
      weaknesses,
      recommendations,
    };
  }

  /**
   * 複数の補助金をスコアでランキング
   */
  rankSubsidies(
    subsidies: SubsidyData[],
    userContext: EnhancedSubsidyFilter,
    topN: number = 5
  ): SubsidyScoreResult[] {
    const scores = subsidies.map(subsidy => this.calculateScore(subsidy, userContext));
    
    // スコアで降順ソート
    scores.sort((a, b) => b.totalScore - a.totalScore);
    
    // 上位N件を返す
    return scores.slice(0, topN);
  }
}

// シングルトンインスタンス
export const subsidyScoringService = new SubsidyScoringService();