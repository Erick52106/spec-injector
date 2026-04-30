import type { Issue } from '../github/types.js';
import type { RulesFile } from '../config/types.js';
import type { MatchResult } from './types.js';

export function matchRules(issue: Issue, rulesFile: RulesFile): MatchResult[] {
  const results: MatchResult[] = [];

  for (const rule of rulesFile.rules) {
    const matched: string[] = [];

    for (const term of rule.match.title_contains ?? []) {
      if (issue.title.toLowerCase().includes(term.toLowerCase())) {
        matched.push(`title_contains:${term}`);
      }
    }
    for (const term of rule.match.label_contains ?? []) {
      if (issue.labels.some((l) => l.toLowerCase() === term.toLowerCase())) {
        matched.push(`label_contains:${term}`);
      }
    }
    for (const term of rule.match.body_contains ?? []) {
      if (issue.body.toLowerCase().includes(term.toLowerCase())) {
        matched.push(`body_contains:${term}`);
      }
    }

    if (matched.length > 0) {
      results.push({ rule, matchedOn: matched });
    }
  }

  // Fall back to defaults if no rules matched
  if (results.length === 0 && rulesFile.defaults) {
    const syntheticRule = {
      id: '__defaults__',
      description: 'Default (no rule matched)',
      match: {},
      docs: rulesFile.defaults.docs ?? [],
      hints: rulesFile.defaults.hints ?? [],
    };
    results.push({ rule: syntheticRule, matchedOn: ['defaults'] });
  }

  return results;
}
