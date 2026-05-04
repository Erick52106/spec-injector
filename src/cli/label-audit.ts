import fs from 'fs';
import path from 'path';
import { run } from '../utils/shell.js';

type Severity = 'pass' | 'warning' | 'needs-human-review';

type LabelAuditCheck = {
  severity: Severity;
  summary: string;
  detail: string;
};

type LabelAuditOptions = {
  repo: string;
  limit?: string;
};

type IssuePayload = {
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  stateReason?: string;
  labels?: Array<{ name?: string }>;
  milestone?: { title?: string } | null;
};

type PullRequestPayload = {
  number?: number;
  title?: string;
  url?: string;
  labels?: Array<{ name?: string }>;
  milestone?: { title?: string } | null;
  closingIssuesReferences?: Array<{ number?: number }>;
  isDraft?: boolean;
};

type NormalizedIssue = {
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  stateReason: string | null;
  labels: string[];
  milestone: string | null;
};

type NormalizedPullRequest = {
  number: number;
  title: string;
  url: string;
  labels: string[];
  milestone: string | null;
  closingIssues: number[];
  isDraft: boolean;
};

type Taxonomy = {
  acceptedLabels: Set<string>;
  typeOrEquivalentLabels: Set<string>;
  areaLabels: Set<string>;
  statusLabels: Set<string>;
  layerLabels: Set<string>;
  layerToMilestone: Map<string, string>;
};

const STATUS_IN_REVIEW = 'status:in-review';
const STATUS_IMPLEMENTED = 'status:implemented';
const STATUS_NEEDS_DESIGN = 'status:needs-design';

export async function labelAudit(opts: LabelAuditOptions): Promise<void> {
  try {
    const report = buildLabelAuditReport(opts, process.cwd());
    printReport(report);

    if (report.overall === 'needs-human-review') {
      process.exit(1);
    }
  } catch (err) {
    console.error(`✗ Label audit failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

function buildLabelAuditReport(
  opts: LabelAuditOptions,
  repoRoot: string
): { overall: Severity; checks: LabelAuditCheck[] } {
  const taxonomy = loadAcceptedTaxonomy(repoRoot);
  const limit = parseLimit(opts.limit);
  const checks: LabelAuditCheck[] = [];

  const issuesRead = readJsonResult<IssuePayload[]>(
    [
      'gh',
      'issue',
      'list',
      '--repo',
      opts.repo,
      '--state',
      'all',
      '--limit',
      String(limit),
      '--json',
      'number,title,url,state,stateReason,labels,milestone',
    ],
    'could not read gh issue list output',
    'could not parse gh issue list output'
  );
  if (issuesRead.error) {
    return singleNeedsHumanReviewReport(issuesRead.error);
  }

  const prsRead = readJsonResult<PullRequestPayload[]>(
    [
      'gh',
      'pr',
      'list',
      '--repo',
      opts.repo,
      '--state',
      'open',
      '--limit',
      String(limit),
      '--json',
      'number,title,url,labels,milestone,closingIssuesReferences,isDraft',
    ],
    'could not read gh pr list output',
    'could not parse gh pr list output'
  );
  if (prsRead.error) {
    return singleNeedsHumanReviewReport(prsRead.error);
  }

  const normalizedIssues = normalizeIssues(issuesRead.value ?? []);
  if (normalizedIssues.error) {
    return singleNeedsHumanReviewReport(normalizedIssues.error);
  }

  const normalizedPrs = normalizePullRequests(prsRead.value ?? []);
  if (normalizedPrs.error) {
    return singleNeedsHumanReviewReport(normalizedPrs.error);
  }

  const openReviewPrsByIssue = buildOpenReviewPrsByIssue(normalizedPrs.value);

  for (const issue of normalizedIssues.value) {
    checks.push(...auditIssue(issue, taxonomy, openReviewPrsByIssue));
  }

  for (const pr of normalizedPrs.value) {
    checks.push(...auditPullRequest(pr, taxonomy));
  }

  return {
    overall: summarizeOverall(checks),
    checks,
  };
}

function auditIssue(
  issue: NormalizedIssue,
  taxonomy: Taxonomy,
  openReviewPrsByIssue: Map<number, NormalizedPullRequest[]>
): LabelAuditCheck[] {
  const checks: LabelAuditCheck[] = [];
  const labelSet = new Set(issue.labels);
  const typeLabels = issue.labels.filter((label) => taxonomy.typeOrEquivalentLabels.has(label));
  const areaLabels = issue.labels.filter((label) => taxonomy.areaLabels.has(label));
  const statusLabels = issue.labels.filter((label) => taxonomy.statusLabels.has(label));
  const layerLabels = issue.labels.filter((label) => taxonomy.layerLabels.has(label));
  const unknownLabels = issue.labels.filter((label) => !taxonomy.acceptedLabels.has(label));
  const linkedReviewPrs = openReviewPrsByIssue.get(issue.number) ?? [];

  if (issue.state === 'OPEN') {
    if (typeLabels.length > 0) {
      checks.push(pass(
        `issue #${issue.number} has type metadata`,
        typeLabels.join(', ')
      ));
    } else {
      checks.push(warning(
        `issue #${issue.number} is missing a type or GitHub default equivalent label`,
        'Open issues should keep one type/equivalent label for deterministic audit output.'
      ));
    }

    if (areaLabels.length > 0) {
      checks.push(pass(
        `issue #${issue.number} has area metadata`,
        areaLabels.join(', ')
      ));
    } else {
      checks.push(warning(
        `issue #${issue.number} is missing a primary area label`,
        'Open issues should keep at least one area label.'
      ));
    }

    checks.push(...checkStatusShape(issue.number, statusLabels));

    if (statusLabels.length === 0) {
      checks.push(warning(
        `issue #${issue.number} is missing a status label`,
        'Open issues should keep one active status label.'
      ));
    } else if (statusLabels.length === 1) {
      checks.push(pass(
        `issue #${issue.number} has status metadata`,
        statusLabels[0]
      ));
    }

    if (labelSet.has(STATUS_IMPLEMENTED)) {
      checks.push(warning(
        `issue #${issue.number} is open but already uses status:implemented`,
        'Completed status usually belongs on merged/closed work with closeout evidence.'
      ));
    }
  } else {
    checks.push(...checkStatusShape(issue.number, statusLabels));

    if (issue.stateReason === 'COMPLETED') {
      if (labelSet.has(STATUS_IMPLEMENTED)) {
        checks.push(pass(
          `issue #${issue.number} closed completed state aligns with status:implemented`,
          'Completed closeout metadata is aligned.'
        ));
      } else {
        checks.push(warning(
          `issue #${issue.number} is closed as completed without status:implemented`,
          'Closed completed issues should align with status:implemented when closeout evidence exists.'
        ));
      }
    } else if (issue.stateReason === 'NOT_PLANNED') {
      if (labelSet.has(STATUS_IMPLEMENTED)) {
        checks.push(warning(
          `issue #${issue.number} is closed as not planned but still uses status:implemented`,
          'Closed not planned issues should not carry implemented status.'
        ));
      } else {
        checks.push(pass(
          `issue #${issue.number} is closed as not planned and does not require status:implemented`,
          'No completed-status backfill is needed.'
        ));
      }
    }
  }

  if (layerLabels.length === 0) {
    checks.push(warning(
      `issue #${issue.number} is missing a primary layer label`,
      'Issues should usually keep one primary layer label when classification is clear.'
    ));
  } else if (layerLabels.length === 1) {
    const expectedMilestone = taxonomy.layerToMilestone.get(layerLabels[0]);
    if (!issue.milestone) {
      checks.push(warning(
        `issue #${issue.number} is missing a roadmap milestone`,
        `Layer label ${layerLabels[0]} has no matching milestone assigned.`
      ));
    } else if (expectedMilestone && issue.milestone !== expectedMilestone) {
      checks.push(warning(
        `issue #${issue.number} milestone does not match layer label`,
        `Layer ${layerLabels[0]} normally maps to milestone ${expectedMilestone}, found ${issue.milestone}.`
      ));
    } else if (issue.milestone) {
      checks.push(pass(
        `issue #${issue.number} milestone matches layer label`,
        `${issue.milestone} / ${layerLabels[0]}`
      ));
    }
  } else {
    checks.push(needsHumanReview(
      `issue #${issue.number} has multiple layer labels`,
      layerLabels.join(', ')
    ));
  }

  if (unknownLabels.length > 0) {
    checks.push(warning(
      `issue #${issue.number} uses unknown labels`,
      `${unknownLabels.join(', ')} (report only; keep human review in the loop before any metadata cleanup).`
    ));
  }

  if (linkedReviewPrs.length > 0) {
    const prSummary = linkedReviewPrs.map((pr) => `#${pr.number}`).join(', ');
    if (labelSet.has(STATUS_NEEDS_DESIGN)) {
      checks.push(needsHumanReview(
        `issue #${issue.number} still uses status:needs-design while open PRs target implementation`,
        `Open non-draft PRs: ${prSummary}`
      ));
    } else if (labelSet.has(STATUS_IN_REVIEW)) {
      checks.push(pass(
        `issue #${issue.number} uses status:in-review while PR review is active`,
        `Open non-draft PRs: ${prSummary}`
      ));
    } else {
      checks.push(warning(
        `issue #${issue.number} may need status:in-review because open PR ${prSummary} is not draft`,
        'Review-state labeling should stay conservative but visible on the source issue.'
      ));
    }
  }

  return checks;
}

function auditPullRequest(pr: NormalizedPullRequest, taxonomy: Taxonomy): LabelAuditCheck[] {
  const checks: LabelAuditCheck[] = [];
  const layerLabels = pr.labels.filter((label) => taxonomy.layerLabels.has(label));
  const statusLabels = pr.labels.filter((label) => taxonomy.statusLabels.has(label));
  const unknownLabels = pr.labels.filter((label) => !taxonomy.acceptedLabels.has(label));

  if (statusLabels.length > 1) {
    checks.push(needsHumanReview(
      `PR #${pr.number} has conflicting status labels`,
      statusLabels.join(', ')
    ));
  }

  if (layerLabels.length > 1) {
    checks.push(needsHumanReview(
      `PR #${pr.number} has multiple layer labels`,
      layerLabels.join(', ')
    ));
  } else if (layerLabels.length === 1 && pr.milestone) {
    const expectedMilestone = taxonomy.layerToMilestone.get(layerLabels[0]);
    if (expectedMilestone && pr.milestone !== expectedMilestone) {
      checks.push(warning(
        `PR #${pr.number} milestone does not match layer label`,
        `Layer ${layerLabels[0]} normally maps to milestone ${expectedMilestone}, found ${pr.milestone}.`
      ));
    }
  }

  if (unknownLabels.length > 0) {
    checks.push(warning(
      `PR #${pr.number} uses unknown labels`,
      `${unknownLabels.join(', ')} (report only; keep human review in the loop before any metadata cleanup).`
    ));
  }

  if (checks.length === 0) {
    checks.push(pass(
      `PR #${pr.number} metadata stays within read-only audit scope`,
      pr.title
    ));
  }

  return checks;
}

function checkStatusShape(issueNumber: number, statusLabels: string[]): LabelAuditCheck[] {
  if (statusLabels.length <= 1) {
    return [];
  }

  return [needsHumanReview(
    `issue #${issueNumber} has conflicting active status labels`,
    statusLabels.join(', ')
  )];
}

function buildOpenReviewPrsByIssue(prs: NormalizedPullRequest[]): Map<number, NormalizedPullRequest[]> {
  const result = new Map<number, NormalizedPullRequest[]>();

  for (const pr of prs) {
    if (pr.isDraft) continue;

    for (const issueNumber of pr.closingIssues) {
      const current = result.get(issueNumber) ?? [];
      current.push(pr);
      result.set(issueNumber, current);
    }
  }

  return result;
}

function normalizeIssues(payload: IssuePayload[]): { value: NormalizedIssue[]; error?: string } {
  const issues: NormalizedIssue[] = [];

  for (const issue of payload) {
    const issueNumber = issue.number;
    if (typeof issueNumber !== 'number' || !Number.isFinite(issueNumber)) {
      return { value: [], error: 'gh issue list output is missing required fields for an issue: number' };
    }
    if (typeof issue.title !== 'string' || typeof issue.url !== 'string' || typeof issue.state !== 'string' || !Array.isArray(issue.labels)) {
      return { value: [], error: `gh issue list output is missing required fields for issue #${issueNumber}` };
    }

    const state = issue.state.toUpperCase();
    if (state !== 'OPEN' && state !== 'CLOSED') {
      return { value: [], error: `gh issue list output has an unsupported state for issue #${issueNumber}: ${issue.state}` };
    }

    issues.push({
      number: issueNumber,
      title: issue.title,
      url: issue.url,
      state,
      stateReason: typeof issue.stateReason === 'string' ? issue.stateReason.toUpperCase() : null,
      labels: normalizeLabelNames(issue.labels),
      milestone: issue.milestone?.title ?? null,
    });
  }

  return { value: issues };
}

function normalizePullRequests(payload: PullRequestPayload[]): { value: NormalizedPullRequest[]; error?: string } {
  const prs: NormalizedPullRequest[] = [];

  for (const pr of payload) {
    const prNumber = pr.number;
    if (typeof prNumber !== 'number' || !Number.isFinite(prNumber)) {
      return { value: [], error: 'gh pr list output is missing required fields for a pull request: number' };
    }
    if (typeof pr.title !== 'string' || typeof pr.url !== 'string' || !Array.isArray(pr.labels)) {
      return { value: [], error: `gh pr list output is missing required fields for PR #${prNumber}` };
    }

    const closingIssues = Array.isArray(pr.closingIssuesReferences)
      ? pr.closingIssuesReferences
        .map((item) => item.number)
        .filter((value): value is number => Number.isFinite(value))
      : [];

    prs.push({
      number: prNumber,
      title: pr.title,
      url: pr.url,
      labels: normalizeLabelNames(pr.labels),
      milestone: pr.milestone?.title ?? null,
      closingIssues,
      isDraft: Boolean(pr.isDraft),
    });
  }

  return { value: prs };
}

function normalizeLabelNames(labels: Array<{ name?: string }>): string[] {
  return [...new Set(labels
    .map((label) => label.name?.trim())
    .filter((label): label is string => Boolean(label)))];
}

function loadAcceptedTaxonomy(repoRoot: string): Taxonomy {
  const labelTaxonomyPath = path.join(repoRoot, 'docs', 'label-taxonomy.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');
  const labelTaxonomy = fs.readFileSync(labelTaxonomyPath, 'utf8');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  const typeLabels = new Set(extractBacktickedLabels(labelTaxonomy, /^- Type labels:/m));
  const areaLabels = new Set(extractBacktickedLabels(labelTaxonomy, /^- Area labels:/m));
  const statusLabels = new Set(extractBacktickedLabels(labelTaxonomy, /^- Status labels:/m));
  const layerLabels = new Set(extractBacktickedLabels(labelTaxonomy, /^- Layer labels:/m));
  const defaultEquivalentLabels = new Set(extractBacktickedLabels(labelTaxonomy, /^- GitHub default \/ equivalent labels:/m));
  const layerToMilestone = extractLayerMilestoneMap(workflow);

  return {
    acceptedLabels: new Set([
      ...typeLabels,
      ...areaLabels,
      ...statusLabels,
      ...layerLabels,
      ...defaultEquivalentLabels,
    ]),
    typeOrEquivalentLabels: new Set([
      ...typeLabels,
      ...defaultEquivalentLabels,
    ]),
    areaLabels,
    statusLabels,
    layerLabels,
    layerToMilestone,
  };
}

function extractBacktickedLabels(value: string, marker: RegExp): string[] {
  const line = value.split('\n').find((candidate) => marker.test(candidate));
  if (!line) return [];
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

function extractLayerMilestoneMap(workflow: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of workflow.matchAll(/- `([^`]+)` \/ `([^`]+)`: /g)) {
    result.set(match[2], match[1]);
  }
  return result;
}

function parseLimit(limitOption: string | undefined): number {
  if (!limitOption) return 200;
  const parsed = Number.parseInt(limitOption, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('--limit must be a positive integer.');
  }
  return parsed;
}

function readJsonResult<T>(
  argv: string[],
  readErrorMessage: string,
  parseErrorMessage: string
): { value?: T; error?: string } {
  const result = run(argv);
  if (result.exitCode !== 0) {
    return { error: `${readErrorMessage}: ${firstMeaningfulMessage(result.stderr, result.stdout)}` };
  }

  try {
    return { value: JSON.parse(result.stdout) as T };
  } catch {
    return { error: parseErrorMessage };
  }
}

function firstMeaningfulMessage(...values: string[]): string {
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed.split('\n')[0];
    }
  }
  return 'no details returned';
}

function singleNeedsHumanReviewReport(detail: string): { overall: Severity; checks: LabelAuditCheck[] } {
  return {
    overall: 'needs-human-review',
    checks: [needsHumanReview('could not complete label audit with high confidence', detail)],
  };
}

function summarizeOverall(checks: LabelAuditCheck[]): Severity {
  if (checks.some((check) => check.severity === 'needs-human-review')) {
    return 'needs-human-review';
  }
  if (checks.some((check) => check.severity === 'warning')) {
    return 'warning';
  }
  return 'pass';
}

function printReport(report: { overall: Severity; checks: LabelAuditCheck[] }): void {
  const counts = {
    pass: report.checks.filter((check) => check.severity === 'pass').length,
    warning: report.checks.filter((check) => check.severity === 'warning').length,
    needsHumanReview: report.checks.filter((check) => check.severity === 'needs-human-review').length,
  };

  console.log(
    `Label audit summary: ${report.overall.toUpperCase()} ` +
    `(${counts.pass} pass, ${counts.warning} warning, ${counts.needsHumanReview} needs-human-review)`
  );

  for (const check of report.checks) {
    console.log(`[${check.severity.toUpperCase()}] ${check.summary} — ${check.detail}`);
  }
}

function pass(summary: string, detail: string): LabelAuditCheck {
  return { severity: 'pass', summary, detail };
}

function warning(summary: string, detail: string): LabelAuditCheck {
  return { severity: 'warning', summary, detail };
}

function needsHumanReview(summary: string, detail: string): LabelAuditCheck {
  return { severity: 'needs-human-review', summary, detail };
}
