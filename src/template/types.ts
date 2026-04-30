import type { Issue } from '../github/types.js';
import type { MatchResult } from '../rules/types.js';
import type { DocSection } from '../docs/types.js';

export interface TemplateVars {
  issue: Issue;
  matches: MatchResult[];
  docs: DocSection[];
  generatedAt: string;
}
