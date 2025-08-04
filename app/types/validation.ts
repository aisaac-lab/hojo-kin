import type { ReviewResult, ReviewContext } from './review';

export interface ValidationLoop {
  loopNumber: number;
  reviewResult: ReviewResult;
  improvementHints: string[];
  scoreImprovement: number;
  timestamp: Date;
}

export interface ValidationResult extends ReviewResult {
  loops: ValidationLoop[];
  finalLoop: number;
  totalImprovement: number;
  bestResponse: string;
  bestScores: ReviewResult['scores'];
  failurePatterns: string[];
  successPatterns: string[];
}

export interface ValidationConfig {
  maxLoops: number;
  scoreImprovementThreshold: number;
  enableProgressiveHints: boolean;
  enableFailureAnalysis: boolean;
  enableLogging: boolean;
}

export interface ValidationContext extends ReviewContext {
  currentLoop: number;
  previousLoops: ValidationLoop[];
  config: ValidationConfig;
}

export interface ProgressiveHint {
  level: 1 | 2 | 3;
  hints: string[];
  examples?: string[];
  template?: string;
}

export interface ValidationHistory {
  id: string;
  threadId: string;
  userQuestion: string;
  validationResult: ValidationResult;
  createdAt: Date;
  totalDuration: number;
}