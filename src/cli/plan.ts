import path from 'path';
import { fetchIssue } from '../github/issue.js';
import { loadConfig } from '../config/loader.js';
import { matchRules } from '../rules/engine.js';
import { loadExplicitDocs, discoverRelevantDocs, loadCorePreset, discoverSourceFiles } from '../docs/finder.js';
import { renderTemplate } from '../template/renderer.js';
import { DEFAULT_TEMPLATE } from '../template/default-template.js';
import { writePackage } from '../output/writer.js';
import { classifyDomains } from '../classifier/domain.js';
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
  const domains = classifyDomains(issue);
  console.log(`✓ Detected domains: ${domains.join(', ') || '(none)'}`);

  // 2. Load config
  if (opts.verbose) console.log('→ Loading config...');
  const config = await loadConfig(repoPath);

  // 3. Match rules
  const matches = matchRules(issue, config.rulesFile);
  const ruleIds = matches.map((m) => m.rule.id).join(', ') || '(none)';
  console.log(`✓ Rules matched: ${ruleIds}`);
  if (opts.verbose) {
    for (const m of matches) console.log(`  ${m.rule.id}: ${m.matchedOn.join(', ')}`);
  }

  // 4. Always-read docs (explicit config + core preset always appended)
  const explicitAlwaysDocs = await loadExplicitDocs(
    config.rulesFile.always_read ?? [],
    repoPath,
    'always'
  );
  const corePreset = await loadCorePreset();
  const alwaysDocs = [...explicitAlwaysDocs, corePreset];

  // 5. Rule-matched docs (deduplicated across all matched rules)
  const ruleDocPaths = [...new Set(matches.flatMap((m) => m.rule.docs))];
  const ruleDocs = await loadExplicitDocs(ruleDocPaths, repoPath, 'rule');

  // 6. Auto-discover relevant docs (exclude already-loaded paths)
  const loadedPaths = new Set([
    ...alwaysDocs.map((d) => d.filePath),
    ...ruleDocs.map((d) => d.filePath),
  ]);
  const maxDocs = config.rulesFile.discovery?.max_docs ?? 5;
  const discoveredDocs = await discoverRelevantDocs(issue, repoPath, loadedPaths, maxDocs);

  // 6b. Auto-discover source files
  const sourcePaths = config.rulesFile.discovery?.source_paths ?? [];
  const maxSourceFiles = config.rulesFile.discovery?.max_source_files ?? 5;
  const discoveredSources = await discoverSourceFiles(issue, repoPath, sourcePaths, maxSourceFiles);

  // 7. Summarise
  const missingDocs = [...alwaysDocs, ...ruleDocs].filter((d) => !d.found);
  console.log(`✓ Docs — always: ${alwaysDocs.filter(d => d.found).length}, discovered: ${discoveredDocs.length}, rule: ${ruleDocs.filter(d => d.found).length}, missing: ${missingDocs.length}, sources: ${discoveredSources.length}`);
  if (missingDocs.length > 0) {
    for (const d of missingDocs) console.warn(`  ⚠  Not found: ${d.filePath}`);
  }

  // 8. Build vars and render
  const allHints = [...new Set(matches.flatMap((m) => m.rule.hints))];
  const vars = buildTemplateVars(issue, domains, matches, allHints, alwaysDocs, discoveredDocs, ruleDocs, missingDocs, repoPath, discoveredSources);
  const rendered = renderTemplate(DEFAULT_TEMPLATE, vars);

  // 9. Output
  if (opts.dryRun) {
    console.log('\n' + rendered);
    return;
  }

  const outDir = path.join(config.specAgentDir, 'out');
  const outPath = await writePackage(rendered, outDir, issue.number);
  console.log(`✓ Task package written: ${path.relative(repoPath, outPath)}`);
}

function renderDocList(docs: DocSection[]): string {
  if (docs.length === 0) return '(none)';
  return docs
    .map((d) => `### ${d.filePath}\n\n${d.content.trim()}`)
    .join('\n\n---\n\n');
}

function buildTemplateVars(
  issue: Issue,
  domains: string[],
  matches: MatchResult[],
  allHints: string[],
  alwaysDocs: DocSection[],
  discoveredDocs: DocSection[],
  ruleDocs: DocSection[],
  missingDocs: DocSection[],
  repoPath: string,
  discoveredSources: DocSection[]
): TemplateVars {
  const checklist = issue.body
    .split('\n')
    .filter((l) => l.trim().startsWith('- [ ]'))
    .join('\n') || '(none found)';

  const missingList = missingDocs.length > 0
    ? missingDocs.map((d) => `- \`${d.filePath}\` — not found`).join('\n')
    : '(none)';

  const nonDefaultMatches = matches.filter((m) => m.rule.id !== '__defaults__');

  return {
    issue_title: issue.title,
    issue_number: String(issue.number),
    issue_url: issue.url,
    issue_body: issue.body || '(no description provided)',
    issue_labels: issue.labels.join(', ') || '(none)',
    issue_checklist: checklist,
    detected_domains: domains.length > 0
      ? domains.map((d) => `- ${d}`).join('\n')
      : '(none)',
    matched_rule_ids: matches.map((m) => m.rule.id).join(', ') || '(none)',
    matched_rule_descriptions: matches.map((m) => m.rule.description).join(', ') || '(none)',
    matched_guardrails: nonDefaultMatches.length > 0
      ? nonDefaultMatches
          .map((m) => `- **${m.rule.id}**: ${m.rule.description}`)
          .join('\n')
      : '(none matched)',
    matched_hints: allHints.map((h) => `- ${h}`).join('\n') || '(none)',
    always_docs: renderDocList(alwaysDocs.filter((d) => d.found)),
    discovered_docs: renderDocList(discoveredDocs),
    rule_docs: renderDocList(ruleDocs.filter((d) => d.found)),
    missing_docs: missingList,
    discovered_sources: renderDocList(discoveredSources),
    repo_path: repoPath,
    generated_at: new Date().toISOString(),
  };
}
