import path from 'path';
import fs from 'fs';
import { safeReadFile } from '../utils/fs.js';
import type { DocSection, DocSourceKind } from './types.js';
import type { Issue } from '../github/types.js';

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

// Scan the repo for relevant docs, score by keyword match, return top results.
// Excludes paths already loaded via always_read or rules.
export async function discoverRelevantDocs(
  issue: Issue,
  repoPath: string,
  excludePaths: Set<string>
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

  return scored.slice(0, 5).map(({ filePath, content }) => ({
    filePath,
    content,
    found: true,
    kind: 'discovered' as DocSourceKind,
  }));
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

async function gatherCandidates(repoPath: string, exclude: Set<string>): Promise<string[]> {
  const candidates: string[] = [];

  // Fixed high-value files
  for (const fixed of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
    if (!exclude.has(fixed) && fs.existsSync(path.join(repoPath, fixed))) {
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
      walkMarkdown(full, repoPath, exclude, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const rel = path.relative(repoPath, full);
      if (!exclude.has(rel)) results.push(rel);
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
  const sample = content.slice(0, 2000).toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (pathLower.includes(kw)) score += 2;
    if (sample.includes(kw)) score += 1;
  }
  return score;
}
