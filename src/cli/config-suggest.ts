import fs from 'fs';
import path from 'path';

type Confidence = 'high' | 'medium';

interface CandidateRule {
  confidence: Confidence;
  reason: string;
}

interface Suggestion {
  filePath: string;
  confidence: Confidence;
  reason: string;
  score: number;
}

interface IgnoredPath {
  filePath: string;
  reason: string;
}

interface ScanTarget {
  basePath: string;
  maxDepth: number;
  include: (relativePath: string, entry: fs.Dirent) => boolean;
}

interface ScoredCandidate {
  filePath: string;
  confidence: Confidence;
  reason: string;
  score: number;
}

const CANDIDATE_RULES: Record<string, CandidateRule> = {
  'CLAUDE.md': {
    confidence: 'high',
    reason: 'Claude Code repo-level instruction file',
  },
  'AGENTS.md': {
    confidence: 'high',
    reason: 'agent workflow instruction file',
  },
  'GEMINI.md': {
    confidence: 'high',
    reason: 'Gemini repo-level instruction file',
  },
  'CURSOR.md': {
    confidence: 'high',
    reason: 'Cursor repo-level instruction file',
  },
  'WINDSURF.md': {
    confidence: 'high',
    reason: 'Windsurf repo-level instruction file',
  },
  'docs/ai-guidelines.md': {
    confidence: 'high',
    reason: 'AI collaboration guidelines candidate',
  },
  'docs/security.md': {
    confidence: 'high',
    reason: 'security policy / guardrails candidate',
  },
  'docs/architecture.md': {
    confidence: 'high',
    reason: 'architecture overview candidate',
  },
  'README.md': {
    confidence: 'medium',
    reason: 'project overview candidate',
  },
  'docs/product-spec.md': {
    confidence: 'medium',
    reason: 'product specification candidate',
  },
  'docs/contributing.md': {
    confidence: 'medium',
    reason: 'contribution workflow candidate',
  },
  'docs/development.md': {
    confidence: 'medium',
    reason: 'development workflow candidate',
  },
};

const EXCLUDED_DIRS: Record<string, string> = {
  '.spec-injector/out': 'generated task package output',
  archive: 'archived docs are not current always_read candidates',
  build: 'build output directory',
  dist: 'build output directory',
  'docs/archive': 'archived docs are not current always_read candidates',
  'docs/superpowers': 'superpowers planning docs are not always_read candidates',
  node_modules: 'dependency directory',
};

const SKIP_DIR_NAMES = new Set([
  '.git',
  'archive',
  'build',
  'dist',
  'node_modules',
  'out',
]);

const MAX_SCANNED_CANDIDATES = 64;
const MAX_CONTENT_LINES = 24;
const MAX_CONTENT_BYTES = 4096;

const SCAN_TARGETS: ScanTarget[] = [
  {
    basePath: '.',
    maxDepth: 0,
    include: (relativePath, entry) => entry.isFile() && isMarkdownFile(relativePath) && !relativePath.includes('/'),
  },
  {
    basePath: 'docs',
    maxDepth: 4,
    include: (relativePath, entry) => entry.isFile() && isMarkdownFile(relativePath),
  },
  {
    basePath: '.github',
    maxDepth: 4,
    include: (relativePath, entry) => entry.isFile() && isMarkdownFile(relativePath),
  },
  {
    basePath: '.cursor/rules',
    maxDepth: 3,
    include: (_relativePath, entry) => entry.isFile(),
  },
  {
    basePath: '.windsurf',
    maxDepth: 3,
    include: (_relativePath, entry) => entry.isFile(),
  },
];

const HIGH_PRIORITY_KEYWORDS = [
  'architecture',
  'security',
  'ai instructions',
  'guidelines',
  'workflow',
  'conventions',
  'policy',
];

export function suggestAlwaysRead(repoPath: string): void {
  const suggestions = collectSuggestions(repoPath);
  const high = suggestions.filter((item) => item.confidence === 'high');
  const medium = suggestions.filter((item) => item.confidence === 'medium');
  const ignored = findIgnoredPaths(repoPath);

  console.log(`always_read suggestions for ${repoPath}`);
  console.log('No changes were made to .spec-injector/config.json.');
  console.log('');

  if (high.length === 0 && medium.length === 0) {
    console.log('No always_read candidates found.');
    console.log('Try adding repo-level instruction, security, architecture, or project overview docs first.');
    console.log('');
  }

  printSuggestions('High confidence', high);
  printSuggestions('Medium confidence', medium);
  printIgnored(ignored);
}

function collectSuggestions(repoPath: string): Suggestion[] {
  const suggestions = new Map<string, Suggestion>();

  for (const [candidatePath, rule] of Object.entries(CANDIDATE_RULES)) {
    if (!fileExists(repoPath, candidatePath)) continue;
    suggestions.set(candidatePath, {
      filePath: candidatePath,
      confidence: rule.confidence,
      reason: rule.reason,
      score: fixedRuleScore(rule.confidence),
    });
  }

  for (const candidate of collectScoredCandidates(repoPath)) {
    if (suggestions.has(candidate.filePath)) continue;
    suggestions.set(candidate.filePath, candidate);
  }

  return [...suggestions.values()].sort(compareSuggestions);
}

function collectScoredCandidates(repoPath: string): Suggestion[] {
  const candidates: ScoredCandidate[] = [];

  for (const filePath of scanCandidatePaths(repoPath)) {
    const candidate = scoreCandidate(repoPath, filePath);
    if (!candidate) continue;
    candidates.push(candidate);
    if (candidates.length >= MAX_SCANNED_CANDIDATES) break;
  }

  return candidates;
}

function scanCandidatePaths(repoPath: string): string[] {
  const found = new Set<string>();

  for (const target of SCAN_TARGETS) {
    const baseAbsolutePath = path.join(repoPath, target.basePath);
    if (!directoryExists(baseAbsolutePath)) continue;

    walkDirectory(baseAbsolutePath, target.basePath === '.' ? '' : target.basePath, 0, target.maxDepth, found, target);
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

function walkDirectory(
  absolutePath: string,
  relativePath: string,
  depth: number,
  maxDepth: number,
  found: Set<string>,
  target: ScanTarget,
): void {
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryRelativePath = normalizePath(relativePath ? path.posix.join(relativePath, entry.name) : entry.name);
    const entryAbsolutePath = path.join(absolutePath, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entryRelativePath, entry.name)) continue;
      if (depth >= maxDepth) continue;
      walkDirectory(entryAbsolutePath, entryRelativePath, depth + 1, maxDepth, found, target);
      continue;
    }

    if (!target.include(entryRelativePath, entry)) continue;
    if (isExcludedPath(entryRelativePath) || shouldIgnoreCandidatePath(entryRelativePath)) continue;
    found.add(entryRelativePath);
  }
}

function scoreCandidate(repoPath: string, filePath: string): ScoredCandidate | null {
  if (shouldIgnoreCandidatePath(filePath)) return null;

  const score = scorePath(filePath);
  if (score < 6) return null;

  const content = readCandidateContent(repoPath, filePath);
  if (content === null) return null;

  const contentScore = scoreContent(content);
  const totalScore = score + contentScore;
  const confidence = toConfidence(filePath, totalScore);

  if (!confidence) return null;

  return {
    filePath,
    confidence,
    reason: buildReason(filePath, content),
    score: totalScore,
  };
}

function scorePath(filePath: string): number {
  const normalizedPath = filePath.toLowerCase();
  const basename = path.posix.basename(normalizedPath);
  let score = 0;

  if (normalizedPath.startsWith('docs/')) score += 2;
  if (normalizedPath.startsWith('.github/')) score += 3;
  if (normalizedPath.startsWith('.cursor/rules/')) score += 4;
  if (normalizedPath.startsWith('.windsurf/')) score += 4;

  if (containsAny(normalizedPath, ['architecture'])) score += 5;
  if (containsAny(normalizedPath, ['security'])) score += 5;
  if (containsAny(normalizedPath, ['ai', 'agent', 'agents', 'claude', 'gemini', 'cursor', 'windsurf', 'copilot'])) score += 5;
  if (containsAny(normalizedPath, ['coding', 'contributing', 'development', 'guideline', 'guidelines', 'convention', 'conventions', 'policy', 'principle', 'principles', 'workflow'])) score += 4;

  if (basename === 'readme.md') score += 1;

  if (containsAny(normalizedPath, ['changelog'])) score -= 6;
  if (containsAny(normalizedPath, ['meeting-notes', 'notes', 'temporary', 'tmp', 'draft'])) score -= 5;
  if (containsAny(normalizedPath, ['generated'])) score -= 4;

  return score;
}

function scoreContent(content: string): number {
  const normalized = content.toLowerCase();
  let score = 0;

  if (containsAny(normalized, ['# architecture', '## architecture', '# security', '## security'])) score += 4;
  if (containsAny(normalized, ['architecture', 'security'])) score += 2;
  if (containsAny(normalized, ['# guidelines', '## guidelines', '# conventions', '## conventions'])) score += 3;
  if (containsAny(normalized, ['# ai instructions', '## ai instructions', '# workflow', '## workflow'])) score += 3;
  if (containsAny(normalized, ['development workflow', 'coding conventions', 'team conventions', 'guardrails'])) score += 3;
  if (containsAny(normalized, ['must', 'should', 'do not', 'convention', 'workflow', 'policy', 'principles'])) score += 2;

  return score;
}

function toConfidence(filePath: string, score: number): Confidence | null {
  const basename = path.posix.basename(filePath).toLowerCase();

  if (basename === 'readme.md') {
    return 'medium';
  }

  if (score >= 14) return 'high';
  if (score >= 7) return 'medium';
  return null;
}

function buildReason(filePath: string, content: string): string {
  const labels = new Set<string>();
  const normalizedPath = filePath.toLowerCase();
  const normalizedContent = content.toLowerCase();

  if (containsAny(normalizedPath, ['architecture']) || containsAny(normalizedContent, ['architecture'])) {
    labels.add('architecture overview candidate');
  }
  if (containsAny(normalizedPath, ['security']) || containsAny(normalizedContent, ['security', 'guardrails'])) {
    labels.add('security policy / guardrails candidate');
  }
  if (containsAny(normalizedPath, ['ai', 'agent', 'agents', 'claude', 'gemini', 'cursor', 'windsurf', 'copilot'])
    || containsAny(normalizedContent, ['ai instructions', 'copilot', 'claude', 'gemini', 'cursor', 'windsurf'])) {
    labels.add('AI coding instruction candidate');
  }
  if (containsAny(normalizedPath, ['guideline', 'guidelines', 'convention', 'conventions', 'policy', 'principle', 'principles', 'workflow', 'development'])
    || containsAny(normalizedContent, ['guidelines', 'conventions', 'policy', 'principles', 'workflow', 'development workflow'])) {
    labels.add('guideline-like documentation candidate');
  }

  if (labels.size === 0 && path.posix.basename(filePath).toLowerCase() === 'readme.md') {
    labels.add('project overview candidate');
  }

  const orderedLabels = [...labels].sort((a, b) => compareReasonLabels(a, b));
  return orderedLabels.slice(0, 2).join('; ');
}

function compareReasonLabels(left: string, right: string): number {
  return reasonPriority(left) - reasonPriority(right) || left.localeCompare(right);
}

function reasonPriority(label: string): number {
  const normalizedLabel = label.toLowerCase();
  const index = HIGH_PRIORITY_KEYWORDS.findIndex((keyword) => normalizedLabel.includes(keyword));
  return index === -1 ? HIGH_PRIORITY_KEYWORDS.length : index;
}

function readCandidateContent(repoPath: string, filePath: string): string | null {
  const absolutePath = path.join(repoPath, filePath);

  try {
    const buffer = fs.readFileSync(absolutePath);
    if (buffer.includes(0)) return null;
    return buffer.toString('utf8', 0, Math.min(buffer.length, MAX_CONTENT_BYTES))
      .split(/\r?\n/)
      .slice(0, MAX_CONTENT_LINES)
      .join('\n');
  } catch {
    return null;
  }
}

function fileExists(repoPath: string, relativePath: string): boolean {
  const absolutePath = path.join(repoPath, relativePath);
  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function directoryExists(directoryPath: string): boolean {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function findIgnoredPaths(repoPath: string): IgnoredPath[] {
  const ignored: IgnoredPath[] = [];

  for (const [excludedPath, reason] of Object.entries(EXCLUDED_DIRS)) {
    const absolutePath = path.join(repoPath, excludedPath);
    try {
      fs.statSync(absolutePath);
    } catch {
      continue;
    }

    ignored.push({
      filePath: excludedPath.endsWith('/') ? excludedPath : `${excludedPath}/`,
      reason,
    });
  }

  return ignored.sort((a, b) => a.filePath.localeCompare(b.filePath));
}

function shouldSkipDirectory(relativePath: string, directoryName: string): boolean {
  return SKIP_DIR_NAMES.has(directoryName) || isExcludedPath(relativePath);
}

function shouldIgnoreCandidatePath(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();

  if (isExcludedPath(normalizedPath)) return true;

  return containsAny(normalizedPath, [
    'changelog',
    'meeting-notes',
    '/notes',
    'temporary',
    'tmp',
    'draft',
    'generated',
  ]);
}

function isExcludedPath(filePath: string): boolean {
  return Object.keys(EXCLUDED_DIRS).some((excludedPath) => {
    const normalizedExcludedPath = excludedPath.toLowerCase();
    return filePath === normalizedExcludedPath || filePath.startsWith(`${normalizedExcludedPath}/`);
  });
}

function fixedRuleScore(confidence: Confidence): number {
  return confidence === 'high' ? 100 : 50;
}

function compareSuggestions(left: Suggestion, right: Suggestion): number {
  return confidenceRank(left.confidence) - confidenceRank(right.confidence)
    || right.score - left.score
    || left.filePath.localeCompare(right.filePath);
}

function confidenceRank(confidence: Confidence): number {
  return confidence === 'high' ? 0 : 1;
}

function printSuggestions(title: string, suggestions: Suggestion[]): void {
  console.log(`${title}:`);

  if (suggestions.length === 0) {
    console.log('  (none)');
    console.log('');
    return;
  }

  for (const suggestion of suggestions) {
    console.log(`  ${suggestion.filePath} — ${suggestion.reason}`);
  }
  console.log('');
}

function printIgnored(ignored: IgnoredPath[]): void {
  console.log('Ignored / excluded:');

  if (ignored.length === 0) {
    console.log('  (none)');
    return;
  }

  for (const item of ignored) {
    console.log(`  ${item.filePath} — ${item.reason}`);
  }
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep).replace(/^\.\//, '');
}

function isMarkdownFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.md');
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}
