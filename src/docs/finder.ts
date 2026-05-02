import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { safeReadFile } from '../utils/fs.js';
import { isPlanDiscoveryExcluded } from './exclusions.js';
import type { DocSection, DocSourceKind } from './types.js';
import type { Issue } from '../github/types.js';

const EXPLICIT_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.go', '.md', '.json', '.yml', '.yaml', '.sql', '.css', '.html', '.sh',
]);
const EXPLICIT_ROOT_FILES = new Set(['README.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
const DOC_EXTENSIONS = new Set(['.md']);
const ISSUE_MENTIONED_REASON = 'mentioned in issue';

// Load explicitly listed doc paths with a given kind label.
// Missing files get kind 'missing' and found: false.
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
      const content = await safeReadFile(absolute);
      if (content === null) {
        return { filePath: docPath, content: '', found: false, kind: 'missing' };
      }
      return { filePath: docPath, content, found: true, kind };
    })
  );
}

// Load the built-in core preset from the spec-injector package directory.
export async function loadCorePreset(): Promise<DocSection> {
  const presetPath = fileURLToPath(new URL('../../presets/core/ai-collaboration.md', import.meta.url));
  const content = await safeReadFile(presetPath);
  if (content === null) {
    throw new Error('Core preset not found: presets/core/ai-collaboration.md');
  }
  return {
    filePath: 'presets/core/ai-collaboration.md',
    content,
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
  const scored: Array<{ filePath: string; score: number; content: string }> = [];

  for (const relPath of candidates) {
    const absolute = path.resolve(repoPath, relPath);
    const content = await safeReadFile(absolute);
    if (content === null) continue;
    const score = scoreDoc(keywords, relPath, content);
    if (score > 0) scored.push({ filePath: relPath, score, content });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxDocs).map(({ filePath, content }) => ({
    filePath,
    content,
    found: true,
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

  for (const filePath of candidates) {
    validateDocPath(filePath, repoPath);
    const absolute = path.resolve(repoPath, filePath);
    const content = await safeReadFile(absolute);
    const isDoc = isDocReferencePath(filePath);

    if (content === null) {
      missing.push({
        filePath,
        content: '',
        found: false,
        kind: 'missing',
        reasons: [ISSUE_MENTIONED_REASON],
      });
      continue;
    }

    const section: DocSection = {
      filePath,
      content,
      found: true,
      kind: isDoc ? 'issue-doc' : 'issue-source',
      reasons: [ISSUE_MENTIONED_REASON],
    };

    if (isDoc) {
      docs.push(section);
    } else {
      sources.push(section);
    }
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

// --- source discovery ---

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.sol', '.rb']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'vendor', 'coverage']);

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

  const scored: Array<{ filePath: string; score: number; content: string }> = [];
  for (const relPath of candidates) {
    const absolute = path.resolve(repoPath, relPath);
    const raw = await safeReadFile(absolute);
    if (raw === null) continue;
    const score = scoreSrc(keywords, relPath, raw);
    if (score > 0) scored.push({ filePath: relPath, score, content: raw.slice(0, 500) });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxFiles).map(({ filePath, content }) => ({
    filePath,
    content,
    found: true,
    kind: 'source' as DocSourceKind,
  }));
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
