import path from 'path';
import { fetchIssue } from '../github/issue.js';
import { loadConfig } from '../config/loader.js';
import {
  loadExplicitDocs,
  discoverRelevantDocs,
  loadCorePreset,
  discoverSourceFiles,
  extractExplicitIssueFileReferences,
} from '../docs/finder.js';
import { getPlanDiscoveryExcludePaths } from '../docs/exclusions.js';
import { renderTemplate } from '../template/renderer.js';
import { DEFAULT_TEMPLATE } from '../template/default-template.js';
import { PROMPT_TEMPLATE } from '../template/prompt-template.js';
import { writePackage } from '../output/writer.js';
import { classifyDomains } from '../classifier/domain.js';
import type { TemplateVars } from '../template/types.js';
import type { Guardrail } from '../config/types.js';
import type { Issue } from '../github/types.js';
import type { DocSection } from '../docs/types.js';

export async function plan(
  issueRef: string,
  opts: { repo?: string; dryRun?: boolean; verbose?: boolean; format?: string }
): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const format = opts.format ?? 'full';
  if (!['full', 'prompt'].includes(format)) {
    throw new Error(`Unsupported plan format: ${format}. Expected "full" or "prompt".`);
  }

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

  // 3. Match guardrails by detected domains
  const guardrails = config.specConfig.guardrails ?? [];
  const matchedGuardrails = guardrails.filter(g =>
    g.when_detected.some(d => domains.includes(d))
  );
  const guardrailIds = matchedGuardrails.map(g => g.id).join(', ') || '(none)';
  console.log(`✓ Guardrails matched: ${guardrailIds}`);

  // 4. Always-read docs (explicit config + core preset always appended)
  const explicitAlwaysDocs = await loadExplicitDocs(
    config.specConfig.always_read ?? [],
    repoPath,
    'always'
  );
  const corePreset = await loadCorePreset();
  const alwaysDocs = [...explicitAlwaysDocs, corePreset];

  // 5. Explicit discovery docs (from discovery.docs)
  const discoveryDocPaths = config.specConfig.discovery?.docs ?? [];
  const discoveryDocs = await loadExplicitDocs(discoveryDocPaths, repoPath, 'rule');

  // 6. Auto-discover relevant docs (exclude already-loaded + exclusion list)
  const excludeSet = new Set<string>([
    ...alwaysDocs.map((d) => d.filePath),
    ...discoveryDocs.map((d) => d.filePath),
    ...getPlanDiscoveryExcludePaths(config.specConfig.discovery?.exclude ?? []),
  ]);
  const maxDocs = config.specConfig.discovery?.max_docs ?? 5;
  const discoveredDocs = await discoverRelevantDocs(issue, repoPath, excludeSet, maxDocs);

  // 6b. Auto-discover source files
  const sourcePaths = config.specConfig.discovery?.source ?? [];
  const maxSourceFiles = config.specConfig.discovery?.max_source_files ?? 5;
  const discoveredSources = await discoverSourceFiles(issue, repoPath, sourcePaths, maxSourceFiles);
  const explicitReferences = await extractExplicitIssueFileReferences(issue, repoPath);
  const explicitDocs = mergeReasonSignals(explicitReferences.docs, [...alwaysDocs, ...discoveryDocs, ...discoveredDocs]);
  const explicitSources = mergeReasonSignals(explicitReferences.sources, discoveredSources);
  const explicitDocPaths = new Set(explicitDocs.map((d) => d.filePath));
  const explicitSourcePaths = new Set(explicitSources.map((d) => d.filePath));
  const filteredAlwaysDocs = alwaysDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveryDocs = discoveryDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveredDocs = discoveredDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveredSources = discoveredSources.filter((d) => !explicitSourcePaths.has(d.filePath));
  const missingDocs = mergeMissingSections(
    [...filteredAlwaysDocs, ...filteredDiscoveryDocs].filter((d) => !d.found),
    explicitReferences.missing
  );
  const combinedDocReferences = [...explicitDocs, ...filteredDiscoveredDocs];
  const combinedSourceReferences = [...explicitSources, ...filteredDiscoveredSources];

  // 7. Summarise
  console.log(`✓ Docs — always: ${filteredAlwaysDocs.filter(d => d.found).length}, discovered: ${filteredDiscoveredDocs.length}, explicit: ${explicitDocs.length + filteredDiscoveryDocs.filter(d => d.found).length}, missing: ${missingDocs.length}, sources: ${combinedSourceReferences.length}`);
  if (missingDocs.length > 0) {
    for (const d of missingDocs) console.warn(`  ⚠  Not found: ${d.filePath}`);
  }

  // 8. Build vars and render
  const vars = buildTemplateVars(
    issue,
    domains,
    matchedGuardrails,
    filteredAlwaysDocs,
    combinedDocReferences,
    filteredDiscoveryDocs,
    missingDocs,
    repoPath,
    combinedSourceReferences
  );
  const template = format === 'prompt' ? PROMPT_TEMPLATE : DEFAULT_TEMPLATE;
  const rendered = renderTemplate(template, vars);

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
    .map((d) => {
      const reasonLine = renderReasonLine(d);
      return `### ${d.filePath}\n\n${reasonLine}${d.content.trim()}`;
    })
    .join('\n\n---\n\n');
}

function renderPathList(docs: DocSection[]): string {
  if (docs.length === 0) return '(none)';
  return docs.map((d) => `- \`${d.filePath}\`${renderReasonSuffix(d)}`).join('\n');
}

function renderImplementationConstraints(matchedGuardrails: Guardrail[]): string {
  const constraints = matchedGuardrails.map((g) => `- ${g.id}: ${g.risk}`);
  constraints.push('- Stay within the source issue scope and referenced files.');
  return constraints.join('\n');
}

function buildTemplateVars(
  issue: Issue,
  domains: string[],
  matchedGuardrails: Guardrail[],
  alwaysDocs: DocSection[],
  discoveredDocs: DocSection[],
  discoveryDocs: DocSection[],
  missingDocs: DocSection[],
  repoPath: string,
  discoveredSources: DocSection[]
): TemplateVars {
  const checklist = issue.body
    .split('\n')
    .filter((l) => l.trim().startsWith('- [ ]'))
    .join('\n') || '(none found)';

  const missingList = missingDocs.length > 0
    ? missingDocs.map((d) => `- \`${d.filePath}\` — not found${renderReasonSuffix(d, true)}`).join('\n')
    : '(none)';

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
    matched_rule_ids: matchedGuardrails.map(g => g.id).join(', ') || '(none)',
    matched_rule_descriptions: matchedGuardrails.map(g => g.risk).join(', ') || '(none)',
    matched_guardrails: matchedGuardrails.length > 0
      ? matchedGuardrails.map(g => `- **${g.id}**: ${g.risk}`).join('\n')
      : '(none matched)',
    matched_hints: '(none)',
    prompt_always_files: renderPathList(alwaysDocs.filter((d) => d.found)),
    prompt_discovered_docs: renderPathList(discoveredDocs),
    prompt_rule_docs: renderPathList(discoveryDocs.filter((d) => d.found)),
    prompt_discovered_sources: renderPathList(discoveredSources),
    prompt_implementation_constraints: renderImplementationConstraints(matchedGuardrails),
    always_docs: renderDocList(alwaysDocs.filter((d) => d.found)),
    discovered_docs: renderDocList(discoveredDocs),
    rule_docs: renderDocList(discoveryDocs.filter((d) => d.found)),
    missing_docs: missingList,
    discovered_sources: renderDocList(discoveredSources),
    repo_path: repoPath,
    generated_at: new Date().toISOString(),
  };
}

function mergeReasonSignals(primary: DocSection[], secondary: DocSection[]): DocSection[] {
  const secondaryByPath = new Map(secondary.map((doc) => [doc.filePath, doc]));
  return primary.map((doc) => {
    const match = secondaryByPath.get(doc.filePath);
    if (!match) return doc;

    const reasons = new Set<string>(doc.reasons ?? []);
    const mappedReason = reasonForKind(match.kind);
    if (mappedReason) reasons.add(mappedReason);

    return { ...doc, reasons: [...reasons] };
  });
}

function mergeMissingSections(primary: DocSection[], secondary: DocSection[]): DocSection[] {
  const merged = new Map<string, DocSection>();

  for (const doc of [...primary, ...secondary]) {
    const existing = merged.get(doc.filePath);
    if (!existing) {
      merged.set(doc.filePath, doc);
      continue;
    }

    const reasons = new Set<string>([...(existing.reasons ?? []), ...(doc.reasons ?? [])]);
    const mappedExisting = reasonForKind(existing.kind);
    const mappedCurrent = reasonForKind(doc.kind);
    if (mappedExisting) reasons.add(mappedExisting);
    if (mappedCurrent) reasons.add(mappedCurrent);
    merged.set(doc.filePath, { ...existing, reasons: [...reasons] });
  }

  return [...merged.values()];
}

function reasonForKind(kind: DocSection['kind']): string | null {
  switch (kind) {
    case 'always':
      return 'always_read';
    case 'rule':
      return 'rule-matched';
    case 'discovered':
      return 'auto-discovered';
    case 'source':
      return 'auto-discovered';
    default:
      return null;
  }
}

function renderReasonLine(doc: DocSection): string {
  if (!doc.reasons || doc.reasons.length === 0) return '';
  return `_${doc.reasons.join('; ')}_\n\n`;
}

function renderReasonSuffix(doc: DocSection, parenthetical: boolean = false): string {
  if (!doc.reasons || doc.reasons.length === 0) return '';
  const rendered = doc.reasons.join('; ');
  return parenthetical ? ` (${rendered})` : ` — ${rendered}`;
}
