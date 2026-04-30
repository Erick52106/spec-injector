import type { Issue } from './types.js';

export async function fetchIssue(_urlOrNumber: string, _repoPath?: string): Promise<Issue> {
  throw new Error('not implemented');
}
