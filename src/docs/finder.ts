import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { safeReadFile } from '../utils/fs.js';
import { isPlanDiscoveryExcluded } from './exclusions.js';
import type { DocSection, DocSourceKind } from './types.js';
import type { Issue } from '../github/types.js';
import type { SafeReadFileResult } from '../utils/fs.js';

type SafeReadFileFailure = Extract<SafeReadFileResult, { content: null }>;
type ScoredReference = {
  filePath: string;
  score: number;
  content: string;
  found: boolean;
  readStatus?: DocSection['readStatus'];
  readErrorCode?: string;
  truncated?: boolean;
  truncatedBytes?: number;
  originalBytes?: number;
};

const EXPLICIT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.go', '.md', '.mdx', '.json', '.jsonc', '.yml', '.yaml', '.sql', '.css', '.html', '.sh',
]);
const ROOT_DOC_CANDIDATES = ['README.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md'] as const;
const EXPLICIT_ROOT_FILES = new Set<string>(ROOT_DOC_CANDIDATES);
const DOC_EXTENSIONS = new Set(['.md', '.mdx']);
const ISSUE_MENTIONED_REASON = 'mentioned in issue';
const SOURCE_SNIPPET_BYTES = 500;

// Load explicitly listed doc paths with a given kind label.
// Failed reads keep their source kind and carry a deterministic read status.
export async function loadExplicitDocs(
  docPaths: string[],
  repoPath: string,
  kind: 'always' | 'rule'
): Promise<DocSection[]> {
  const unique = [...new Set(docPaths)];
  return Promise.all(
    unique.map(async (docPath): Promise<DocSection> => {
      validateDocPath(docPath, repoPath);
      const absolute = path.resolve(repoPath, docPath);
      const readResult = await safeReadFile(absolute);
      if (readResult.status !== 'ok') {
        return unreadableDocSection(docPath, kind, readResult);
      }
      return { filePath: docPath, content: readResult.content, found: true, kind };
    })
  );
}

// Load the built-in core preset from the spec-injector package directory.
export async function loadCorePreset(): Promise<DocSection> {
  const presetPath = fileURLToPath(new URL('../../presets/core/ai-collaboration.md', import.meta.url));
  const readResult = await safeReadFile(presetPath);
  if (readResult.status === 'missing') {
    throw new Error('Core preset not found: presets/core/ai-collaboration.md');
  }
  if (readResult.status !== 'ok') {
    throw new Error(`Core preset read failed: presets/core/ai-collaboration.md (${readResult.code ?? readResult.status})`);
  }
  return {
    filePath: 'presets/core/ai-collaboration.md',
    content: readResult.content,
    found: true,
    kind: 'built-in-preset',
  };
}

// Scan the repo for relevant docs, score by keyword match, return top results.
// Excludes paths already loaded via always_read or rules.
export async function discoverRelevantDocs(
  issue: Issue,
  repoPath: string,
  excludePaths: Set<string>,
  maxDocs: number = 5
): Promise<DocSection[]> {
  const keywords = tokenize(`${issue.title} ${issue.body}`);
  if (keywords.length === 0) return [];

  const candidates = await gatherCandidates(repoPath, excludePaths);
  const scored: ScoredReference[] = [];

  for (const relPath of candidates) {
    const absolute = path.resolve(repoPath, relPath);
    const readResult = await safeReadFile(absolute);
    if (readResult.status !== 'ok') {
      const score = scorePath(keywords, relPath);
      if (score > 0) scored.push({
        filePath: relPath,
        score,
        content: '',
        found: false,
        readStatus: readResult.status,
        readErrorCode: readResult.code,
      });
      continue;
    }
    const score = scoreDoc(keywords, relPath, readResult.content);
    if (score > 0) scored.push({ filePath: relPath, score, content: readResult.content, found: true });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxDocs).map(({ filePath, content, found, readStatus, readErrorCode }) => ({
    filePath,
    content,
    found,
    readStatus,
    readErrorCode,
    kind: 'discovered' as DocSourceKind,
  }));
}

export async function extractExplicitIssueFileReferences(
  issue: Issue,
  repoPath: string
): Promise<{ docs: DocSection[]; sources: DocSection[]; missing: DocSection[] }> {
  const candidates = collectExplicitPathCandidates(issue.body);
  const totalConfirmedBasenameCounts = await collectConfirmedFullPathBasenameCounts(candidates, repoPath);
  const docs: DocSection[] = [];
  const sources: DocSection[] = [];
  const missing: DocSection[] = [];
  const seenConfirmedBasenameCounts = new Map<string, number>();
  let repoPathAliasCandidates: string[] | null = null;

  for (const filePath of candidates) {
    validateDocPath(filePath, repoPath);
    const absolute = path.resolve(repoPath, filePath);
    const isDoc = isDocReferencePath(filePath);
    const kind = isDoc ? 'issue-doc' : 'issue-source';
    const readResult = await safeReadFile(absolute);

    if (readResult.status !== 'ok') {
      const pathAliasHints = readResult.status === 'missing'
        ? findPathAliasHints(
            filePath,
            repoPathAliasCandidates ??= collectPathAliasCandidatePaths(repoPath)
          )
        : undefined;

      if (isCoveredBySingleConfirmedFullPathBasename(
        filePath,
        seenConfirmedBasenameCounts,
        totalConfirmedBasenameCounts,
        pathAliasHints
      )) {
        continue;
      }

      missing.push({
        filePath,
        content: '',
        found: false,
        kind,
        readStatus: readResult.status,
        readErrorCode: readResult.code,
        reasons: [ISSUE_MENTIONED_REASON],
        pathAliasHints,
      });
      continue;
    }

    const section: DocSection = {
      filePath,
      content: readResult.content,
      found: true,
      kind,
      reasons: [ISSUE_MENTIONED_REASON],
    };

    if (isDoc) {
      docs.push(section);
    } else {
      sources.push(section);
    }

    recordConfirmedFullPathBasename(filePath, seenConfirmedBasenameCounts);
  }

  return { docs, sources, missing };
}

// --- internals ---

function validateDocPath(docPath: string, repoPath: string): void {
  if (path.isAbsolute(docPath)) {
    throw new Error(`Doc path is outside target repo: ${docPath}`);
  }
  const absolute = path.resolve(repoPath, docPath);
  if (!absolute.startsWith(path.resolve(repoPath) + path.sep)) {
    throw new Error(`Doc path is outside target repo: ${docPath}`);
  }
}

function collectExplicitPathCandidates(body: string): string[] {
  const candidates: Array<{ index: number; path: string }> = [];

  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    const normalized = normalizeExplicitPathCandidate(match[1]);
    if (normalized) candidates.push({ index: match.index ?? 0, path: normalized });
  }

  for (const match of body.matchAll(/\[([^\]\n]+)\]\(([^\)\n]+)\)/g)) {
    if (match.index !== undefined && body[match.index - 1] === '!') continue;
    const labelPath = normalizeExplicitPathCandidate(match[1]);
    if (labelPath) candidates.push({ index: match.index ?? 0, path: labelPath });

    const targetPath = normalizeMarkdownLinkTargetPathCandidate(match[2]);
    if (targetPath) candidates.push({ index: match.index ?? 0, path: targetPath });
  }

  let offset = 0;
  for (const line of body.split('\n')) {
    const normalized = normalizeBulletPathCandidate(line);
    if (normalized) {
      const lineIndex = line.indexOf(normalized);
      candidates.push({
        index: offset + (lineIndex >= 0 ? lineIndex : 0),
        path: normalized,
      });
    }
    offset += line.length + 1;
  }

  candidates.sort((a, b) => a.index - b.index);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    deduped.push(candidate.path);
  }

  return deduped;
}

async function collectConfirmedFullPathBasenameCounts(
  candidates: string[],
  repoPath: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const filePath of candidates) {
    if (!isFullRepoRelativePath(filePath)) continue;

    validateDocPath(filePath, repoPath);
    const absolute = path.resolve(repoPath, filePath);
    const readResult = await safeReadFile(absolute);
    if (readResult.status !== 'ok') continue;

    const basename = path.posix.basename(filePath).toLowerCase();
    counts.set(basename, (counts.get(basename) ?? 0) + 1);
  }

  return counts;
}

function isCoveredBySingleConfirmedFullPathBasename(
  filePath: string,
  seenConfirmedBasenameCounts: Map<string, number>,
  totalConfirmedBasenameCounts: Map<string, number>,
  pathAliasHints: DocSection['pathAliasHints']
): boolean {
  if (isFullRepoRelativePath(filePath)) return false;
  if (pathAliasHints?.some((hint) => hint.kind === 'ambiguous-same-basename-candidates')) return false;
  const basename = path.posix.basename(filePath).toLowerCase();
  return (
    (seenConfirmedBasenameCounts.get(basename) ?? 0) >= 1 &&
    totalConfirmedBasenameCounts.get(basename) === 1
  );
}

function recordConfirmedFullPathBasename(
  filePath: string,
  confirmedBasenameCounts: Map<string, number>
): void {
  if (!isFullRepoRelativePath(filePath)) return;
  const basename = path.posix.basename(filePath).toLowerCase();
  confirmedBasenameCounts.set(basename, (confirmedBasenameCounts.get(basename) ?? 0) + 1);
}

function isFullRepoRelativePath(filePath: string): boolean {
  return filePath.includes('/');
}

function normalizeBulletPathCandidate(line: string): string | null {
  const match = line.match(/^\s*(?:[-*]|\d+\.)\s+([A-Za-z0-9._/-]+)\s*$/);
  if (!match) return null;
  return normalizeExplicitPathCandidate(match[1]);
}

function normalizeExplicitPathCandidate(candidate: string): string | null {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('://')) return null;
  if (trimmed.startsWith('/')) return null;
  if (trimmed.includes('#')) return null;
  if (!/^[A-Za-z0-9._/-]+$/.test(trimmed)) return null;

  const normalized = path.posix.normalize(trimmed);
  if (normalized === '.' || normalized === '..') return null;
  if (normalized.startsWith('../')) return null;
  if (path.posix.isAbsolute(normalized)) return null;
  if (normalized.split('/').some((segment) => segment === '..' || segment.length === 0)) return null;
  if (!hasRecognizedRepoFileShape(normalized)) return null;

  return normalized;
}

function normalizeMarkdownLinkTargetPathCandidate(candidate: string): string | null {
  const target = extractMarkdownLinkDestination(candidate);
  if (!target) return null;

  const normalized = normalizeExplicitPathCandidate(target);
  if (!normalized) return null;
  if (normalized.startsWith('api/')) return null;
  return normalized;
}

function extractMarkdownLinkDestination(candidate: string): string | null {
  const trimmed = candidate.trim();
  if (trimmed.length === 0) return null;

  const angleMatch = trimmed.match(/^<([^<>\s]+)>(?:\s+(["'])([^"']*)\2)?$/);
  if (angleMatch) return angleMatch[1];
  if (trimmed.startsWith('<') || trimmed.endsWith('>')) return null;

  const titleMatch = trimmed.match(/^([^\s]+)\s+(["'])([^"']*)\2$/);
  if (titleMatch) return titleMatch[1];

  if (/\s/.test(trimmed)) return null;
  return trimmed;
}

function hasRecognizedRepoFileShape(filePath: string): boolean {
  if (EXPLICIT_ROOT_FILES.has(filePath)) return true;
  return EXPLICIT_FILE_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

function isDocReferencePath(filePath: string): boolean {
  if (EXPLICIT_ROOT_FILES.has(filePath)) return true;
  return DOC_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase());
}

async function gatherCandidates(repoPath: string, exclude: Set<string>): Promise<string[]> {
  const candidates: string[] = [];

  // Fixed high-value files
  for (const fixed of ROOT_DOC_CANDIDATES) {
    if (!isPlanDiscoveryExcluded(fixed, exclude) && fs.existsSync(path.join(repoPath, fixed))) {
      candidates.push(fixed);
    }
  }

  // Walk docs/
  const docsDir = path.join(repoPath, 'docs');
  if (fs.existsSync(docsDir) && fs.statSync(docsDir).isDirectory()) {
    walkMarkdown(docsDir, repoPath, exclude, candidates);
  }

  return candidates;
}

function walkMarkdown(
  dir: string,
  repoPath: string,
  exclude: Set<string>,
  results: string[]
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const relDir = path.relative(repoPath, full);
      if (isPlanDiscoveryExcluded(relDir, exclude)) continue;
      walkMarkdown(full, repoPath, exclude, results);
    } else if (entry.isFile() && DOC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const rel = path.relative(repoPath, full);
      if (!isPlanDiscoveryExcluded(rel, exclude)) results.push(rel);
    }
  }
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was',
  'not', 'but', 'all', 'have', 'has', 'had', 'its', 'add', 'use',
  'can', 'will', 'should', 'need', 'also', 'into', 'when', 'then',
]);

function tokenize(text: string): string[] {
  return [...new Set(
    text.toLowerCase().split(/\W+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
  )];
}

function scoreDoc(keywords: string[], filePath: string, content: string): number {
  let score = scorePath(keywords, filePath);
  const sample = content.slice(0, 2000).toLowerCase();
  for (const kw of keywords) {
    if (sample.includes(kw)) score += 1;
  }
  return score;
}

function scorePath(keywords: string[], filePath: string): number {
  const pathLower = filePath.toLowerCase();
  const baseLower = path.basename(filePath).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (pathLower.includes(kw)) score += 2;
    if (baseLower.includes(kw)) score += 2;
  }
  return score;
}

// --- source discovery ---

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.py', '.go', '.rs', '.java', '.sol', '.rb', '.graphql']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'vendor', 'coverage']);
const GENERATED_SOURCE_DIRS = new Set(['generated', '__generated__']);
const ALIAS_HINT_SKIP_DIRS = new Set([...SKIP_DIRS, '.spec-injector']);

export async function discoverSourceFiles(
  issue: Issue,
  repoPath: string,
  sourcePaths: string[],
  maxFiles: number
): Promise<DocSection[]> {
  if (sourcePaths.length === 0 || maxFiles <= 0) return [];

  const keywords = tokenize(`${issue.title} ${issue.body}`);
  if (keywords.length === 0) return [];
  const sourceSignals = detectSourceDiscoverySignals(issue);

  const candidates: string[] = [];
  for (const srcPath of sourcePaths) {
    const absolute = path.resolve(repoPath, srcPath);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      walkSource(absolute, repoPath, candidates);
    }
  }

  const scored: ScoredReference[] = [];
  for (const relPath of candidates) {
    const absolute = path.resolve(repoPath, relPath);
    const readResult = await safeReadFile(absolute);
    if (readResult.status !== 'ok') {
      const score = scorePath(keywords, relPath);
      if (score > 0) {
        scored.push({
          filePath: relPath,
          score,
          content: '',
          readStatus: readResult.status,
          readErrorCode: readResult.code,
          found: false,
        });
      }
      continue;
    }
    const snippet = createSourceContentSnippet(readResult.content);
    const score = scoreSrc(keywords, relPath, readResult.content, sourceSignals);
    if (score > 0) {
      scored.push({
        filePath: relPath,
        score,
        content: snippet.content,
        found: true,
        truncated: snippet.truncated,
        truncatedBytes: snippet.truncatedBytes,
        originalBytes: snippet.originalBytes,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxFiles).map((entry) => ({
    filePath: entry.filePath,
    content: entry.content,
    found: entry.found,
    readStatus: entry.readStatus,
      readErrorCode: entry.readErrorCode,
      truncated: entry.truncated,
      truncatedBytes: entry.truncatedBytes,
      originalBytes: entry.originalBytes,
      kind: 'source' as DocSourceKind,
    }));
}

function unreadableDocSection(
  filePath: string,
  kind: DocSourceKind,
  readResult: SafeReadFileFailure
): DocSection {
  return {
    filePath,
    content: '',
    found: false,
    kind,
    readStatus: readResult.status,
    readErrorCode: readResult.code,
  };
}

function walkSource(dir: string, repoPath: string, results: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (GENERATED_SOURCE_DIRS.has(entry.name.toLowerCase())) continue;
      walkSource(full, repoPath, results);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      const relPath = normalizeRepoPath(path.relative(repoPath, full));
      if (isGeneratedSourcePath(relPath)) continue;
      results.push(relPath);
    }
  }
}

function isGeneratedSourcePath(filePath: string): boolean {
  const segments = filePath.toLowerCase().split('/');
  if (segments.some((segment) => GENERATED_SOURCE_DIRS.has(segment))) return true;
  return path.posix.basename(filePath).toLowerCase().includes('.generated.');
}

function collectPathAliasCandidatePaths(repoPath: string): string[] {
  const results: string[] = [];
  walkPathAliasCandidates(repoPath, repoPath, results);
  results.sort(comparePath);
  return results;
}

function walkPathAliasCandidates(dir: string, repoPath: string, results: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => comparePath(a.name, b.name));
  for (const entry of entries) {
    if (ALIAS_HINT_SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkPathAliasCandidates(full, repoPath, results);
      continue;
    }
    if (!entry.isFile()) continue;

    const relativePath = normalizeRepoPath(path.relative(repoPath, full));
    if (isAliasHintCandidatePath(relativePath)) results.push(relativePath);
  }
}

function isAliasHintCandidatePath(filePath: string): boolean {
  const basename = path.posix.basename(filePath);
  return EXPLICIT_FILE_EXTENSIONS.has(path.posix.extname(filePath)) || EXPLICIT_ROOT_FILES.has(basename);
}

function findPathAliasHints(filePath: string, candidatePaths: string[]): DocSection['pathAliasHints'] {
  const normalizedFilePath = normalizeRepoPath(filePath);
  const basename = path.posix.basename(normalizedFilePath).toLowerCase();
  const sameBasenameCandidates = candidatePaths.filter((candidatePath) =>
    candidatePath !== normalizedFilePath &&
    path.posix.basename(candidatePath).toLowerCase() === basename
  );

  if (sameBasenameCandidates.length === 0) return undefined;

  if (sameBasenameCandidates.length === 1) {
    return [{
      kind: 'possible-moved-path',
      reason: 'same basename',
      candidatePaths: sameBasenameCandidates,
      candidateCount: 1,
    }];
  }

  return [{
    kind: 'ambiguous-same-basename-candidates',
    reason: 'same basename',
    candidatePaths: sameBasenameCandidates.slice(0, 3),
    candidateCount: sameBasenameCandidates.length,
  }];
}

function normalizeRepoPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function comparePath(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function createSourceContentSnippet(content: string): {
  content: string;
  truncated: boolean;
  truncatedBytes: number;
  originalBytes: number;
} {
  const sourceBuffer = Buffer.from(content, 'utf8');
  const originalBytes = sourceBuffer.byteLength;
  if (originalBytes <= SOURCE_SNIPPET_BYTES) {
    return {
      content,
      truncated: false,
      truncatedBytes: originalBytes,
      originalBytes,
    };
  }

  let safeEnd = SOURCE_SNIPPET_BYTES;
  while (
    safeEnd > 0 &&
    safeEnd < sourceBuffer.length &&
    (sourceBuffer[safeEnd] & 0b11000000) === 0b10000000
  ) {
    safeEnd -= 1;
  }

  const truncatedContent = sourceBuffer.subarray(0, safeEnd).toString('utf8');
  return {
    content: truncatedContent,
    truncated: true,
    truncatedBytes: safeEnd,
    originalBytes,
  };
}

type SourceDiscoverySignals = {
  checkoutLineMutation: boolean;
  addToCartFlow: boolean;
  serverAction: boolean;
  graphqlMutation: boolean;
};

function detectSourceDiscoverySignals(issue: Issue): SourceDiscoverySignals {
  const text = `${issue.title} ${issue.body}`.toLowerCase();
  return {
    checkoutLineMutation: /\bcheckout\s*lines?\s*add\b|\bcheckoutlinesadd\b|\bcheckout[-_\s]*line\b/.test(text),
    addToCartFlow: /\badd[-_\s]*to[-_\s]*cart\b|\bcart\b/.test(text),
    serverAction: /\bserver[-_\s]*action\b|\bform[-_\s]*action\b/.test(text),
    graphqlMutation: /\bgraphql\b|\bmutation\b|\bcheckoutlinesadd\b/.test(text),
  };
}

function scoreSrc(
  keywords: string[],
  filePath: string,
  content: string,
  signals: SourceDiscoverySignals
): number {
  const pathLower = filePath.toLowerCase();
  const baseLower = path.basename(filePath).toLowerCase();
  const sample = content.slice(0, 2000).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (pathLower.includes(kw)) score += 2;
    if (baseLower.includes(kw)) score += 2;
    if (sample.includes(kw)) score += 1;
  }
  score += scoreCheckoutRelatedSource(pathLower, baseLower, sample, signals);
  return score;
}

function scoreCheckoutRelatedSource(
  pathLower: string,
  baseLower: string,
  sample: string,
  signals: SourceDiscoverySignals
): number {
  if (!signals.addToCartFlow && !signals.checkoutLineMutation && !signals.serverAction && !signals.graphqlMutation) {
    return 0;
  }

  let score = 0;
  const pathHasCheckout = pathLower.includes('checkout');
  const pathHasGraphql = pathLower.includes('graphql');
  const pathHasCart = pathLower.includes('cart');
  const pathHasLine = pathLower.includes('line');
  const pathHasMutation = pathLower.includes('mutation') || baseLower.endsWith('.graphql');
  const sampleHasCheckoutLineMutation = sample.includes('checkoutlinesadd') || sample.includes('checkout lines add');
  const sampleHasGraphqlMutation = sample.includes('graphql') || sample.includes('mutation');

  if (signals.checkoutLineMutation) {
    if (pathHasCheckout && pathHasLine) score += 8;
    if (pathHasCheckout) score += 5;
    if (sampleHasCheckoutLineMutation) score += 6;
  }

  if (signals.graphqlMutation) {
    if (pathHasGraphql && pathHasMutation) score += 8;
    if (pathHasGraphql) score += 5;
    if (sampleHasGraphqlMutation) score += 3;
  }

  if (signals.addToCartFlow) {
    if (pathHasCart) score += 4;
    if (pathHasCheckout) score += 3;
  }

  if (signals.serverAction) {
    if (pathHasCheckout || pathHasGraphql) score += 2;
  }

  return score;
}
