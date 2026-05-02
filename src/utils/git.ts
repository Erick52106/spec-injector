import { run } from './shell.js';

export type WorktreeState =
  | { kind: 'clean' }
  | { kind: 'dirty' }
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

function isNotGitRepository(message: string): boolean {
  return /not a git repository/i.test(message);
}
