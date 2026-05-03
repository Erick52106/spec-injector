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
};

const EXPLICIT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.go', '.md', '.json', '.yml', '.yaml', '.sql', '.css', '.html', '.sh',
]);
const EXPLICIT_ROOT_FILES = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
const DOC_EXTENSIONS = new Set(['.md']);
const ISSUE_MENTIONED_REASON = 'mentioned in issue';

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
  const docs: DocSection[] = [];
  const sources: DocSection[] = [];
  const missing: DocSection[] = [];
  const confirmedBasenameCounts = new Map<string, number>();
  let repoPathAliasCandidates: string[] | null = null;

  for (const filePath of candidates) {
    validateDocPath(filePath, repoPath);
    const absolute = path.resolve(repoPath, filePath);
    const isDoc = isDocReferencePath(filePath);
    const kind = isDoc ? 'issue-doc' : 'issue-source';
    const readResult = await safeReadFile(absolute);

    if (readResult.status !== 'ok') {
      if (isCoveredBySingleConfirmedFullPathBasename(filePath, confirmedBasenameCounts)) {
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
        pathAliasHints: readResult.status === 'missing'
          ? findPathAliasHints(
              filePath,
              repoPathAliasCandidates ??= collectPathAliasCandidatePaths(repoPath)
            )
          : undefined,
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

    recordConfirmedFullPathBasename(filePath, confirmedBasenameCounts);
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
  const candidates = new Set<string>();

  for (const match of body.matchAll(/`([^`\n]+)`/g)) {
    const normalized = normalizeExplicitPathCandidate(match[1]);
    if (normalized) candidates.add(normalized);
  }

  for (const line of body.split('\n')) {
    const normalized = normalizeBulletPathCandidate(line);
    if (normalized) candidates.add(normalized);
  }

  return [...candidates];
}

function isCoveredBySingleConfirmedFullPathBasename(
  filePath: string,
  confirmedBasenameCounts: Map<string, number>
): boolean {
  if (isFullRepoRelativePath(filePath)) return false;
  const basename = path.posix.basename(filePath).toLowerCase();
  return confirmedBasenameCounts.get(basename) === 1;
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
  for (const fixed of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
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
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
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

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.sol', '.rb']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'vendor', 'coverage']);
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
    const score = scoreSrc(keywords, relPath, readResult.content);
    if (score > 0) scored.push({ filePath: relPath, score, content: readResult.content.slice(0, 500), found: true });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxFiles).map((entry) => ({
    filePath: entry.filePath,
    content: entry.content,
    found: entry.found,
    readStatus: entry.readStatus,
    readErrorCode: entry.readErrorCode,
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
      walkSource(full, repoPath, results);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(path.relative(repoPath, full));
    }
  }
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

function scoreSrc(keywords: string[], filePath: string, content: string): number {
  const pathLower = filePath.toLowerCase();
  const baseLower = path.basename(filePath).toLowerCase();
  const sample = content.slice(0, 2000).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (pathLower.includes(kw)) score += 2;
    if (baseLower.includes(kw)) score += 2;
    if (sample.includes(kw)) score += 1;
  }
  return score;
}
