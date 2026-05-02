import fs from 'fs';
import path from 'path';

type Confidence = 'high' | 'medium';

interface CandidateRule {
  confidence: Confidence;
  reason: string;
}

interface Suggestion {
  filePath: string;
  reason: string;
}

interface IgnoredPath {
  filePath: string;
  reason: string;
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
  'docs/superpowers': 'superpowers planning docs are not always_read candidates',
  'docs/archive': 'archived docs are not current always_read candidates',
  '.spec-injector/out': 'generated task package output',
  node_modules: 'dependency directory',
  dist: 'build output directory',
  build: 'build output directory',
};

export function suggestAlwaysRead(repoPath: string): void {
  const high: Suggestion[] = [];
  const medium: Suggestion[] = [];
  const ignored = findIgnoredPaths(repoPath);

  for (const [candidatePath, rule] of Object.entries(CANDIDATE_RULES)) {
    if (!fileExists(repoPath, candidatePath)) continue;

    const suggestion: Suggestion = {
      filePath: candidatePath,
      reason: rule.reason,
    };

    if (rule.confidence === 'high') {
      high.push(suggestion);
    } else {
      medium.push(suggestion);
    }
  }

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

function fileExists(repoPath: string, relativePath: string): boolean {
  const absolutePath = path.join(repoPath, relativePath);
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
}

function findIgnoredPaths(repoPath: string): IgnoredPath[] {
  const ignored: IgnoredPath[] = [];

  for (const [excludedPath, reason] of Object.entries(EXCLUDED_DIRS)) {
    const absolutePath = path.join(repoPath, excludedPath);
    if (!fs.existsSync(absolutePath)) continue;

    ignored.push({
      filePath: excludedPath.endsWith('/') ? excludedPath : `${excludedPath}/`,
      reason,
    });
  }

  return ignored.sort((a, b) => a.filePath.localeCompare(b.filePath));
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
