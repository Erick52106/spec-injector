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
import { classifyDomainsWithEvidence } from '../classifier/domain.js';
import { getWorktreeState } from '../utils/git.js';
import type { TemplateVars } from '../template/types.js';
import type { Guardrail } from '../config/types.js';
import type { Issue } from '../github/types.js';
import type { DocSection } from '../docs/types.js';
import type { DomainClassificationResult } from '../classifier/domain.js';

export async function plan(
  issueRef: string,
  opts: { repo?: string; config?: string; dryRun?: boolean; verbose?: boolean; format?: string }
): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const format = opts.format ?? 'full';
  if (!['full', 'prompt'].includes(format)) {
    throw new Error(`Unsupported plan format: ${format}. Expected "full" or "prompt".`);
  }

  if (opts.verbose) console.log(`→ Target repo: ${repoPath}`);
  warnIfTargetRepoWorktreeStateNeedsReview(repoPath);

  // 1. Fetch issue
  if (opts.verbose) console.log('→ Fetching issue...');
  const issue = await fetchIssue(issueRef, repoPath);
  console.log(`✓ Issue #${issue.number} fetched: ${issue.title}${issue.state === 'closed' ? ' [CLOSED]' : ''}`);
  const classification = classifyDomainsWithEvidence(issue);
  const domains = classification.domains;
  console.log(`✓ Detected domains: ${domains.join(', ') || '(none)'}`);
  if (opts.verbose) renderClassificationDiagnostics(classification);

  // 2. Load config
  if (opts.verbose) console.log('→ Loading config...');
  const config = await loadConfig(repoPath, { configPath: opts.config });

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
  const explicitReferences = await extractExplicitIssueFileReferences(issue, repoPath);
  const discoveredSources = await discoverSourceFiles(issue, repoPath, sourcePaths, maxSourceFiles, explicitReferences.sources);
  const explicitDocs = mergeReasonSignals(explicitReferences.docs, [...alwaysDocs, ...discoveryDocs, ...discoveredDocs]);
  const explicitSources = mergeReasonSignals(explicitReferences.sources, discoveredSources);
  const explicitDocPaths = new Set(explicitDocs.map((d) => d.filePath));
  const explicitSourcePaths = new Set(explicitSources.map((d) => d.filePath));
  const filteredAlwaysDocs = alwaysDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveryDocs = discoveryDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveredDocs = discoveredDocs.filter((d) => !explicitDocPaths.has(d.filePath));
  const filteredDiscoveredSources = discoveredSources.filter((d) => !explicitSourcePaths.has(d.filePath));
  const missingDocs = mergeMissingSections(
    [
      ...filteredAlwaysDocs,
      ...filteredDiscoveryDocs,
      ...filteredDiscoveredDocs,
      ...filteredDiscoveredSources,
    ].filter((d) => !d.found),
    explicitReferences.missing
  );
  const combinedSourceReferences = [...explicitSources, ...filteredDiscoveredSources.filter((d) => d.found)];

  // 7. Summarise
  const foundAlwaysDocs = filteredAlwaysDocs.filter((d) => d.found);
  const repoAlwaysReadCount = foundAlwaysDocs.filter((d) => d.kind === 'always').length;
  const builtInPresetCount = foundAlwaysDocs.filter((d) => d.kind === 'built-in-preset').length;
  console.log(`✓ Docs — repo always_read: ${repoAlwaysReadCount}, built-in presets: ${builtInPresetCount}, discovered: ${filteredDiscoveredDocs.filter((d) => d.found).length}, explicit: ${explicitDocs.length + filteredDiscoveryDocs.filter(d => d.found).length}, missing/read issues: ${missingDocs.length}, sources: ${combinedSourceReferences.length}`);
  if (missingDocs.length > 0) {
    for (const d of missingDocs) console.warn(`  ⚠  ${renderReadDiagnosticLabel(d)}: ${d.filePath}${renderReadDiagnosticHintSuffix(d)}${renderReadErrorCodeSuffix(d)}`);
  }

  // 8. Build vars and render
  const vars = buildTemplateVars(
    issue,
    domains,
    matchedGuardrails,
    filteredAlwaysDocs,
    explicitDocs,
    filteredDiscoveredDocs,
    filteredDiscoveryDocs,
    missingDocs,
    repoPath,
    explicitSources,
    filteredDiscoveredSources
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

function warnIfTargetRepoWorktreeStateNeedsReview(repoPath: string): void {
  const state = getWorktreeState(repoPath);
  if (state.kind === 'clean' || state.kind === 'not-git') return;

  if (state.kind === 'dirty') {
    console.warn('⚠ Target repo dirty: target repo has uncommitted or untracked changes; generated references may reflect the current worktree. Review repo state with a human before implementation. spec-injector will continue without modifying files.');
    return;
  }

  console.warn('⚠ Unable to determine target repo worktree state; generated references may reflect the current worktree. Review repo state with a human before implementation. spec-injector will continue without modifying files.');
}

function renderDocList(docs: DocSection[]): string {
  if (docs.length === 0) return '(none)';
  return docs
    .map((d) => {
      const metadataLine = renderMetadataLine(d);
      return `### ${d.filePath}\n\n${metadataLine}${d.content.trim()}`;
    })
    .join('\n\n---\n\n');
}

function renderPathList(docs: DocSection[]): string {
  if (docs.length === 0) return '(none)';
  return docs.map((d) => `- \`${d.filePath}\`${renderMetadataSuffix(d)}`).join('\n');
}

function renderImplementationConstraints(matchedGuardrails: Guardrail[]): string {
  const constraints = matchedGuardrails.map((g) => `- ${g.id}: ${g.risk}`);
  constraints.push('- Stay within the source issue scope and referenced files.');
  return constraints.join('\n');
}

function renderClassificationDiagnostics(classification: DomainClassificationResult): void {
  console.log('→ Detected domain evidence:');
  if (classification.evidence.length === 0) {
    console.log('  - (none)');
  } else {
    for (const evidence of classification.evidence) {
      console.log(`  - ${evidence.domain}: ${evidence.source} matched "${evidence.term}"`);
    }
  }

  console.log('→ Rejected domain signals:');
  if (classification.rejected.length === 0) {
    console.log('  - (none)');
    return;
  }

  for (const rejected of classification.rejected) {
    console.log(`  - ${rejected.domain}: ${rejected.source} signal "${rejected.signal}" suppressed as ${rejected.reason}`);
  }
}

function buildTemplateVars(
  issue: Issue,
  domains: string[],
  matchedGuardrails: Guardrail[],
  alwaysDocs: DocSection[],
  issueDocs: DocSection[],
  discoveredDocs: DocSection[],
  discoveryDocs: DocSection[],
  missingDocs: DocSection[],
  repoPath: string,
  issueSources: DocSection[],
  discoveredSources: DocSection[]
): TemplateVars {
  const checklist = extractIssueChecklist(issue.body);

  const missingList = missingDocs.length > 0
    ? missingDocs.map((d) => `- \`${d.filePath}\` — ${renderReadIssueLabel(d)}${renderReadIssueMetadataSuffix(d)}`).join('\n')
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
    prompt_issue_docs: renderPathList(issueDocs),
    prompt_issue_sources: renderPathList(issueSources),
    prompt_discovered_docs: renderPathList(discoveredDocs.filter((d) => d.found)),
    prompt_rule_docs: renderPathList(discoveryDocs.filter((d) => d.found)),
    prompt_discovered_sources: renderPathList(discoveredSources.filter((d) => d.found)),
    prompt_implementation_constraints: renderImplementationConstraints(matchedGuardrails),
    always_docs: renderDocList(alwaysDocs.filter((d) => d.found)),
    issue_docs: renderDocList(issueDocs),
    issue_sources: renderDocList(issueSources),
    discovered_docs: renderDocList(discoveredDocs.filter((d) => d.found)),
    rule_docs: renderDocList(discoveryDocs.filter((d) => d.found)),
    missing_docs: missingList,
    discovered_sources: renderDocList(discoveredSources.filter((d) => d.found)),
    repo_path: repoPath,
    generated_at: new Date().toISOString(),
  };
}

function extractIssueChecklist(body: string): string {
  const lines = body.split('\n');
  const extracted: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parentMatch = lines[index]?.match(/^([ \t]*)- \[ \] .+/);
    if (!parentMatch) continue;

    const parentIndent = parentMatch[1]?.length ?? 0;
    if (parentIndent > 0) continue;
    extracted.push(lines[index].replace(/[ \t]+$/u, ''));

    let nestedIndex = index + 1;
    while (nestedIndex < lines.length) {
      const line = lines[nestedIndex] ?? '';
      if (line.trim().length === 0) {
        nestedIndex += 1;
        continue;
      }

      const indentation = line.match(/^[ \t]*/u)?.[0].length ?? 0;
      if (indentation <= parentIndent) break;

      if (isNestedChecklistSubcase(line)) {
        extracted.push(line.replace(/[ \t]+$/u, ''));
      }

      nestedIndex += 1;
    }

    index = nestedIndex - 1;
  }

  return extracted.join('\n') || '(none found)';
}

function isNestedChecklistSubcase(line: string): boolean {
  return /^[ \t]+(?:-|\*|\d+\.) (?:\[[ xX]\] )?.+/u.test(line);
}

function renderReadIssueLabel(doc: DocSection): string {
  switch (doc.readStatus ?? 'missing') {
    case 'unreadable':
      return 'unreadable';
    case 'read-error':
      return 'read failed';
    case 'invalid-discovery-source':
      return 'invalid discovery.source entry';
    case 'missing':
      return 'not found';
  }
}

function renderReadDiagnosticLabel(doc: DocSection): string {
  switch (doc.readStatus ?? 'missing') {
    case 'unreadable':
      return 'Unreadable';
    case 'read-error':
      return 'Read failed';
    case 'invalid-discovery-source':
      return 'Invalid discovery.source entry';
    case 'missing':
      return 'Not found';
  }
}

function renderReadIssueMetadataSuffix(doc: DocSection): string {
  const metadata = [
    ...(doc.readStatus && doc.readStatus !== 'missing' && doc.readErrorCode ? [doc.readErrorCode] : []),
    ...renderDocMetadata(doc),
  ];
  if (metadata.length === 0) return '';
  return ` (${metadata.join('; ')})`;
}

function renderReadErrorCodeSuffix(doc: DocSection): string {
  if (!doc.readStatus || doc.readStatus === 'missing' || !doc.readErrorCode) return '';
  return ` (${doc.readErrorCode})`;
}

function renderReadDiagnosticHintSuffix(doc: DocSection): string {
  if (doc.readStatus === 'invalid-discovery-source' && doc.reasons && doc.reasons.length > 0) {
    return `; ${doc.reasons.join('; ')}`;
  }
  const hint = renderPathAliasHint(doc, { useMarkdown: false });
  return hint ? `; ${hint}` : '';
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
      const reasons = new Set<string>(doc.reasons ?? []);
      const mappedCurrent = reasonForKind(doc.kind);
      if (mappedCurrent) reasons.add(mappedCurrent);
      merged.set(doc.filePath, { ...doc, reasons: [...reasons] });
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
    case 'built-in-preset':
      return 'built-in preset';
    case 'rule':
      return 'rule-matched';
    case 'discovered':
    case 'source':
      return null;
    default:
      return null;
  }
}

function renderMetadataLine(doc: DocSection): string {
  const metadata = renderDocMetadata(doc, { includeSourcePrefix: true });
  if (metadata.length === 0) return '';
  return `_${metadata.join('; ')}_\n\n`;
}

function renderMetadataSuffix(doc: DocSection, parenthetical: boolean = false): string {
  const metadata = renderDocMetadata(doc);
  if (metadata.length === 0) return '';
  const rendered = metadata.join('; ');
  return parenthetical ? ` (${rendered})` : ` — ${rendered}`;
}

function renderDocMetadata(
  doc: DocSection,
  opts: { includeSourcePrefix?: boolean } = {}
): string[] {
  const metadata: string[] = [];
  const sourceLabel = referenceSourceLabel(doc);
  if (sourceLabel) {
    metadata.push(opts.includeSourcePrefix ? `source: ${sourceLabel}` : sourceLabel);
  }
  metadata.push(...(doc.reasons ?? []));
  metadata.push(...renderTruncationMetadata(doc));
  const aliasHint = renderPathAliasHint(doc, { useMarkdown: true });
  if (aliasHint) metadata.push(aliasHint);
  return metadata;
}

function renderTruncationMetadata(doc: DocSection): string[] {
  if (doc.kind !== 'source' || !doc.truncated || !doc.truncatedBytes || !doc.originalBytes || doc.originalBytes <= doc.truncatedBytes) {
    return [];
  }

  return [
    `truncated to first ${doc.truncatedBytes} bytes`,
    `full file at ${doc.filePath}`,
  ];
}

function renderPathAliasHint(
  doc: DocSection,
  opts: { useMarkdown: boolean }
): string | null {
  const hint = doc.pathAliasHints?.[0];
  if (!hint) return null;

  const candidates = opts.useMarkdown
    ? hint.candidatePaths.map((candidatePath) => `\`${candidatePath}\``).join(', ')
    : hint.candidatePaths.join(', ');

  switch (hint.kind) {
    case 'possible-moved-path':
      return `path alias hint: possible moved path ${candidates} (${hint.reason}; not a confirmed issue reference)`;
    case 'ambiguous-same-basename-candidates':
      return `path alias hint: ambiguous same basename candidates (${hint.candidateCount}): ${candidates} (not a confirmed issue reference)`;
  }
}

function referenceSourceLabel(doc: DocSection): string | null {
  switch (doc.kind) {
    case 'always':
      return 'repo always_read';
    case 'built-in-preset':
      return 'built-in preset';
    case 'issue-doc':
    case 'issue-source':
      return 'issue-mentioned';
    case 'discovered':
    case 'source':
      return 'auto-discovered';
    default:
      return null;
  }
}
