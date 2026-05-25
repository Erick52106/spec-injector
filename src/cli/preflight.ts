import path from 'path';
import fs from 'fs';
import { ensureRepoPath } from '../utils/fs.js';
import {
  getCurrentBranch,
  getGitTopLevel,
  getMainWorktreePath,
  getUpstreamState,
  getWorktreeState,
} from '../utils/git.js';
import { isSpecArtifactPath, normalizeArtifactPath } from '../utils/artifacts.js';
import { run } from '../utils/shell.js';

type PreflightSeverity = 'pass' | 'warning' | 'fail' | 'needs-human-review';

type PreflightCheck = {
  severity: PreflightSeverity;
  summary: string;
  detail: string;
};

type PreflightFormat = 'text' | 'json';

type PreflightOptions = {
  repo?: string;
  expectedBranch?: string;
  expectedWorktreeRoot?: string;
  targetRepo?: string;
  format?: string;
};

type GitPathListResult =
  | { kind: 'ok'; label: string; paths: string[] }
  | { kind: 'error'; label: string; message: string };

export async function preflight(opts: PreflightOptions): Promise<void> {
  const format = parseFormat(opts.format);
  const repoPath = canonicalizePath(path.resolve(opts.repo ?? process.cwd()));

  try {
    ensureRepoPath(repoPath);
    const report = buildPreflightReport(repoPath, opts);
    printReport(report, format);

    if (report.overall === 'fail' || report.overall === 'needs-human-review') {
      process.exit(1);
    }
  } catch (err) {
    console.error(`✗ Preflight failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

function parseFormat(formatOption: string | undefined): PreflightFormat {
  if (!formatOption || formatOption === 'text') return 'text';
  if (formatOption === 'json') return 'json';
  throw new Error(`Invalid preflight format "${formatOption}". Expected one of: text, json.`);
}

function buildPreflightReport(repoPath: string, opts: PreflightOptions): {
  overall: PreflightSeverity;
  checks: PreflightCheck[];
} {
  const checks: PreflightCheck[] = [];
  const currentTopLevel = canonicalizePath(
    requireGitString(getGitTopLevel(repoPath), 'Could not determine current git worktree path.')
  );
  const currentBranch = requireGitString(getCurrentBranch(repoPath), 'Could not determine current branch.');
  const mainRepoPath = canonicalizePath(
    requireGitString(getMainWorktreePath(repoPath), 'Could not determine main repo worktree path.')
  );
  const mainBranch = requireGitString(getCurrentBranch(mainRepoPath), 'Could not determine main repo branch.');

  const mainState = getWorktreeState(mainRepoPath);
  if (mainState.kind === 'clean') {
    checks.push(pass('main repo worktree is clean', mainRepoPath));
  } else if (mainState.kind === 'dirty') {
    checks.push(fail('main repo worktree is dirty', 'Stop and report; do not auto-stash, clean, or reset.'));
  } else if (mainState.kind === 'not-git') {
    checks.push(needsHumanReview('main repo worktree is not a git repo', mainRepoPath));
  } else {
    checks.push(needsHumanReview('unable to determine main repo worktree state', mainState.message));
  }

  if (mainBranch === 'main') {
    checks.push(pass('main repo worktree is on main', mainBranch));
  } else {
    checks.push(fail(
      'main repo worktree is not on main',
      `Expected main but found ${mainBranch}. Stop and report; do not auto-checkout.`
    ));
  }

  const upstreamState = getUpstreamState(mainRepoPath);
  if (upstreamState.kind === 'up-to-date') {
    checks.push(pass(`main repo is up to date with ${upstreamState.upstream}`, upstreamState.upstream));
  } else if (upstreamState.kind === 'diverged') {
    checks.push(fail(
      `main repo is not up to date with ${upstreamState.upstream}`,
      `${upstreamState.upstream} ahead=${upstreamState.ahead}, behind=${upstreamState.behind}.`
    ));
  } else if (upstreamState.kind === 'no-upstream') {
    checks.push(warning(
      'main repo has no upstream configured',
      'Needs human review before assuming main is synced.'
    ));
  } else if (upstreamState.kind === 'not-git') {
    checks.push(needsHumanReview('main repo is not a git repo', mainRepoPath));
  } else {
    checks.push(needsHumanReview('unable to determine main repo upstream state', upstreamState.message));
  }

  if (currentTopLevel === mainRepoPath) {
    checks.push(fail(
      'current checkout is the main repo worktree',
      'Implementation must run from a dedicated worktree.'
    ));
  } else {
    checks.push(pass('current worktree is dedicated', currentTopLevel));
  }

  if (opts.expectedBranch) {
    if (currentBranch === opts.expectedBranch) {
      checks.push(pass('current branch matches expected branch', currentBranch));
    } else {
      checks.push(fail(
        'current branch does not match expected branch',
        `Expected ${opts.expectedBranch} but found ${currentBranch}.`
      ));
    }
  } else {
    checks.push(pass('current branch detected', currentBranch));
  }

  const currentState = getWorktreeState(currentTopLevel);
  if (currentState.kind === 'clean') {
    checks.push(pass('current worktree is clean', currentTopLevel));
  } else if (currentState.kind === 'dirty') {
    checks.push(fail(
      'current worktree is dirty',
      'Stop and report; do not auto-stash, clean, or reset.'
    ));
  } else if (currentState.kind === 'not-git') {
    checks.push(needsHumanReview('current worktree is not a git repo', currentTopLevel));
  } else {
    checks.push(needsHumanReview('unable to determine current worktree state', currentState.message));
  }

  if (opts.expectedWorktreeRoot) {
    const expectedRoot = canonicalizePath(path.resolve(opts.expectedWorktreeRoot));
    const expectedPath = opts.expectedBranch
      ? path.join(expectedRoot, toWorktreeSlug(opts.expectedBranch))
      : null;

    if (expectedPath && currentTopLevel === expectedPath) {
      checks.push(pass('current worktree path matches expected location/naming', currentTopLevel));
    } else if (isWithinRoot(currentTopLevel, expectedRoot)) {
      const detail = expectedPath
        ? `Current path ${currentTopLevel} stays under ${expectedRoot}, but expected ${expectedPath}.`
        : `Current path ${currentTopLevel} stays under ${expectedRoot}.`;
      checks.push(warning('current worktree path needs naming review', detail));
    } else {
      checks.push(warning(
        'current worktree path is outside the expected worktree root',
        `Expected root ${expectedRoot}, found ${currentTopLevel}.`
      ));
    }
  } else {
    checks.push(pass('current worktree path detected', currentTopLevel));
  }

  if (opts.targetRepo) {
    const targetRepoPath = canonicalizePath(path.resolve(opts.targetRepo));
    ensureRepoPath(targetRepoPath);
    const targetState = getWorktreeState(targetRepoPath);
    if (targetState.kind === 'clean') {
      checks.push(pass(
        'target repo is clean',
        'Read-only only unless explicitly authorized; do not create or modify target repo .spec-injector/.'
      ));
    } else if (targetState.kind === 'dirty') {
      checks.push(warning(
        'target repo is dirty',
        'Read-only only unless explicitly authorized; do not create or modify target repo .spec-injector/.'
      ));
    } else if (targetState.kind === 'not-git') {
      checks.push(warning(
        'target repo is not a git repo',
        'Read-only only unless explicitly authorized; do not create or modify target repo .spec-injector/.'
      ));
    } else {
      checks.push(needsHumanReview('unable to determine target repo worktree state', targetState.message));
    }
    checks.push(...buildTargetArtifactChecks(targetRepoPath));
  }

  return {
    overall: summarizeOverall(checks),
    checks,
  };
}

function buildTargetArtifactChecks(targetRepoPath: string): PreflightCheck[] {
  const checks: PreflightCheck[] = [];
  const staged = readGitPathList(
    targetRepoPath,
    ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    'staged target repo paths'
  );
  const unstaged = readGitPathList(
    targetRepoPath,
    ['git', 'diff', '--name-only', '--diff-filter=ACMR', '-z'],
    'unstaged target repo paths'
  );
  const untracked = readGitPathList(
    targetRepoPath,
    ['git', 'ls-files', '--others', '--exclude-standard', '-z'],
    'untracked target repo paths'
  );

  const inspectionFailures = [staged, unstaged, untracked].filter((result) => result.kind === 'error');
  for (const failure of inspectionFailures) {
    checks.push(needsHumanReview(`unable to inspect ${failure.label}`, failure.message));
  }
  if (inspectionFailures.length > 0) return checks;

  const stagedOk = requireGitPathList(staged);
  const unstagedOk = requireGitPathList(unstaged);
  const untrackedOk = requireGitPathList(untracked);

  const stagedArtifacts = unique(stagedOk.paths.filter((entry) => isSpecArtifactPath(entry)));
  if (stagedArtifacts.length > 0) {
    checks.push(fail(
      'target repo has staged spec artifacts',
      `Forbidden staged artifacts: ${stagedArtifacts.join(', ')}. Stop and unstage/remove from target PR; preflight did not modify the target repo.`
    ));
  } else {
    checks.push(pass('target repo has no staged spec artifacts', targetRepoPath));
  }

  const dirtyArtifacts = unique([
    ...unstagedOk.paths.filter((entry) => isSpecArtifactPath(entry)),
    ...untrackedOk.paths.filter((entry) => isSpecArtifactPath(entry)),
    ...existingGeneratedArtifactPaths(targetRepoPath),
  ]);
  if (dirtyArtifacts.length > 0) {
    checks.push(warning(
      'target repo has local spec artifact risk',
      `Local-only artifacts detected: ${dirtyArtifacts.join(', ')}. Keep these out of commits and do not copy private context or generated output into the target repo.`
    ));
  } else {
    checks.push(pass('target repo has no local spec artifact risk', targetRepoPath));
  }

  return checks;
}

function readGitPathList(
  repoPath: string,
  argv: string[],
  label: string
): GitPathListResult {
  const result = run(argv, { cwd: repoPath });
  if (result.exitCode !== 0) {
    return { kind: 'error', label, message: formatShellError(result) };
  }

  return {
    kind: 'ok',
    label,
    paths: result.stdout.split('\0').filter(Boolean).map(normalizeArtifactPath),
  };
}

function requireGitPathList(result: GitPathListResult): Extract<GitPathListResult, { kind: 'ok' }> {
  if (result.kind === 'ok') return result;
  throw new Error(`Internal preflight path inspection error: ${result.label}`);
}

function existingGeneratedArtifactPaths(targetRepoPath: string): string[] {
  const candidates = [
    '.spec-injector/out',
    '.spec-injector/routing',
    '.spec-injector/readback',
  ];

  return candidates.filter((candidate) => fs.existsSync(path.join(targetRepoPath, candidate)));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function requireGitString(
  result:
    | { kind: 'ok'; value: string }
    | { kind: 'not-git' }
    | { kind: 'unknown'; message: string },
  errorMessage: string
): string {
  if (result.kind === 'ok' && result.value) {
    return result.value;
  }

  if (result.kind === 'not-git') {
    throw new Error(`${errorMessage} Repo is not a git worktree.`);
  }

  if (result.kind === 'unknown') {
    throw new Error(`${errorMessage} ${result.message}`);
  }

  throw new Error(errorMessage);
}

function summarizeOverall(checks: PreflightCheck[]): PreflightSeverity {
  if (checks.some((check) => check.severity === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.severity === 'needs-human-review')) {
    return 'needs-human-review';
  }
  if (checks.some((check) => check.severity === 'warning')) {
    return 'warning';
  }
  return 'pass';
}

function printReport(report: { overall: PreflightSeverity; checks: PreflightCheck[] }, format: PreflightFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const counts = {
    pass: report.checks.filter((check) => check.severity === 'pass').length,
    warning: report.checks.filter((check) => check.severity === 'warning').length,
    fail: report.checks.filter((check) => check.severity === 'fail').length,
    needsHumanReview: report.checks.filter((check) => check.severity === 'needs-human-review').length,
  };

  console.log(
    `Preflight summary: ${report.overall.toUpperCase()} ` +
    `(${counts.pass} pass, ${counts.warning} warning, ${counts.fail} fail, ${counts.needsHumanReview} needs-human-review)`
  );

  for (const check of report.checks) {
    console.log(`[${check.severity.toUpperCase()}] ${check.summary} — ${check.detail}`);
  }
}

function pass(summary: string, detail: string): PreflightCheck {
  return { severity: 'pass', summary, detail };
}

function warning(summary: string, detail: string): PreflightCheck {
  return { severity: 'warning', summary, detail };
}

function fail(summary: string, detail: string): PreflightCheck {
  return { severity: 'fail', summary, detail };
}

function needsHumanReview(summary: string, detail: string): PreflightCheck {
  return { severity: 'needs-human-review', summary, detail };
}

function toWorktreeSlug(branchName: string): string {
  return branchName.replace(/[\\/]+/g, '-');
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function canonicalizePath(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

function formatShellError(result: { stdout: string; stderr: string; exitCode: number }): string {
  const message = `${result.stderr}\n${result.stdout}`.trim();
  return message || `exit ${result.exitCode}`;
}
