import type { Issue } from '../github/types.js';
import type { RulesFile } from '../config/types.js';
import type { MatchResult } from './types.js';

export function matchRules(_issue: Issue, _rulesFile: RulesFile): MatchResult[] {
  throw new Error('not implemented');
}
