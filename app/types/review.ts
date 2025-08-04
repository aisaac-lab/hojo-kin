/**
 * Review system type definitions for response quality validation
 */

export interface ReviewResult {
  passed: boolean;
  scores: {
    relevance: number;        // 質問への関連性 (0-100)
    completeness: number;     // 回答の完全性 (0-100)
    dataAccuracy: number;     // データの正確性 (0-100)
    followUp: number;         // 深掘り質問の適切性 (0-100)
    presentationQuality?: number; // 表現の質 (0-100)
  };
  lowestScore: {
    category: string;
    score: number;
  };
  action: 'approve' | 'regenerate' | 'ask_clarification';
  issues: ReviewIssue[];
  clarificationQuestions?: string[];  // 深掘り質問のリスト
  regenerationHints?: string[];       // 再生成時のヒント
  improvedResponse?: string;          // 軽微な修正のみの場合
}

export interface ReviewIssue {
  type: 'relevance' | 'completeness' | 'data_source' | 'follow_up' | 'citation' | 'format' | 'presentation';
  description: string;
  severity: 'critical' | 'warning' | 'info';
  example?: string;
}

export interface ReviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ReviewContext {
  hasFilters: boolean;
  previousMessages?: ReviewMessage[];
  mentionedSubsidies?: string[];
  filters?: any;
}