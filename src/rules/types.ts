import type { Rule } from '../config/types.js';

export interface MatchResult {
  rule: Rule;
  matchedOn: string[];  // which fields triggered the match, e.g. ["title_contains:backend"]
}
