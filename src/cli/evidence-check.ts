import { run } from '../utils/shell.js';

type Severity = 'pass' | 'warning' | 'fail' | 'needs-human-review';

type EvidenceCheck = {
  severity: Severity;
  item: string;
  evidence: string;
  reason: string;
  action: string;
};

type EvidenceCheckOptions = {
  pr: string;
  repo?: string;
  issue?: string;
  expectedHead?: string;
  evidenceUrl?: string;
  format?: string;
};

type PullRequestPayload = {
  number?: number;
  url?: string;
  body?: string;
  headRefName?: string;
  headRefOid?: string;
  isDraft?: boolean;
  reviews?: Array<{ body?: string; state?: string; author?: { login?: string } }>;
};

type IssuePayload = {
  number?: number;
  url?: string;
  comments?: Array<{ url?: string; body?: string }>;
};

type CheckPayload = {
  name?: string;
  state?: string;
  conclusion?: string;
  bucket?: string;
};

type EvidenceCheckFormat = 'text' | 'json';
type EvidenceCheckReport = {
  overall: Severity;
  checks: EvidenceCheck[];
};

const HASH_PATTERN = /\b[0-9a-f]{7,40}\b/gi;
const LINKED_ISSUE_PATTERN = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
const EVIDENCE_URL_PATTERN = /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)#issuecomment-\d+/gi;
const SINGLE_EVIDENCE_URL_PATTERN = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)#issuecomment-\d+$/i;
const REVIEW_ASSESSMENT_PATTERN = /\b(?:adopted|not adopted|optional polish|noise \/ not applicable|needs human review)\b/i;
const EXACT_VALIDATION_COMMAND_PATTERN = /`?(?:git diff --check|pnpm build|pnpm test|pnpm lint|pnpm typecheck|node --test(?:\s+[^`\n]+)?|tsc(?:\s+[^`\n]+)?|npm test)`?/i;
const ACTIONABLE_REVIEW_PATTERN = /\b(?:actionable comments|inline comments|potential issue|bug|fail(?:s|ure)?|stale|missing|incorrect|wrong|fix|change|update|replace|avoid|require|should|must|nit)\b/i;
const PURE_NON_ACTIONABLE_REVIEW_PATTERN = /^(?:lgtm|looks good(?: to me)?|approved)$/i;
const EXPLICIT_NO_ACTIONABLE_REVIEW_PATTERN = /\bno actionable(?: comments?| findings?)\b/i;

export async function evidenceCheck(opts: EvidenceCheckOptions): Promise<void> {
  try {
    const format = parseFormat(opts.format);
    const context = resolveContext(opts);
    const pr = readJson<PullRequestPayload>([
      'gh',
      'pr',
      'view',
      context.prRef,
      '--repo',
      context.repo,
      '--json',
      'number,url,body,headRefName,headRefOid,isDraft,reviews',
    ], 'Could not read PR metadata.');
    const body = pr.body ?? '';
    const linkedIssues = parseLinkedIssues(body);
    const evidenceUrl = findEvidenceUrl(body);
    const issue = linkedIssues.length === 1
      ? readJson<IssuePayload>([
        'gh',
        'issue',
        'view',
        String(linkedIssues[0]),
        '--repo',
        context.repo,
        '--json',
        'number,url,comments',
      ], 'Could not read linked issue comments.')
      : null;
    const checksRead = readJsonResult<CheckPayload[]>([
      'gh',
      'pr',
      'checks',
      context.prRef,
      '--repo',
      context.repo,
      '--json',
      'name,state,bucket,link',
    ], 'Could not read PR checks.');

    const report = buildReport({
      pr,
      issue,
      body,
      linkedIssues,
      expectedIssue: parseIssueOption(opts.issue),
      evidenceUrl,
      expectedEvidenceUrl: opts.evidenceUrl,
      expectedHead: opts.expectedHead,
      checks: checksRead.value ?? [],
      checksReadError: checksRead.error,
    });

    printReport(report, format);

    if (report.overall === 'fail' || report.overall === 'needs-human-review') {
      process.exit(1);
    }
  } catch (err) {
    const message = (err as Error).message;
    if (opts.format === 'json') {
      printReport(buildFatalReport(message), 'json');
    } else {
      console.error(`✗ Evidence check failed: ${message}`);
    }
    process.exit(1);
  }
}

function parseFormat(format: string | undefined): EvidenceCheckFormat {
  const normalized = format ?? 'text';
  if (normalized === 'text' || normalized === 'json') {
    return normalized;
  }
  throw new Error(`Invalid evidence-check format "${format}". Expected one of: text, json.`);
}

function resolveContext(opts: EvidenceCheckOptions): { prRef: string; repo: string } {
  const prUrlMatch = opts.pr.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const urlRepo = prUrlMatch?.[1];
  if (opts.repo && urlRepo && opts.repo !== urlRepo) {
    throw new Error('--repo must match the repository encoded in --pr.');
  }
  const repo = urlRepo ?? opts.repo;
  const prRef = prUrlMatch?.[2] ?? opts.pr;

  if (!repo) {
    throw new Error('--repo is required when --pr is not a GitHub PR URL.');
  }

  return { prRef, repo };
}

function buildReport(input: {
  pr: PullRequestPayload;
  issue: IssuePayload | null;
  body: string;
  linkedIssues: number[];
  expectedIssue: number | null;
  evidenceUrl: string | null;
  expectedEvidenceUrl?: string;
  expectedHead?: string;
  checks: CheckPayload[];
  checksReadError?: string;
}): EvidenceCheckReport {
  const checks: EvidenceCheck[] = [];
  const latestHead = input.pr.headRefOid ?? '';
  const evidenceComment = input.evidenceUrl && input.issue
    ? input.issue.comments?.find((comment) => comment.url === input.evidenceUrl)
    : undefined;
  const combinedEvidence = [input.body, evidenceComment?.body ?? ''].join('\n');

  if (input.linkedIssues.length === 0) {
    checks.push(fail(
      'PR body linked issue',
      'none',
      'source issue reference is missing',
      'Stop and add a human-reviewed linked issue reference such as Closes #<issue>.'
    ));
  } else if (input.linkedIssues.length > 1) {
    checks.push(needsHumanReview(
      'PR body linked issues',
      `#${input.linkedIssues.join(', #')}`,
      `detected ${input.linkedIssues.length} distinct closing issues`,
      'Do not auto-select a source issue; choose exactly one source issue with human review before proceeding.'
    ));
  } else {
    const [linkedIssue] = input.linkedIssues;
    checks.push(pass(
      'PR body linked issue',
      `#${linkedIssue}`,
      'linked issue reference found',
      'Continue using this source issue as the evidence anchor.'
    ));
  }

  if (input.expectedIssue && input.linkedIssues.length > 0 && input.expectedIssue !== input.linkedIssues[0]) {
    const expectedIssueEvidence = `expected #${input.expectedIssue}, found ${input.linkedIssues.length === 1 ? `#${input.linkedIssues[0]}` : `${input.linkedIssues.length} candidates`}`;
    checks.push(needsHumanReview(
      'Expected issue',
      expectedIssueEvidence,
      `expected issue does not uniquely match PR linked issue(s)`,
      'Stop and confirm the correct source issue with human review.'
    ));
  }

  checkRequiredSections(input.body).forEach((check) => checks.push(check));

  if (!input.evidenceUrl) {
    checks.push(fail(
      'Issue evidence URL',
      'none',
      'issue evidence URL is missing',
      'Post source issue implementation evidence, then backfill the permanent comment URL into the PR body.'
    ));
  } else {
    const urlIssue = parseIssueNumberFromEvidenceUrl(input.evidenceUrl);
    if (input.expectedEvidenceUrl && input.evidenceUrl !== input.expectedEvidenceUrl) {
      checks.push(fail(
        'Issue evidence URL',
        input.evidenceUrl,
        'evidence URL does not match --evidence-url',
        'Stop and confirm which implementation evidence comment is authoritative.'
      ));
    } else if (input.linkedIssues.length === 1) {
      const linkedIssue = input.linkedIssues[0];
      if (urlIssue !== linkedIssue) {
        checks.push(fail(
          'Issue evidence URL',
          input.evidenceUrl,
          'evidence URL points to a different issue',
          'Stop and backfill the source issue evidence comment URL; do not auto-edit the PR body.'
        ));
      } else {
        checks.push(pass(
          'Issue evidence URL',
          input.evidenceUrl,
          'evidence URL points to linked issue',
          'Use this URL for PR body evidence readback.'
        ));
      }
    } else if (input.linkedIssues.length > 1) {
      const urlIssue = parseIssueNumberFromEvidenceUrl(input.evidenceUrl);
      if (urlIssue === null) {
        checks.push(needsHumanReview(
          'Issue evidence URL',
          input.evidenceUrl,
          'could not parse linked issue from evidence URL under ambiguity',
          'Keep source issue selection to a human before using this evidence URL as authoritative.'
        ));
      } else if (input.linkedIssues.includes(urlIssue)) {
        checks.push(needsHumanReview(
          'Issue evidence URL',
          input.evidenceUrl,
          'evidence URL matches one candidate, but source issue remains ambiguous',
          'Do not reuse this evidence URL as authoritative until a human selects exactly one source issue.'
        ));
      } else {
        checks.push(fail(
          'Issue evidence URL',
          input.evidenceUrl,
          'evidence URL does not match any linked issue',
          'Stop and backfill an evidence URL that points to one of the linked issues.'
        ));
      }
    }
  }

  if (input.linkedIssues.length === 1 && input.evidenceUrl && evidenceComment) {
    checks.push(pass(
      'Issue evidence comment',
      input.evidenceUrl,
      'issue evidence comment exists',
      'Keep this comment aligned with latest HEAD before merge readiness.'
    ));
  } else if (input.linkedIssues.length === 1 && input.evidenceUrl) {
    checks.push(fail(
      'Issue evidence comment',
      input.evidenceUrl,
      'issue evidence comment was not found on the linked issue',
      'Stop and verify the source issue comment URL before merge readiness.'
    ));
  } else if (input.linkedIssues.length > 1) {
    checks.push(needsHumanReview(
      'Issue evidence comment',
      input.evidenceUrl ?? 'provided',
      'source issue ambiguity prevents authoritative comment verification',
      'Resolve source issue first, then verify issue evidence comment against that issue.'
    ));
  }

  const prUrl = input.pr.url ?? '';
  if (evidenceComment) {
    const evidenceBody = evidenceComment.body ?? '';
    const missing = [
      [prUrl, 'PR URL'],
      [input.pr.headRefName ?? '', 'branch'],
      [latestHead, 'commit hash / HEAD'],
    ].filter(([needle]) => needle && !evidenceBody.includes(needle));
    if (missing.length === 0 && hasValidationSummary(evidenceBody)) {
      checks.push(pass(
        'Issue evidence content',
        'PR URL, branch, HEAD, validation',
        'issue evidence contains required implementation fields',
        'No issue mutation is needed.'
      ));
    } else {
      checks.push(fail(
        'Issue evidence content',
        missing.map(([, label]) => label).concat(hasValidationSummary(evidenceBody) ? [] : ['validation summary']).join(', ') || 'incomplete',
        'issue evidence comment is incomplete or stale',
        'Stop and ask a human to refresh implementation evidence; checker will not edit comments.'
      ));
    }
  }

  if (input.expectedHead && input.expectedHead !== latestHead) {
    checks.push(fail(
      'Expected HEAD',
      `expected ${input.expectedHead}, latest ${latestHead}`,
      'expected HEAD does not match latest PR head',
      'Stop and re-read PR state before continuing.'
    ));
  }

  if (latestHead && input.body.includes(latestHead)) {
    checks.push(pass(
      'PR body HEAD freshness',
      latestHead,
      'PR body HEAD matches latest PR head',
      'Evidence is aligned with the current PR head.'
    ));
  } else if (latestHead) {
    checks.push(fail(
      'PR body HEAD freshness',
      findHashes(input.body).join(', ') || 'no hash',
      'PR body HEAD is stale',
      'Stop and refresh evidence after validating the latest HEAD; do not auto-update the PR body.'
    ));
  }

  if (hasExactValidationCommand(combinedEvidence)) {
    checks.push(pass(
      'Validation evidence',
      validationMatches(combinedEvidence).join(', '),
      'validation evidence lists exact commands',
      'Keep command/result evidence in PR body or issue evidence.'
    ));
  } else {
    checks.push(warning(
      'Validation evidence',
      'no exact command found',
      'validation evidence needs exact commands',
      'Replace vague wording such as tests pass with concrete commands and results.'
    ));
  }

  if (input.pr.isDraft) {
    checks.push(warning(
      'Draft state',
      'draft',
      'PR is draft',
      'Ready-for-review / merge-readiness flow should wait until PR is not draft.'
    ));
  } else {
    checks.push(pass('Draft state', 'ready for review', 'PR is not draft', 'Continue normal review workflow.'));
  }

  const reviewFindings = input.pr.reviews?.filter(isActionableReview) ?? [];
  if (reviewFindings.length > 0 && !REVIEW_ASSESSMENT_PATTERN.test(input.body)) {
    checks.push(needsHumanReview(
      'Review finding assessment',
      `${reviewFindings.length} review finding(s)`,
      'review findings need assessment',
      'Classify findings as adopted / not adopted / optional polish / noise / needs human review before merge.'
    ));
  } else if (reviewFindings.length > 0) {
    checks.push(pass(
      'Review finding assessment',
      `${reviewFindings.length} review finding(s)`,
      'review finding assessment vocabulary found',
      'Confirm written rationale exists before resolving any thread.'
    ));
  }

  checkCi(input.checks, input.checksReadError).forEach((check) => checks.push(check));

  return {
    overall: summarizeOverall(checks),
    checks,
  };
}

function buildFatalReport(message: string): EvidenceCheckReport {
  return {
    overall: 'fail',
    checks: [
      fail(
        'Evidence check execution',
        'pre-report fatal error',
        message,
        'Fix the evidence-check invocation, then rerun the read-only checker.'
      ),
    ],
  };
}

function checkRequiredSections(body: string): EvidenceCheck[] {
  const groups: Array<[string, RegExp, string]> = [
    ['Summary section', /^##+\s*(Summary|摘要)/im, 'Summary'],
    ['Scope section', /^##+\s*(Scope|範圍|實作範圍)/im, 'Scope'],
    ['Non-goals section', /^##+\s*(Non-goals|Non goals|非目標|不處理)/im, 'Non-goals'],
    ['Validation section', /^##+\s*(Validation|Tests \/ validation|Tests|驗證|測試)/im, 'Validation'],
    ['Implementation Evidence section', /^##+\s*(Implementation Evidence|Issue evidence|Evidence|實作證據|Issue evidence)/im, 'Implementation Evidence'],
  ];

  return groups.map(([item, pattern, expected]) => {
    if (pattern.test(body)) {
      return pass(item, expected, 'required PR body section found', 'Keep the section content fresh.');
    }
    return fail(item, expected, 'required PR body section is missing', 'Stop and add the missing section manually.');
  });
}

function checkCi(checks: CheckPayload[], checksReadError?: string): EvidenceCheck[] {
  if (checksReadError) {
    return [fail(
      'CI / checks',
      checksReadError,
      'could not read CI checks summary',
      'Stop and re-read PR checks manually; do not treat missing check data as merge-ready evidence.'
    )];
  }

  if (checks.length === 0) {
    return [warning(
      'CI / checks',
      'no checks returned',
      'CI checks summary is unavailable',
      'Confirm whether CI is unavailable, pending, or not applicable before merge readiness.'
    )];
  }

  const failed = checks.filter((check) =>
    /fail|failure|cancel|timed_out|action_required/i.test(`${check.bucket ?? ''} ${check.conclusion ?? ''} ${check.state ?? ''}`)
  );
  const pending = checks.filter((check) =>
    /pending|queued|in_progress|waiting|requested/i.test(`${check.bucket ?? ''} ${check.conclusion ?? ''} ${check.state ?? ''}`)
  );
  const result: EvidenceCheck[] = [];

  if (failed.length > 0) {
    result.push(fail(
      'CI / checks',
      failed.map((check) => check.name ?? '<unnamed>').join(', '),
      'CI checks contain failures',
      'Stop and inspect failing checks; do not treat review bots as approval.'
    ));
  } else {
    result.push(pass(
      'CI / checks',
      checks.map((check) => check.name ?? '<unnamed>').join(', '),
      'no failing CI checks reported',
      'Still verify required checks are for the latest HEAD.'
    ));
  }

  if (pending.length > 0) {
    result.push(warning(
      'Pending checks',
      pending.map((check) => check.name ?? '<unnamed>').join(', '),
      'checks are pending',
      'Wait for required checks or record a human-reviewed reason before merge readiness.'
    ));
  }

  return result;
}

function parseLinkedIssues(body: string): number[] {
  const issueNumbers = [...body.matchAll(LINKED_ISSUE_PATTERN)]
    .map((item) => item[1])
    .map((value) => Number.parseInt(value, 10))
    .filter((issue) => Number.isFinite(issue));
  return [...new Set(issueNumbers)];
}

function parseIssueOption(issueOption: string | undefined): number | null {
  if (!issueOption) return null;
  const parsed = Number.parseInt(issueOption, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isActionableReview(review: { body?: string; state?: string }): boolean {
  const body = (review.body ?? '').trim();
  if (body.length === 0) return false;
  if (PURE_NON_ACTIONABLE_REVIEW_PATTERN.test(body)) return false;
  if (EXPLICIT_NO_ACTIONABLE_REVIEW_PATTERN.test(body)) return false;
  return ACTIONABLE_REVIEW_PATTERN.test(body);
}

function findEvidenceUrl(body: string): string | null {
  return [...body.matchAll(EVIDENCE_URL_PATTERN)][0]?.[0] ?? null;
}

function parseIssueNumberFromEvidenceUrl(url: string): number | null {
  const match = url.match(SINGLE_EVIDENCE_URL_PATTERN);
  return match?.[3] ? Number.parseInt(match[3], 10) : null;
}

function findHashes(value: string): string[] {
  return [...value.matchAll(HASH_PATTERN)].map((match) => match[0]);
}

function hasExactValidationCommand(value: string): boolean {
  return EXACT_VALIDATION_COMMAND_PATTERN.test(value) || /\bskipped\b.+\b(package\.json|script|missing|not available)\b/i.test(value);
}

function hasValidationSummary(value: string): boolean {
  return /\b(validation|tests?|驗證|測試)\b/i.test(value);
}

function validationMatches(value: string): string[] {
  const commands = new Set<string>();
  for (const match of value.matchAll(new RegExp(EXACT_VALIDATION_COMMAND_PATTERN, 'gi'))) {
    commands.add(match[0].replace(/^`|`$/g, ''));
  }
  if (commands.size === 0 && /\bskipped\b.+\b(package\.json|script|missing|not available)\b/i.test(value)) {
    commands.add('skipped validation reason');
  }
  return [...commands];
}

function readJson<T>(argv: string[], errorMessage: string, fallback?: T): T {
  const result = run(argv);
  if (result.exitCode !== 0 && result.stdout.trim() === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${errorMessage} ${result.stderr.trim() || result.stdout.trim()}`);
  }

  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${errorMessage} Unexpected JSON output.`);
  }
}

function readJsonResult<T>(argv: string[], errorMessage: string): { value?: T; error?: string } {
  const result = run(argv);
  if (result.exitCode !== 0) {
    return { error: `${errorMessage} ${result.stderr.trim() || result.stdout.trim()}`.trim() };
  }

  try {
    return { value: JSON.parse(result.stdout) as T };
  } catch {
    return { error: `${errorMessage} Unexpected JSON output.` };
  }
}

function summarizeOverall(checks: EvidenceCheck[]): Severity {
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

function printReport(report: EvidenceCheckReport, format: EvidenceCheckFormat): void {
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
    `Evidence check summary: ${report.overall.toUpperCase()} ` +
    `(${counts.pass} pass, ${counts.warning} warning, ${counts.fail} fail, ${counts.needsHumanReview} needs-human-review)`
  );

  for (const check of report.checks) {
    console.log(
      `[${check.severity.toUpperCase()}] ${check.item} — ` +
      `evidence: ${check.evidence}; reason: ${check.reason}; suggested human action: ${check.action}`
    );
  }

  console.log('');
  console.log('Auxiliary notice:');
  console.log('- spec evidence-check is a read-only checker.');
  console.log('- PASS means evidence shape looks OK, but PASS is not approval.');
  console.log('- Human merge decision remains authoritative.');
  console.log('- This checker does not edit PRs, post issue comments, resolve review threads, merge, close issues, or mutate GitHub metadata.');
  console.log('- It does not fully enforce thread-level review conversation closeout.');
}

function pass(item: string, evidence: string, reason: string, action: string): EvidenceCheck {
  return { severity: 'pass', item, evidence, reason, action };
}

function warning(item: string, evidence: string, reason: string, action: string): EvidenceCheck {
  return { severity: 'warning', item, evidence, reason, action };
}

function fail(item: string, evidence: string, reason: string, action: string): EvidenceCheck {
  return { severity: 'fail', item, evidence, reason, action };
}

function needsHumanReview(item: string, evidence: string, reason: string, action: string): EvidenceCheck {
  return { severity: 'needs-human-review', item, evidence, reason, action };
}
