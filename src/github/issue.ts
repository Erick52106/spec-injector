import { run } from '../utils/shell.js';
import type { Issue } from './types.js';

export async function fetchIssue(urlOrNumber: string, repoPath?: string): Promise<Issue> {
  // Reject PR URLs early
  if (urlOrNumber.includes('/pull/')) {
    throw new Error('This looks like a PR URL. Use a GitHub issue URL instead.');
  }

  // Derive --repo flag from URL or skip (gh uses git remote)
  const repoFlag = deriveRepoFlag(urlOrNumber, repoPath);

  // Extract just the issue number from a URL if needed
  const issueRef = extractIssueRef(urlOrNumber);

  const fields = 'number,title,body,labels,url,state';
  const cmd = `gh issue view ${issueRef} ${repoFlag} --json ${fields}`;

  const result = run(cmd, { cwd: repoPath });

  if (result.exitCode !== 0) {
    const hint = result.stderr.includes('authentication')
      ? ' Run `gh auth status` to check authentication.'
      : '';
    throw new Error(`Could not fetch issue "${issueRef}".${hint}\n${result.stderr.trim()}`);
  }

  const raw = JSON.parse(result.stdout) as {
    number: number;
    title: string;
    body: string | null;
    labels: Array<{ name: string }>;
    url: string;
    state: string;
  };

  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    labels: raw.labels.map((l) => l.name),
    url: raw.url,
    state: raw.state === 'CLOSED' ? 'closed' : 'open',
  };
}

function extractIssueRef(urlOrNumber: string): string {
  // Full URL: https://github.com/owner/repo/issues/42
  const urlMatch = urlOrNumber.match(/\/issues\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  // Plain number
  if (/^\d+$/.test(urlOrNumber)) return urlOrNumber;
  throw new Error(`Cannot parse issue reference: "${urlOrNumber}". Use a number or full GitHub URL.`);
}

function deriveRepoFlag(urlOrNumber: string, _repoPath?: string): string {
  // If a full URL is given, extract owner/repo from it
  const urlMatch = urlOrNumber.match(/github\.com\/([^/]+\/[^/]+)\/issues/);
  if (urlMatch) return `--repo ${urlMatch[1]}`;
  // If only a number, let gh use the git remote from repoPath
  return '';
}
