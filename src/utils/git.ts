import path from 'path';
import { run } from './shell.js';

export type WorktreeState =
  | { kind: 'clean' }
  | { kind: 'dirty' }
  | { kind: 'not-git' }
  | { kind: 'unknown'; message: string };

export type GitStringResult =
  | { kind: 'ok'; value: string }
  | { kind: 'not-git' }
  | { kind: 'unknown'; message: string };

export type UpstreamState =
  | { kind: 'up-to-date'; upstream: string; ahead: 0; behind: 0 }
  | { kind: 'diverged'; upstream: string; ahead: number; behind: number }
  | { kind: 'no-upstream' }
  | { kind: 'not-git' }
  | { kind: 'unknown'; message: string };

export function getWorktreeState(repoPath: string): WorktreeState {
  const result = run(
    ['git', 'status', '--porcelain=v1', '--untracked-files=normal'],
    { cwd: repoPath }
  );

  if (result.exitCode === 0) {
    return result.stdout.trim() === '' ? { kind: 'clean' } : { kind: 'dirty' };
  }

  const message = `${result.stderr}\n${result.stdout}`.trim();
  if (isNotGitRepository(message)) {
    return { kind: 'not-git' };
  }

  return { kind: 'unknown', message };
}

export function getCurrentBranch(repoPath: string): GitStringResult {
  return readGitString(repoPath, ['git', 'branch', '--show-current']);
}

export function getGitTopLevel(repoPath: string): GitStringResult {
  return readGitString(repoPath, ['git', 'rev-parse', '--show-toplevel']);
}

export function getMainWorktreePath(repoPath: string): GitStringResult {
  const commonDir = readGitString(repoPath, ['git', 'rev-parse', '--git-common-dir']);
  if (commonDir.kind !== 'ok') {
    return commonDir;
  }

  const resolvedCommonDir = path.resolve(repoPath, commonDir.value);
  return { kind: 'ok', value: path.dirname(resolvedCommonDir) };
}

export function getUpstreamState(repoPath: string): UpstreamState {
  const upstream = run(
    ['git', 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    { cwd: repoPath }
  );

  if (upstream.exitCode !== 0) {
    const message = `${upstream.stderr}\n${upstream.stdout}`.trim();
    if (isNotGitRepository(message)) {
      return { kind: 'not-git' };
    }
    if (hasNoUpstream(message)) {
      return { kind: 'no-upstream' };
    }
    return { kind: 'unknown', message };
  }

  const upstreamRef = upstream.stdout.trim();
  const counts = run(
    ['git', 'rev-list', '--left-right', '--count', `${upstreamRef}...HEAD`],
    { cwd: repoPath }
  );

  if (counts.exitCode !== 0) {
    const message = `${counts.stderr}\n${counts.stdout}`.trim();
    if (isNotGitRepository(message)) {
      return { kind: 'not-git' };
    }
    return { kind: 'unknown', message };
  }

  const [behindRaw, aheadRaw] = counts.stdout.trim().split(/\s+/);
  const behind = Number.parseInt(behindRaw ?? '', 10);
  const ahead = Number.parseInt(aheadRaw ?? '', 10);

  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) {
    return { kind: 'unknown', message: `Unexpected upstream divergence output: ${counts.stdout.trim()}` };
  }

  if (ahead === 0 && behind === 0) {
    return { kind: 'up-to-date', upstream: upstreamRef, ahead: 0, behind: 0 };
  }

  return { kind: 'diverged', upstream: upstreamRef, ahead, behind };
}

function readGitString(repoPath: string, argv: string[]): GitStringResult {
  const result = run(argv, { cwd: repoPath });

  if (result.exitCode === 0) {
    return { kind: 'ok', value: result.stdout.trim() };
  }

  const message = `${result.stderr}\n${result.stdout}`.trim();
  if (isNotGitRepository(message)) {
    return { kind: 'not-git' };
  }

  return { kind: 'unknown', message };
}

function isNotGitRepository(message: string): boolean {
  return /not a git repository/i.test(message);
}

function hasNoUpstream(message: string): boolean {
  return /no upstream configured|no upstream branch|has no upstream branch/i.test(message);
}
