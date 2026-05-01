import path from 'path';
import { fetchIssue } from '../github/issue.js';
import { loadConfig } from '../config/loader.js';
import { matchRules } from '../rules/engine.js';
import { findDocSections } from '../docs/finder.js';
import { renderTemplate } from '../template/renderer.js';
import { DEFAULT_TEMPLATE } from '../template/default-template.js';
import { writePackage } from '../output/writer.js';
import type { TemplateVars } from '../template/types.js';
import type { MatchResult } from '../rules/types.js';
import type { Issue } from '../github/types.js';
import type { DocSection } from '../docs/types.js';

export async function plan(
  issueRef: string,
  opts: { repo?: string; dryRun?: boolean; verbose?: boolean }
): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());

  if (opts.verbose) console.log(`→ Target repo: ${repoPath}`);

  // 1. Fetch issue
  if (opts.verbose) console.log('→ Fetching issue...');
  const issue = await fetchIssue(issueRef, repoPath);
  console.log(`✓ Issue #${issue.number} fetched: ${issue.title}${issue.state === 'closed' ? ' [CLOSED]' : ''}`);

  // 2. Load config
  if (opts.verbose) console.log('→ Loading config...');
  const config = await loadConfig(repoPath);
  if (opts.verbose) console.log(`  Config loaded from ${config.specAgentDir}`);

  // 3. Match rules
  const matches = matchRules(issue, config.rulesFile);
  if (matches.length === 0) {
    console.warn('⚠  No rules matched and no defaults defined. Proceeding with empty scope.');
  }

  const ruleIds = matches.map((m) => m.rule.id).join(', ') || '(none)';
  console.log(`✓ Rules matched: ${ruleIds}`);
  if (opts.verbose) {
    for (const m of matches) {
      console.log(`  ${m.rule.id}: ${m.matchedOn.join(', ')}`);
    }
  }

  // 4. Collect docs (merged, deduplicated across all matched rules)
  const allDocPaths = [...new Set(matches.flatMap((m) => m.rule.docs))];
  const docSections = await findDocSections(allDocPaths, repoPath);
  const foundCount = docSections.filter((d) => d.found).length;
  console.log(`✓ Docs loaded: ${foundCount}/${docSections.length} files found`);

  // 5. Build template vars
  const allHints = [...new Set(matches.flatMap((m) => m.rule.hints))];
  const vars: TemplateVars = buildTemplateVars(issue, matches, allHints, docSections, repoPath);

  // 6. Render
  const rendered = renderTemplate(DEFAULT_TEMPLATE, vars);

  // 7. Output
  if (opts.dryRun) {
    console.log('\n' + rendered);
    return;
  }

  const outDir = path.join(config.specAgentDir, 'out');
  const outPath = await writePackage(rendered, outDir, issue.number);
  console.log(`✓ Task package written: ${path.relative(repoPath, outPath)}`);
}

function buildTemplateVars(
  issue: Issue,
  matches: MatchResult[],
  allHints: string[],
  docSections: DocSection[],
  repoPath: string
): TemplateVars {
  const checklist = issue.body
    .split('\n')
    .filter((l) => l.trim().startsWith('- [ ]'))
    .join('\n') || '(none found)';

  const docContent = docSections
    .filter((d) => d.found)
    .map((d) => `### ${d.filePath}\n\n${d.content.trim()}`)
    .join('\n\n---\n\n') || '(no docs loaded)';

  return {
    issue_title: issue.title,
    issue_number: String(issue.number),
    issue_url: issue.url,
    issue_body: issue.body || '(no description provided)',
    issue_labels: issue.labels.join(', ') || '(none)',
    issue_checklist: checklist,
    matched_rule_ids: matches.map((m) => m.rule.id).join(', ') || '(none)',
    matched_rule_descriptions: matches.map((m) => m.rule.description).join(', ') || '(none)',
    matched_hints: allHints.map((h) => `- ${h}`).join('\n') || '(none)',
    doc_sections: docContent,
    repo_path: repoPath,
    generated_at: new Date().toISOString(),
  };
}
