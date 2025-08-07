/**
 * Parallel Search Manager for executing multiple subsidy searches concurrently
 */

import type { AssistantService } from '~/services/assistant.service';

export interface SearchQuery {
  id: string;
  query: string;
  filters?: any;
  priority?: number;
}

export interface SearchResult {
  id: string;
  query: string;
  result: any;
  duration: number;
  error?: string;
}

export class ParallelSearchManager {
  private readonly maxConcurrency: number;
  private readonly timeout: number;

  constructor(maxConcurrency = 3, timeoutSeconds = 30) {
    this.maxConcurrency = maxConcurrency;
    this.timeout = timeoutSeconds * 1000;
  }

  /**
   * Execute multiple searches in parallel with controlled concurrency
   */
  async executeSearches(
    queries: SearchQuery[],
    searchFunction: (query: SearchQuery) => Promise<any>
  ): Promise<SearchResult[]> {
    // Sort by priority if provided
    const sortedQueries = [...queries].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    const results: SearchResult[] = [];
    const executing: Promise<void>[] = [];

    for (const query of sortedQueries) {
      const promise = this.executeWithTimeout(query, searchFunction).then(result => {
        results.push(result);
      });

      executing.push(promise);

      // Control concurrency
      if (executing.length >= this.maxConcurrency) {
        await Promise.race(executing);
        // Remove completed promises
        executing.splice(0, executing.filter(p => 
          p === promise || !results.some(r => r.id === query.id)
        ).length);
      }
    }

    // Wait for all remaining searches
    await Promise.all(executing);
    
    // Return results in original order
    return queries.map(q => 
      results.find(r => r.id === q.id) || {
        id: q.id,
        query: q.query,
        result: null,
        duration: 0,
        error: 'Search not completed'
      }
    );
  }

  /**
   * Execute a single search with timeout
   */
  private async executeWithTimeout(
    query: SearchQuery,
    searchFunction: (query: SearchQuery) => Promise<any>
  ): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        searchFunction(query),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), this.timeout)
        )
      ]);

      return {
        id: query.id,
        query: query.query,
        result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        id: query.id,
        query: query.query,
        result: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Split complex queries into parallel sub-queries
   */
  static splitComplexQuery(message: string): SearchQuery[] {
    const queries: SearchQuery[] = [];
    
    // Detect multiple categories in the query
    const categories = this.extractCategories(message);
    if (categories.length > 1) {
      categories.forEach((category, index) => {
        queries.push({
          id: `category-${index}`,
          query: category,
          priority: 1
        });
      });
    }

    // Detect multiple regions
    const regions = this.extractRegions(message);
    if (regions.length > 1) {
      regions.forEach((region, index) => {
        queries.push({
          id: `region-${index}`,
          query: `${region}の補助金`,
          priority: 2
        });
      });
    }

    // Detect multiple amounts
    const amounts = this.extractAmounts(message);
    if (amounts.length > 1) {
      amounts.forEach((amount, index) => {
        queries.push({
          id: `amount-${index}`,
          query: `${amount}の補助金`,
          priority: 3
        });
      });
    }

    // If no sub-queries, return original as single query
    if (queries.length === 0) {
      queries.push({
        id: 'main',
        query: message,
        priority: 0
      });
    }

    return queries;
  }

  /**
   * Extract category keywords from message
   */
  private static extractCategories(message: string): string[] {
    const categories: string[] = [];
    
    const categoryKeywords = [
      { pattern: /IT|ＩＴ|情報技術/gi, category: 'IT・DX推進' },
      { pattern: /スタートアップ|起業|創業/gi, category: 'スタートアップ支援' },
      { pattern: /研究開発|R&D|Ｒ＆Ｄ/gi, category: '研究開発' },
      { pattern: /人材育成|教育|研修/gi, category: '人材育成' },
      { pattern: /設備投資|機械|装置/gi, category: '設備投資' },
      { pattern: /環境|エコ|省エネ/gi, category: '環境・エネルギー' },
      { pattern: /海外展開|輸出|国際/gi, category: '海外展開' },
    ];

    for (const { pattern, category } of categoryKeywords) {
      if (pattern.test(message)) {
        categories.push(category);
      }
    }

    return categories;
  }

  /**
   * Extract region names from message
   */
  private static extractRegions(message: string): string[] {
    const regions: string[] = [];
    
    const regionPatterns = [
      /東京都?|東京/g,
      /大阪府?|大阪/g,
      /神奈川県?|横浜/g,
      /愛知県?|名古屋/g,
      /福岡県?|福岡/g,
      /北海道|札幌/g,
      /京都府?|京都/g,
    ];

    for (const pattern of regionPatterns) {
      const matches = message.match(pattern);
      if (matches) {
        regions.push(...matches);
      }
    }

    return [...new Set(regions)]; // Remove duplicates
  }

  /**
   * Extract amount ranges from message
   */
  private static extractAmounts(message: string): string[] {
    const amounts: string[] = [];
    
    // Match patterns like "100万円", "1000万円以上", "500万〜1000万"
    const amountPattern = /(\d+)[\s]*([万千億])[\s]*円/g;
    let match;
    
    while ((match = amountPattern.exec(message)) !== null) {
      amounts.push(match[0]);
    }

    return amounts;
  }

  /**
   * Merge results from parallel searches
   */
  static mergeResults(results: SearchResult[]): string {
    if (results.length === 1) {
      return results[0].result;
    }

    const sections: string[] = [];
    
    // Group by category
    const categoryResults = results.filter(r => r.id.startsWith('category-'));
    if (categoryResults.length > 0) {
      sections.push('## カテゴリー別の補助金\n');
      categoryResults.forEach(r => {
        if (r.result && !r.error) {
          sections.push(`### ${r.query}\n${r.result}\n`);
        }
      });
    }

    // Group by region
    const regionResults = results.filter(r => r.id.startsWith('region-'));
    if (regionResults.length > 0) {
      sections.push('\n## 地域別の補助金\n');
      regionResults.forEach(r => {
        if (r.result && !r.error) {
          sections.push(`### ${r.query}\n${r.result}\n`);
        }
      });
    }

    // Group by amount
    const amountResults = results.filter(r => r.id.startsWith('amount-'));
    if (amountResults.length > 0) {
      sections.push('\n## 金額別の補助金\n');
      amountResults.forEach(r => {
        if (r.result && !r.error) {
          sections.push(`### ${r.query}\n${r.result}\n`);
        }
      });
    }

    // Add main result if exists
    const mainResult = results.find(r => r.id === 'main');
    if (mainResult && mainResult.result && !mainResult.error) {
      sections.unshift(mainResult.result + '\n\n---\n');
    }

    // Add performance stats
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / results.length;
    sections.push(`\n---\n*検索完了: ${results.length}件 | 平均応答時間: ${(avgDuration / 1000).toFixed(1)}秒*`);

    return sections.join('\n');
  }
}

// Export singleton instance
let parallelSearchManager: ParallelSearchManager | null = null;

export function getParallelSearchManager(): ParallelSearchManager {
  if (!parallelSearchManager) {
    parallelSearchManager = new ParallelSearchManager(
      parseInt(process.env.PARALLEL_SEARCH_CONCURRENCY || '3'),
      parseInt(process.env.PARALLEL_SEARCH_TIMEOUT || '30')
    );
  }
  return parallelSearchManager;
}