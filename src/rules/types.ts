import type { Rule } from '../config/types.js';

export interface MatchResult {
  rule: Rule;
  score: number;
  matchedOn: {
    labels: string[];
    titlePatterns: string[];
    bodyPatterns: string[];
  };
}
