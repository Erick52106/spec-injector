import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { ensureRepoPath } from '../utils/fs.js';
import { run } from '../utils/shell.js';
import { plan } from './plan.js';
import type { Config } from '../config/types.js';
import { fetchIssue } from '../github/issue.js';
import type { Issue } from '../github/types.js';

type WorkflowPhase = 'start' | 'commit' | 'merge';
type WorkflowStatus = 'pass' | 'fail' | 'manual' | 'skipped';
type OutputFormat = 'text' | 'json';
type DelegationOutcome = 'n/a' | 'skipped' | 'completed' | 'fell_through' | 'unavailable';

type WorkflowCheckOptions = {
  repo?: string;
  phase: string;
  format?: string;
  issue?: string;
  pr?: string;
  prBody?: string;
  headSha?: string;
  routingEvidence?: string;
  findingDisposition?: string;
  thresholdEvidence?: string;
};

type WorkflowCheckResult = {
  phase: WorkflowPhase;
  status: WorkflowStatus;
  repo: string;
  head_sha: string;
  checked_at: string;
  missing_fields: string[];
  warnings: string[];
  evidence_summary: string;
  routing_mode?: string;
  routing_task_class?: string;
  spark_required?: string;
  worker_5_4_required?: string;
  controller_role?: string;
  controller_fallback?: string;
  controller_fallback_reason?: string;
  delegation_outcome: DelegationOutcome;
  delegation_threshold?: string;
  routing_evidence_ref?: string;
  fallback_status?: string;
  fallback_reason_quality?: string;
  routing_mismatch?: string;
  finding_disposition_status?: string;
  threshold_calibration_status?: string;
  closeout_readback_status?: string;
  task_size?: string;
  risk?: string;
  delegation_decision?: string;
  threshold_ledger_ref?: string;
  checks_status?: string;
  unresolved_review_threads_count?: number;
  coderabbit_status?: string;
  codex_connector_status?: string;
  human_review_status?: string;
  draft_status?: string;
  source_issue_evidence_status?: string;
  spec_gate_status?: string;
  routing_evidence_status?: string;
  ready_to_merge?: 'yes' | 'no' | 'manual';
};

type PrBodyEvidence = {
  hasSpecStatus: boolean;
  specStatus: 'pass' | 'fail' | 'manual' | 'skipped' | 'pending' | 'unknown' | null;
  hasSpecRef: boolean;
  hasManualFallback: boolean;
  hasFinalMergeGate: boolean;
  hasLatestHead: boolean;
  headMatches: boolean | null;
  hasAutonomousSignal: boolean;
  hasRoutingStatus: boolean;
  routingStatus: 'pass' | 'fail' | 'manual' | 'skipped' | 'pending' | 'unknown' | null;
  hasRoutingRef: boolean;
  routingRef: string | null;
  hasDelegationLog: boolean;
  hasSparkEvidence: boolean;
  hasWorker54Evidence: boolean;
  claimsControllerOnly: boolean;
  controllerFallback: 'allowed' | 'denied' | null;
  controllerFallbackReason: string | null;
  hasDelegationOutcome: boolean;
  delegationOutcome: DelegationOutcome | null;
  hasThresholdStatus: boolean;
  thresholdStatus: 'pass' | 'fail' | 'manual' | 'skipped' | 'pending' | 'unknown' | null;
  hasThresholdRef: boolean;
  thresholdRef: string | null;
  hasFindingDispositionStatus: boolean;
  findingDispositionStatus: 'pass' | 'fail' | 'manual' | 'skipped' | 'pending' | 'unknown' | null;
  hasFindingDispositionRef: boolean;
  findingDispositionRef: string | null;
  readyToMerge: 'yes' | 'no' | 'manual' | null;
};

type RoutingTaskClass =
  | 'trivial_readonly'
  | 'metadata_readback'
  | 'small_docs_template_test'
  | 'workflow_policy'
  | 'product_behavior'
  | 'merge_gate'
  | 'unknown';

type RoutingEvidence = {
  source_status?: WorkflowStatus;
  source_missing_fields?: string[];
  routing_mode: string;
  routing_task_class: RoutingTaskClass | 'n/a';
  spark_required: 'yes' | 'no' | 'n/a';
  worker_5_4_required: 'yes' | 'no' | 'n/a';
  controller_role: string;
  controller_fallback: 'allowed' | 'denied' | 'n/a';
  controller_fallback_reason: string;
  delegation_threshold: string;
  routing_evidence_ref: string;
  delegation_outcome?: DelegationOutcome;
  head_sha?: string;
  spark_readback_evidence?: string;
  worker_5_4_evidence?: string;
};

type FallbackAssessment = {
  fallback_status: 'pass' | 'fail' | 'manual' | 'n/a';
  fallback_reason_quality: 'strong' | 'weak' | 'missing' | 'n/a';
  routing_mismatch: string[];
};

type GateAssessment = {
  status: WorkflowStatus;
  missingFields: string[];
  warnings: string[];
};

type FindingDispositionEvidence = {
  findings: Array<{
    finding_id?: string;
    source?: string;
    status?: string;
    rationale_ref?: string;
    resolved?: string;
    follow_up_issue?: string;
  }>;
};

type ThresholdEvidence = {
  task_size?: string;
  risk?: string;
  delegation_decision?: string;
  expected_delegation_cost?: string;
  actual_friction?: string;
  controller_direct_reason?: string;
  threshold_ledger_ref?: string;
  worker_evidence_ref?: string;
};

type CloseoutReadback = {
  status: WorkflowStatus;
  missingFields: string[];
  warnings: string[];
  checksStatus: WorkflowStatus;
  unresolvedReviewThreadsCount: number | null;
  coderabbitStatus: WorkflowStatus | 'skipped';
  codexConnectorStatus: WorkflowStatus | 'skipped';
  humanReviewStatus: WorkflowStatus;
  draftStatus: WorkflowStatus;
  sourceIssueEvidenceStatus: WorkflowStatus;
  specGateStatus: WorkflowStatus;
  routingEvidenceStatus: WorkflowStatus;
  findingDispositionStatus: WorkflowStatus;
  readyToMerge: 'yes' | 'no' | 'manual';
};

const PHASES = new Set<WorkflowPhase>(['start', 'commit', 'merge']);
const FORMATS = new Set<OutputFormat>(['text', 'json']);
const SPEC_STATUS_PATTERN = /\b(?:spec(?:[-_ ](?:gate|workflow|workflow-check|evidence))?|workflow-check|spec_evidence_status)\b[^\n\r]{0,120}\b(pass|fail|manual|skipped|pending|unknown)\b/i;
const SPEC_STATUS_FIELD_NAMES = [
  'spec_evidence_status',
  'spec evidence status',
  'spec_gate_status',
  'spec gate status',
  'workflow_check_status',
  'workflow-check status',
  'workflow check status',
  'spec status',
];
const SPEC_REF_PATTERN = /\b(?:spec[_ -]evidence[_ -]ref|spec[_ -]gate[_ -]ref|workflow-check[_ -]ref|spec gate evidence ref|spec gate evidence|workflow-check evidence)\b\s*[:=]?\s*\S+/i;
const MANUAL_FALLBACK_PATTERN = /\bmanual(?: checklist)? fallback\b|\bmanual spec gate\b|\bmanual workflow gate\b/i;
const FINAL_MERGE_GATE_PATTERN = /\bfinal merge gate\b|\bmerge gate\b/i;
const LATEST_HEAD_PATTERN = /\b(?:latest head|head sha|commit hash|head)\b[^\n\r]{0,80}\b[0-9a-f]{7,40}\b/i;
const ROUTING_STATUS_PATTERN = /\b(?:routing[_ -]evidence[_ -]status|routing status)\b\s*[:=]\s*(pass|fail|manual|skipped|pending|unknown)\s*$/im;
const GENERIC_STATUS_VALUES = ['pass', 'fail', 'manual', 'skipped', 'pending', 'unknown'] as const;
const AUTONOMOUS_SIGNAL_PATTERN = /\b(?:Autonomous Worker Profiles|Hybrid AWP|AWP|Codex autonomous PR|controller_fallback|Delegation Execution Log)\b/i;
const AUTONOMOUS_WORKER_ROUTING_SIGNAL_PATTERN = /\bautonomous worker[- ]routing\b/i;
const NEGATED_AUTONOMOUS_WORKER_ROUTING_SIGNAL_PATTERN = /\b(?:no|not)\s+autonomous worker[- ]routing\b|\bautonomous worker[- ]routing\s+(?:is\s+)?not\s+(?:requested|required)\b/i;
const SPARK_EVIDENCE_PATTERN = /\b(?:ops_spark|spark(?: \/ ops)? worker|ops worker|spark_readback_evidence|readback evidence)\b/i;
const WORKER_54_EVIDENCE_PATTERN = /\b(?:worker_5_4|5\.4 worker|implementation worker|bounded implementation worker)\b/i;
const CONTROLLER_ONLY_PATTERN = /\b(?:controller-only|controller only|controller_fallback\s*[:=]\s*allowed|controller fallback\s*[:=]\s*allowed)\b/i;
const WEAK_FALLBACK_REASONS = new Set(['', 'n/a', 'na', 'none', 'small', 'done', 'ok', 'trivial']);
const FINDING_SOURCES = ['coderabbit', 'chatgpt-codex-connector', 'human', 'self-review'];
const FINDING_STATUSES = ['adopted', 'not_adopted', 'deferred_follow_up', 'blocked', 'noise'];
const DELEGATION_OUTCOMES = ['n/a', 'skipped', 'completed', 'fell_through', 'unavailable'] as const;
const THRESHOLD_TASK_SIZES = ['tiny', 'small', 'medium', 'large'];
const THRESHOLD_RISKS = ['low', 'medium', 'high'];
const THRESHOLD_DECISIONS = ['spawned', 'controller_direct', 'manual'];
const THRESHOLD_COSTS = ['low', 'medium', 'high'];
const THRESHOLD_FRICTION = ['none', 'minor', 'major'];

export async function workflowCheck(opts: WorkflowCheckOptions): Promise<void> {
  const phase = parsePhase(opts.phase);
  const format = parseFormat(opts.format ?? 'text');
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const checkedAt = new Date().toISOString();
  const warnings: string[] = [];
  let config: Config | null = null;

  try {
    ensureRepoPath(repoPath);
  } catch (err) {
    const result = buildResult({
      phase,
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['config'],
      warnings,
      evidenceSummary: `workflow-check could not validate repo config: ${(err as Error).message}`,
    });
    printResult(result, format);
    process.exit(1);
  }

  try {
    config = await loadConfig(repoPath);
  } catch (err) {
    if (isMergePrCloseout(phase, opts)) {
      warnings.push(`Local config unavailable; merge --pr closeout continued with readback-only evidence: ${(err as Error).message}`);
    } else {
      const result = buildResult({
        phase,
        repoPath,
        checkedAt,
        status: 'fail',
        missingFields: ['config'],
        warnings,
        evidenceSummary: `workflow-check could not validate repo config: ${(err as Error).message}`,
      });
      printResult(result, format);
      process.exit(1);
    }
  }

  const result = await runPhase(phase, repoPath, config, opts, checkedAt, warnings);
  printResult(result, format);
  if (result.status === 'fail') process.exit(1);
}

function isMergePrCloseout(phase: WorkflowPhase, opts: WorkflowCheckOptions): boolean {
  return phase === 'merge' && Boolean(opts.pr);
}

function parsePhase(value: string): WorkflowPhase {
  if (PHASES.has(value as WorkflowPhase)) return value as WorkflowPhase;
  throw new Error(`Unsupported workflow-check phase: ${value}. Expected start|commit|merge.`);
}

function parseFormat(value: string): OutputFormat {
  if (FORMATS.has(value as OutputFormat)) return value as OutputFormat;
  throw new Error(`Unsupported workflow-check format: ${value}. Expected text|json.`);
}

async function runPhase(
  phase: WorkflowPhase,
  repoPath: string,
  config: Config | null,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[]
): Promise<WorkflowCheckResult> {
  if (phase === 'start') {
    return runStartPhase(repoPath, opts, checkedAt, warnings);
  }

  if (isMergePrCloseout(phase, opts)) {
    return runMergeCloseoutPhase(repoPath, opts, checkedAt, warnings);
  }

  if (!config) {
    return buildResult({
      phase,
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['config'],
      warnings,
      evidenceSummary: 'workflow-check could not validate repo config',
    });
  }

  const staged = readStagedPaths(repoPath, config);
  warnings.push(...staged.warnings);
  if (!hasStagedInspectionFailure(staged.forbidden)) {
    const dirtyWarning = getDirtyUnstagedWarning(repoPath);
    if (dirtyWarning) warnings.push(dirtyWarning);
  }

  if (phase === 'commit') {
    return runCommitPhase(repoPath, opts, checkedAt, warnings, staged.forbidden);
  }

  return runMergePhase(repoPath, opts, checkedAt, warnings, staged.forbidden);
}

async function runStartPhase(
  repoPath: string,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[]
): Promise<WorkflowCheckResult> {
  const threshold = await readOptionalThresholdAssessment(opts.thresholdEvidence, warnings);
  if (!opts.issue && threshold) {
    return buildResult({
      phase: 'start',
      repoPath,
      checkedAt,
      status: threshold.status,
      missingFields: threshold.missingFields,
      warnings: [...warnings, ...threshold.warnings],
      evidenceSummary: threshold.status === 'pass'
        ? 'start gate passed: threshold calibration evidence is valid'
        : `start gate threshold calibration ${threshold.status}: ${threshold.missingFields.join(', ')}`,
      routing: noRoutingEvidence(),
      fallback: noFallbackAssessment(),
      threshold: threshold.evidence,
      thresholdAssessment: threshold,
    });
  }

  if (!opts.issue) {
    return buildResult({
      phase: 'start',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: ['issue'],
      warnings: [...warnings, 'Start phase did not receive --issue; bounded context generation must be checked manually.'],
      evidenceSummary: 'start gate requires manual fallback because --issue was not provided',
      routing: noRoutingEvidence(),
      fallback: noFallbackAssessment(),
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
    });
  }

  let issue: Issue | null = null;
  try {
    issue = await fetchIssue(opts.issue, repoPath);
  } catch (err) {
    return buildResult({
      phase: 'start',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['issue'],
      warnings,
      evidenceSummary: `start gate could not read issue for routing: ${(err as Error).message}`,
      routing: noRoutingEvidence(),
      fallback: noFallbackAssessment(),
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
    });
  }

  const dryRun = await captureConsole(async () => {
    await plan(opts.issue as string, {
      repo: repoPath,
      dryRun: true,
      format: 'prompt',
      verbose: true,
    });
  });

  if (!dryRun.ok) {
    return buildResult({
      phase: 'start',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['bounded_context'],
      warnings: [...warnings, ...dryRun.warnings],
      evidenceSummary: `start gate could not generate bounded context: ${dryRun.error}`,
      routing: issue ? classifyRouting(issue) : noRoutingEvidence(),
      fallback: noFallbackAssessment(),
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
    });
  }

  const routing = classifyRouting(issue);
  const fallback = assessFallback(routing);
  const missingFields: string[] = [];
  if (routing.routing_task_class === 'unknown') missingFields.push('routing_task_class');
  if (fallback.fallback_status === 'fail') missingFields.push('controller_fallback_reason');
  if (threshold) missingFields.push(...threshold.missingFields);
  const status: WorkflowStatus = summarizeWorkflowStatus([
    missingFields.length > 0 || fallback.fallback_status === 'manual' ? 'manual' : 'pass',
    threshold?.status ?? 'pass',
  ]);

  return buildResult({
    phase: 'start',
    repoPath,
    checkedAt,
    status,
    missingFields,
    warnings: [...warnings, ...dryRun.warnings],
    evidenceSummary: status === 'pass'
      ? 'start gate passed: bounded context generated and Hybrid AWP routing classified'
      : 'start gate requires manual fallback: bounded context generated but routing needs review',
    routing,
    fallback,
    threshold: threshold?.evidence,
    thresholdAssessment: threshold,
  });
}

async function runCommitPhase(
  repoPath: string,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[],
  forbiddenStagedPaths: string[]
): Promise<WorkflowCheckResult> {
  if (forbiddenStagedPaths.length > 0) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['staged_forbidden_artifacts'],
      warnings,
      evidenceSummary: `commit gate blocked: staged forbidden artifacts: ${forbiddenStagedPaths.join(', ')}`,
    });
  }

  if (!opts.prBody) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: ['pr_body'],
      warnings: [...warnings, 'PR body not provided; workflow-check can only inspect repo-local staged state.'],
      evidenceSummary: 'commit gate requires manual fallback: PR body not provided; repo-local staged state is clean',
    });
  }

  let evidence: PrBodyEvidence;
  let routing: RoutingEvidence | null = null;
  const findingDisposition = await readOptionalFindingDispositionAssessment(opts.findingDisposition, warnings);
  const threshold = await readOptionalThresholdAssessment(opts.thresholdEvidence, warnings);
  try {
    evidence = await parsePrBodyEvidence(opts.prBody, opts.headSha);
  } catch (err) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['pr_body'],
      warnings: [...warnings, `Could not read PR body: ${(err as Error).message}`],
      evidenceSummary: 'commit gate failed: PR body evidence could not be read',
    });
  }
  try {
    routing = opts.routingEvidence ? await readRoutingEvidence(opts.routingEvidence) : null;
  } catch (err) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['routing_evidence'],
      warnings: [...warnings, `Could not read routing evidence: ${(err as Error).message}`],
      evidenceSummary: 'commit gate failed: routing evidence could not be read',
    });
  }

  const routingCheck = routing ? assessRoutingAlignment(routing, evidence, 'commit', opts.headSha) : null;
  const delegationOutcome = resolveDelegationOutcome(evidence, routing);
  const delegationWarnings = delegationOutcomeWarnings(evidence, routing);

  if (evidence.hasManualFallback && !isBlockedSpecStatus(evidence.specStatus)) {
    const fallback = assessFallback(routing ?? evidenceToFallbackRouting(evidence), evidence);
    if (routingCheck && routingCheck.fallback_status === 'fail') {
      return buildResult({
        phase: 'commit',
        repoPath,
        checkedAt,
        status: 'fail',
        missingFields: routingCheck.routing_mismatch,
        warnings: [...warnings, ...delegationWarnings],
        evidenceSummary: `commit gate routing alignment failed: ${routingCheck.routing_mismatch.join(', ')}`,
        routing: routing ?? evidenceToFallbackRouting(evidence),
        fallback: routingCheck,
        findingDispositionAssessment: findingDisposition,
        threshold: threshold?.evidence,
        thresholdAssessment: threshold,
        delegationOutcome,
      });
    }
    const manualMissingFields = [
      ...(findingDisposition?.missingFields ?? []),
      ...(threshold?.missingFields ?? []),
    ];
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: summarizeWorkflowStatus(['manual', findingDisposition?.status ?? 'pass', threshold?.status ?? 'pass']),
      missingFields: manualMissingFields,
      warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
      evidenceSummary: 'commit gate recorded manual fallback evidence and staged state is clean',
      routing: routing ?? evidenceToFallbackRouting(evidence),
      fallback,
      findingDispositionAssessment: findingDisposition,
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
      delegationOutcome,
    });
  }

  const missingFields = missingCommitFields(evidence);
  if (isBlockedSpecStatus(evidence.specStatus)) {
    missingFields.push('ready_spec_gate_status');
  }
  if (routingCheck) missingFields.push(...routingCheck.routing_mismatch);
  if (findingDisposition) missingFields.push(...findingDisposition.missingFields);
  if (threshold) missingFields.push(...threshold.missingFields);

  if (missingFields.length > 0) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields,
      warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
      evidenceSummary: `commit gate missing ${missingFields.join(', ')}`,
      routing: routing ?? undefined,
      fallback: routingCheck ?? undefined,
      findingDispositionAssessment: findingDisposition,
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
      delegationOutcome,
    });
  }

  return buildResult({
    phase: 'commit',
    repoPath,
    checkedAt,
    status: 'pass',
    missingFields: [],
    warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
    evidenceSummary: 'commit gate passed: staged artifacts clean and PR body contains spec gate evidence',
    routing: routing ?? undefined,
    fallback: routingCheck ?? inferFallbackFromEvidence(evidence),
    findingDispositionAssessment: findingDisposition,
    threshold: threshold?.evidence,
    thresholdAssessment: threshold,
    delegationOutcome,
  });
}

async function runMergePhase(
  repoPath: string,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[],
  forbiddenStagedPaths: string[]
): Promise<WorkflowCheckResult> {
  if (opts.pr) {
    return runMergeCloseoutPhase(repoPath, opts, checkedAt, warnings);
  }

  if (forbiddenStagedPaths.length > 0) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['staged_forbidden_artifacts'],
      warnings,
      evidenceSummary: `merge gate blocked: staged forbidden artifacts: ${forbiddenStagedPaths.join(', ')}`,
    });
  }

  if (!opts.prBody) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: ['pr_body'],
      warnings: [...warnings, 'PR body not provided; merge evidence must be checked manually.'],
      evidenceSummary: 'merge gate requires manual fallback because PR body was not provided',
    });
  }

  let evidence: PrBodyEvidence;
  let routing: RoutingEvidence | null = null;
  const findingDisposition = await readOptionalFindingDispositionAssessment(opts.findingDisposition, warnings);
  const threshold = await readOptionalThresholdAssessment(opts.thresholdEvidence, warnings);
  try {
    evidence = await parsePrBodyEvidence(opts.prBody, opts.headSha);
  } catch (err) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['pr_body'],
      warnings: [...warnings, `Could not read PR body: ${(err as Error).message}`],
      evidenceSummary: 'merge gate failed: PR body evidence could not be read',
    });
  }
  try {
    routing = opts.routingEvidence ? await readRoutingEvidence(opts.routingEvidence) : null;
  } catch (err) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['routing_evidence'],
      warnings: [...warnings, `Could not read routing evidence: ${(err as Error).message}`],
      evidenceSummary: 'merge gate failed: routing evidence could not be read',
    });
  }

  const missingFields = missingMergeFields(evidence, Boolean(opts.headSha));
  if (isBlockedSpecStatus(evidence.specStatus)) {
    missingFields.push('ready_spec_gate_status');
  }
  if (evidence.headMatches === false) {
    missingFields.push('head_sha_freshness');
  }
  const routingCheck = routing ? assessRoutingAlignment(routing, evidence, 'merge', opts.headSha) : null;
  const delegationOutcome = resolveDelegationOutcome(evidence, routing);
  const delegationWarnings = delegationOutcomeWarnings(evidence, routing);
  if (routingCheck) missingFields.push(...routingCheck.routing_mismatch);
  if (findingDisposition) missingFields.push(...findingDisposition.missingFields);
  if (threshold) missingFields.push(...threshold.missingFields);

  if (evidence.hasManualFallback && missingFields.length > 0 && !isBlockedSpecStatus(evidence.specStatus) && evidence.headMatches !== false) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields,
      warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
      evidenceSummary: `merge gate requires manual fallback: missing ${missingFields.join(', ')}`,
      routing: routing ?? evidenceToFallbackRouting(evidence),
      fallback: routingCheck ?? assessFallback(routing ?? evidenceToFallbackRouting(evidence), evidence),
      findingDispositionAssessment: findingDisposition,
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
      delegationOutcome,
    });
  }

  if (missingFields.length > 0) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields,
      warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
      evidenceSummary: renderMergeFailureSummary(missingFields),
      routing: routing ?? undefined,
      fallback: routingCheck ?? undefined,
      findingDispositionAssessment: findingDisposition,
      threshold: threshold?.evidence,
      thresholdAssessment: threshold,
      delegationOutcome,
    });
  }

  return buildResult({
    phase: 'merge',
    repoPath,
    checkedAt,
    status: 'pass',
    missingFields: [],
    warnings: [...warnings, ...delegationWarnings, ...(findingDisposition?.warnings ?? []), ...(threshold?.warnings ?? [])],
    evidenceSummary: 'merge gate passed: final merge gate, spec evidence, and HEAD freshness are present',
    routing: routing ?? undefined,
    fallback: routingCheck ?? inferFallbackFromEvidence(evidence),
    findingDispositionAssessment: findingDisposition,
    threshold: threshold?.evidence,
    thresholdAssessment: threshold,
    delegationOutcome,
  });
}

async function runMergeCloseoutPhase(
  repoPath: string,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[]
): Promise<WorkflowCheckResult> {
  const context = resolvePrReadbackContext(opts.pr as string, repoPath);
  if (!context.repo) {
    const closeout = manualCloseout(['github_repo'], ['Could not infer GitHub owner/name for --pr readback.']);
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: closeout.missingFields,
      warnings: [...warnings, ...closeout.warnings],
      evidenceSummary: 'merge closeout readback requires manual fallback: GitHub repo could not be inferred',
      closeout,
    });
  }

  const prRead = readGhJsonResult<Record<string, unknown>>([
    'gh',
    'pr',
    'view',
    context.prRef,
    '--repo',
    context.repo,
    '--json',
    'number,url,body,headRefOid,isDraft,reviews,statusCheckRollup,closingIssuesReferences',
  ]);
  const checksRead = readGhJsonResult<Array<Record<string, unknown>>>([
    'gh',
    'pr',
    'checks',
    context.prRef,
    '--repo',
    context.repo,
    '--json',
    'name,state,bucket,link,startedAt,completedAt',
  ]);
  const threadsRead = readReviewThreads(context.prRef, context.repo);

  if (!prRead.value) {
    const closeout = manualCloseout(['pr_readback'], [prRead.error ?? 'Could not read PR metadata.']);
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: closeout.missingFields,
      warnings: [...warnings, ...closeout.warnings],
      evidenceSummary: 'merge closeout readback requires manual fallback: PR metadata could not be read',
      closeout,
    });
  }

  const pr = prRead.value;
  const body = String(pr.body ?? '');
  const headSha = typeof pr.headRefOid === 'string' ? pr.headRefOid : undefined;
  const prBodyEvidence = parsePrBodyEvidenceText(body, headSha);
  const checks = checksRead.value ?? [];
  const missingFields: string[] = [];
  const readWarnings: string[] = [];
  if (checksRead.error) {
    missingFields.push('checks_status');
    readWarnings.push(checksRead.error);
  }
  if (threadsRead.error) {
    missingFields.push('review_threads');
    readWarnings.push(threadsRead.error);
  }

  const checksSummary = checksRead.error ? { status: 'manual' as WorkflowStatus, warnings: [] } : summarizeChecks(checks);
  readWarnings.push(...checksSummary.warnings);
  const checksStatus = checksSummary.status;
  const unresolvedCount = threadsRead.value === null
    ? null
    : threadsRead.value.filter((thread) => thread.isResolved !== true).length;
  if (unresolvedCount !== null && unresolvedCount > 0) missingFields.push('unresolved_review_threads');

  const coderabbitStatus = summarizeNamedAutomationStatus(checks, pr, /coderabbit/i);
  const codexConnectorStatus = summarizeCodexConnectorStatus(pr);
  const humanReviewStatus = summarizeHumanReviewStatus(pr);
  const draftStatus: WorkflowStatus = pr.isDraft === true ? 'fail' : 'pass';
  const sourceIssueEvidenceStatus = /https:\/\/github\.com\/[^\s]+\/issues\/\d+#issuecomment-\d+/i.test(body) ? 'pass' : 'manual';
  const specGateStatus = prBodyEvidence.specStatus === 'pass' ? 'pass' : isBlockedSpecStatus(prBodyEvidence.specStatus) ? 'fail' : 'manual';
  const routingEvidenceStatus = prBodyEvidence.routingStatus === 'pass' ? 'pass' : isBlockedRoutingStatus(prBodyEvidence.routingStatus) ? 'fail' : 'manual';
  const delegationOutcomeStatus: WorkflowStatus = prBodyEvidence.hasDelegationOutcome && !prBodyEvidence.delegationOutcome ? 'fail' : 'pass';
  const findingDispositionStatus = prBodyEvidence.findingDispositionStatus === 'pass'
    ? 'pass'
    : isBlockedRoutingStatus(prBodyEvidence.findingDispositionStatus)
      ? 'fail'
      : 'manual';
  const readyToMergeStatus = prBodyEvidence.readyToMerge === 'yes'
    ? 'pass'
    : prBodyEvidence.readyToMerge === 'no'
      ? 'fail'
      : 'manual';

  if (checksStatus !== 'pass') missingFields.push('checks_status');
  if (sourceIssueEvidenceStatus !== 'pass') missingFields.push('source_issue_evidence');
  if (specGateStatus !== 'pass') missingFields.push('spec_gate_status');
  if (routingEvidenceStatus !== 'pass') missingFields.push('routing_evidence_status');
  if (delegationOutcomeStatus === 'fail') missingFields.push('delegation_outcome');
  if (findingDispositionStatus === 'fail') missingFields.push('finding_disposition_status');
  if (readyToMergeStatus !== 'pass') missingFields.push('ready_to_merge');
  if (humanReviewStatus === 'fail') missingFields.push('human_review_status');
  if (draftStatus === 'fail') missingFields.push('draft_pr');
  if (headSha && !body.includes(headSha)) missingFields.push('head_sha_freshness');

  const hasFail = [checksStatus, specGateStatus, routingEvidenceStatus, delegationOutcomeStatus, findingDispositionStatus, readyToMergeStatus, humanReviewStatus, draftStatus].includes('fail') ||
    (unresolvedCount ?? 0) > 0;
  const hasManual = missingFields.length > 0 ||
    checksStatus === 'manual' ||
    sourceIssueEvidenceStatus === 'manual' ||
    specGateStatus === 'manual' ||
    routingEvidenceStatus === 'manual' ||
    findingDispositionStatus === 'manual' ||
    readyToMergeStatus === 'manual' ||
    unresolvedCount === null;
  const status: WorkflowStatus = hasFail ? 'fail' : hasManual ? 'manual' : 'pass';
  const closeout: CloseoutReadback = {
    status,
    missingFields: unique(missingFields),
    warnings: readWarnings,
    checksStatus,
    unresolvedReviewThreadsCount: unresolvedCount,
    coderabbitStatus,
    codexConnectorStatus,
    humanReviewStatus,
    draftStatus,
    sourceIssueEvidenceStatus,
    specGateStatus,
    routingEvidenceStatus,
    findingDispositionStatus,
    readyToMerge: status === 'pass' ? 'yes' : status === 'fail' ? 'no' : 'manual',
  };

  return buildResult({
    phase: 'merge',
    repoPath,
    checkedAt,
    status,
    missingFields: closeout.missingFields,
    warnings: [...warnings, ...readWarnings],
    evidenceSummary: status === 'pass'
      ? 'merge closeout readback passed: checks, review threads, evidence status, and HEAD freshness are ready'
      : `merge closeout readback ${status}: ${closeout.missingFields.join(', ')}`,
    closeout,
    delegationOutcome: prBodyEvidence.delegationOutcome,
  });
}

function readStagedPaths(repoPath: string, config: Config): { forbidden: string[]; warnings: string[] } {
  const result = run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd: repoPath });
  if (result.exitCode !== 0) {
    return {
      forbidden: [`could not inspect staged files with git diff --cached: ${formatShellError(result)}`],
      warnings: [],
    };
  }

  const stagedPaths = result.stdout.split('\0').filter(Boolean).map(normalizeGitPath);
  const forbidden = stagedPaths.filter((stagedPath) => isForbiddenArtifactPath(stagedPath, config));
  return { forbidden, warnings: [] };
}

function hasStagedInspectionFailure(forbiddenStagedPaths: string[]): boolean {
  return forbiddenStagedPaths.some((entry) => entry.startsWith('could not inspect staged files with git diff --cached:'));
}

function getDirtyUnstagedWarning(repoPath: string): string | null {
  const result = run(['git', 'status', '--porcelain=v1', '--untracked-files=normal'], { cwd: repoPath });
  if (result.exitCode !== 0) return `Could not inspect dirty worktree state: ${formatShellError(result)}`;
  return result.stdout.trim() ? 'Repo has dirty or untracked files; workflow-check did not modify or clean them.' : null;
}

function isForbiddenArtifactPath(gitPath: string, config: Config): boolean {
  if (gitPath === '.spec-injector' || gitPath.startsWith('.spec-injector/')) return true;
  if (gitPath.startsWith('spec-output/') || gitPath.startsWith('spec-outputs/')) return true;
  if (/(^|\/)issue-\d+-task-package\.md$/i.test(gitPath)) return true;
  if (/(^|\/)(?:task-package|spec-output|spec-evidence)(?:[.-][^/]*)?\.(?:md|json|txt)$/i.test(gitPath)) return true;
  if (/(^|\/)\.?private[-_]context(\/|\.md$|\.json$|\.txt$)/i.test(gitPath)) return true;
  return configuredPrivateExcludes(config).some((prefix) => gitPath === prefix || gitPath.startsWith(`${prefix}/`));
}

function configuredPrivateExcludes(config: Config): string[] {
  return (config.specConfig.discovery?.exclude ?? [])
    .map(normalizeGitPath)
    .filter((entry) => /private|secret|credential|context/i.test(entry));
}

async function parsePrBodyEvidence(prBodyPath: string, expectedHeadSha?: string): Promise<PrBodyEvidence> {
  const body = await fs.readFile(path.resolve(prBodyPath), 'utf8');
  return parsePrBodyEvidenceText(body, expectedHeadSha);
}

function parsePrBodyEvidenceText(body: string, expectedHeadSha?: string): PrBodyEvidence {
  const explicitSpecStatus = parseExplicitSpecStatus(body);
  const statusMatch = explicitSpecStatus.hasSpecStatus ? null : body.match(SPEC_STATUS_PATTERN);
  const specStatus = explicitSpecStatus.hasSpecStatus
    ? explicitSpecStatus.specStatus
    : statusMatch?.[1]?.toLowerCase() as PrBodyEvidence['specStatus'] | undefined;
  const hasRoutingStatusField = hasTextField(body, 'routing_evidence_status') || hasTextField(body, 'routing evidence status');
  const rawRoutingStatus = parseTextField(body, 'routing_evidence_status') ?? parseTextField(body, 'routing evidence status') ?? null;
  const routingStatus = hasRoutingStatusField ? parseRoutingStatus(rawRoutingStatus ?? '') : null;
  const routingRef = parseTextField(body, 'routing_evidence_ref') ??
    parseTextField(body, 'routing evidence ref') ??
    parseTextField(body, 'routing_ref');
  const rawThresholdStatus = parseTextField(body, 'threshold_evidence_status') ?? parseTextField(body, 'threshold evidence status') ?? null;
  const thresholdStatus = parseGenericStatus(rawThresholdStatus);
  const thresholdRef = parseTextField(body, 'threshold_ledger_ref') ??
    parseTextField(body, 'threshold ledger ref') ??
    parseTextField(body, 'threshold_ref');
  const rawFindingDispositionStatus = parseTextField(body, 'finding_disposition_status') ?? parseTextField(body, 'finding disposition status') ?? null;
  const findingDispositionStatus = parseGenericStatus(rawFindingDispositionStatus);
  const findingDispositionRef = parseTextField(body, 'finding_disposition_ref') ??
    parseTextField(body, 'finding disposition ref');
  const hasDelegationOutcomeField = hasTextField(body, 'delegation_outcome') || hasTextField(body, 'delegation outcome');
  const rawDelegationOutcome = parseTextField(body, 'delegation_outcome') ?? parseTextField(body, 'delegation outcome');
  const delegationOutcome = parseDelegationOutcome(rawDelegationOutcome);
  const readyToMerge = parseReadyToMerge(body);
  const hasLatestHead = Boolean(expectedHeadSha)
    ? body.includes(expectedHeadSha as string)
    : LATEST_HEAD_PATTERN.test(body);

  return {
    hasSpecStatus: explicitSpecStatus.hasSpecStatus || Boolean(statusMatch),
    specStatus: specStatus ?? null,
    hasSpecRef: SPEC_REF_PATTERN.test(body),
    hasManualFallback: MANUAL_FALLBACK_PATTERN.test(body),
    hasFinalMergeGate: FINAL_MERGE_GATE_PATTERN.test(body),
    hasLatestHead,
    headMatches: expectedHeadSha ? body.includes(expectedHeadSha) : null,
    hasAutonomousSignal: hasAutonomousRoutingSignal(body),
    hasRoutingStatus: hasRoutingStatusField,
    routingStatus: routingStatus ?? null,
    hasRoutingRef: Boolean(routingRef),
    routingRef,
    hasDelegationLog: /\bDelegation Execution Log\b/i.test(body),
    hasSparkEvidence: hasEvidenceRefValue(body, 'ops_spark readback evidence') ||
      hasEvidenceRefValue(body, 'spark_readback_evidence') ||
      hasEvidenceRefValue(body, 'spark readback evidence'),
    hasWorker54Evidence: hasEvidenceRefValue(body, 'worker_5_4 evidence') ||
      hasEvidenceRefValue(body, 'worker_5_4_evidence') ||
      hasEvidenceRefValue(body, '5.4 worker evidence'),
    claimsControllerOnly: CONTROLLER_ONLY_PATTERN.test(body),
    controllerFallback: parseAllowedDeniedField(body, 'controller_fallback') ?? parseAllowedDeniedField(body, 'controller fallback'),
    controllerFallbackReason: parseTextField(body, 'controller_fallback_reason') ?? parseTextField(body, 'fallback_reason'),
    hasDelegationOutcome: hasDelegationOutcomeField,
    delegationOutcome,
    hasThresholdStatus: Boolean(rawThresholdStatus),
    thresholdStatus,
    hasThresholdRef: Boolean(thresholdRef),
    thresholdRef,
    hasFindingDispositionStatus: Boolean(rawFindingDispositionStatus),
    findingDispositionStatus,
    hasFindingDispositionRef: Boolean(findingDispositionRef),
    findingDispositionRef,
    readyToMerge,
  };
}

function parseExplicitSpecStatus(body: string): { hasSpecStatus: boolean; specStatus: PrBodyEvidence['specStatus'] } {
  for (const fieldName of SPEC_STATUS_FIELD_NAMES) {
    if (!hasTextField(body, fieldName)) continue;
    return {
      hasSpecStatus: true,
      specStatus: parseGenericStatus(parseTextField(body, fieldName)) ?? 'unknown',
    };
  }
  return { hasSpecStatus: false, specStatus: null };
}

async function readRoutingEvidence(routingEvidencePath: string): Promise<RoutingEvidence> {
  const raw = JSON.parse(await fs.readFile(path.resolve(routingEvidencePath), 'utf8')) as Record<string, unknown>;
  const routingTaskClass = requiredEnum(
    raw.routing_task_class ?? raw.task_class,
    ['trivial_readonly', 'metadata_readback', 'small_docs_template_test', 'workflow_policy', 'product_behavior', 'merge_gate', 'unknown', 'n/a'],
    'routing_task_class'
  ) as RoutingEvidence['routing_task_class'];
  return {
    source_status: requiredEnum(raw.status, ['pass', 'fail', 'manual', 'skipped'], 'status') as WorkflowStatus,
    source_missing_fields: readStringArray(raw.missing_fields, 'missing_fields'),
    routing_mode: requiredEnum(raw.routing_mode, ['hybrid_awp', 'strict_awp', 'controller_fallback', 'n/a'], 'routing_mode'),
    routing_task_class: routingTaskClass,
    spark_required: requiredEnum(raw.spark_required, ['yes', 'no', 'n/a'], 'spark_required') as RoutingEvidence['spark_required'],
    worker_5_4_required: requiredEnum(raw.worker_5_4_required, ['yes', 'no', 'n/a'], 'worker_5_4_required') as RoutingEvidence['worker_5_4_required'],
    controller_role: String(raw.controller_role ?? 'n/a'),
    controller_fallback: requiredEnum(raw.controller_fallback, ['allowed', 'denied', 'n/a'], 'controller_fallback') as RoutingEvidence['controller_fallback'],
    controller_fallback_reason: String(raw.controller_fallback_reason ?? raw.fallback_reason ?? 'n/a'),
    delegation_threshold: String(raw.delegation_threshold ?? 'n/a'),
    routing_evidence_ref: requiredEvidenceRef(raw.routing_evidence_ref ?? raw.evidence_ref, 'routing_evidence_ref'),
    delegation_outcome: optionalDelegationOutcome(raw.delegation_outcome, 'delegation_outcome'),
    head_sha: typeof raw.head_sha === 'string' ? raw.head_sha : undefined,
    spark_readback_evidence: typeof raw.spark_readback_evidence === 'string' ? raw.spark_readback_evidence : undefined,
    worker_5_4_evidence: typeof raw.worker_5_4_evidence === 'string' ? raw.worker_5_4_evidence : undefined,
  };
}

async function readOptionalFindingDispositionAssessment(
  findingDispositionPath: string | undefined,
  warnings: string[]
): Promise<(GateAssessment & { evidence: FindingDispositionEvidence }) | null> {
  if (!findingDispositionPath) return null;
  try {
    const raw = JSON.parse(await fs.readFile(path.resolve(findingDispositionPath), 'utf8')) as Record<string, unknown> | unknown[];
    const evidence: FindingDispositionEvidence = {
      findings: Array.isArray(raw) ? raw as FindingDispositionEvidence['findings'] : (raw.findings as FindingDispositionEvidence['findings'] ?? []),
    };
    return { ...assessFindingDisposition(evidence), evidence };
  } catch (err) {
    return {
      status: 'fail',
      missingFields: ['finding_disposition'],
      warnings: [`Could not read finding disposition evidence: ${(err as Error).message}`],
      evidence: { findings: [] },
    };
  }
}

function assessFindingDisposition(evidence: FindingDispositionEvidence): GateAssessment {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(evidence.findings) || evidence.findings.length === 0) {
    return { status: 'manual', missingFields: ['finding_disposition'], warnings };
  }

  for (const finding of evidence.findings) {
    if (!meaningful(finding.finding_id)) missing.push('finding_id');
    if (!FINDING_SOURCES.includes(normalize(finding.source))) missing.push('finding_source');
    const status = normalize(finding.status);
    if (!FINDING_STATUSES.includes(status)) missing.push('finding_status');
    if (!['yes', 'no', 'n/a'].includes(normalize(finding.resolved))) missing.push('finding_resolved');
    if (status === 'blocked') missing.push('review_finding_blocked');
    if (['not_adopted', 'blocked', 'noise'].includes(status) && !isEvidenceRefValue(finding.rationale_ref)) {
      missing.push('finding_rationale_ref');
    }
    if (status === 'deferred_follow_up' && !isFollowUpRef(finding.follow_up_issue)) {
      missing.push('finding_follow_up_issue');
    }
  }

  return missing.length > 0
    ? { status: 'fail', missingFields: unique(missing), warnings }
    : { status: 'pass', missingFields: [], warnings };
}

async function readOptionalThresholdAssessment(
  thresholdEvidencePath: string | undefined,
  warnings: string[]
): Promise<(GateAssessment & { evidence: ThresholdEvidence }) | null> {
  if (!thresholdEvidencePath) return null;
  try {
    const evidence = JSON.parse(await fs.readFile(path.resolve(thresholdEvidencePath), 'utf8')) as ThresholdEvidence;
    return { ...assessThresholdEvidence(evidence), evidence };
  } catch (err) {
    return {
      status: 'fail',
      missingFields: ['threshold_evidence'],
      warnings: [`Could not read threshold evidence: ${(err as Error).message}`],
      evidence: {},
    };
  }
}

function assessThresholdEvidence(evidence: ThresholdEvidence): GateAssessment {
  const missing: string[] = [];
  const taskSize = normalize(evidence.task_size);
  const risk = normalize(evidence.risk);
  const decision = normalize(evidence.delegation_decision);

  if (!THRESHOLD_TASK_SIZES.includes(taskSize)) missing.push('task_size');
  if (!THRESHOLD_RISKS.includes(risk)) missing.push('risk');
  if (!THRESHOLD_DECISIONS.includes(decision)) missing.push('delegation_decision');
  if (!THRESHOLD_COSTS.includes(normalize(evidence.expected_delegation_cost))) missing.push('expected_delegation_cost');
  if (!THRESHOLD_FRICTION.includes(normalize(evidence.actual_friction))) missing.push('actual_friction');
  if (!isEvidenceRefValue(evidence.threshold_ledger_ref)) missing.push('threshold_ledger_ref');

  if (decision === 'controller_direct') {
    if (fallbackReasonQuality(evidence.controller_direct_reason) !== 'strong') missing.push('controller_direct_reason');
    if (!(taskSize === 'tiny' && risk === 'low') && !isEvidenceRefValue(evidence.worker_evidence_ref)) {
      missing.push('worker_evidence_ref');
    }
  }
  if (decision === 'spawned' && taskSize !== 'tiny' && !isEvidenceRefValue(evidence.worker_evidence_ref)) {
    missing.push('worker_evidence_ref');
  }

  return missing.length > 0
    ? { status: 'fail', missingFields: unique(missing), warnings: [] }
    : { status: 'pass', missingFields: [], warnings: [] };
}

function missingCommitFields(evidence: PrBodyEvidence): string[] {
  const missing: string[] = [];
  if (!evidence.hasSpecStatus) missing.push('spec_gate_status');
  if (!evidence.hasSpecRef) missing.push('spec_evidence_ref');
  return missing;
}

function missingMergeFields(evidence: PrBodyEvidence, expectedHeadProvided: boolean): string[] {
  const missing = missingCommitFields(evidence);
  if (!evidence.hasFinalMergeGate) missing.push('final_merge_gate');
  if (!evidence.hasLatestHead) missing.push(expectedHeadProvided ? 'head_sha_freshness' : 'latest_head_sha');
  return missing;
}

function isBlockedSpecStatus(status: PrBodyEvidence['specStatus']): boolean {
  return status === 'fail' || status === 'pending' || status === 'unknown';
}

function renderMergeFailureSummary(missingFields: string[]): string {
  if (missingFields.includes('spec_evidence_ref')) return 'merge gate missing spec evidence ref';
  if (missingFields.includes('head_sha_freshness')) return 'merge gate evidence does not match expected head SHA';
  return `merge gate missing ${missingFields.join(', ')}`;
}

function buildResult(input: {
  phase: WorkflowPhase;
  repoPath: string;
  checkedAt: string;
  status: WorkflowStatus;
  missingFields: string[];
  warnings: string[];
  evidenceSummary: string;
  routing?: RoutingEvidence;
  fallback?: FallbackAssessment;
  findingDispositionAssessment?: GateAssessment | null;
  threshold?: ThresholdEvidence;
  thresholdAssessment?: GateAssessment | null;
  closeout?: CloseoutReadback;
  delegationOutcome?: DelegationOutcome | null;
}): WorkflowCheckResult {
  const result: WorkflowCheckResult = {
    phase: input.phase,
    status: input.status,
    repo: input.repoPath,
    head_sha: getHeadSha(input.repoPath),
    checked_at: input.checkedAt,
    missing_fields: unique(input.missingFields),
    warnings: unique(input.warnings),
    evidence_summary: input.evidenceSummary,
    delegation_outcome: input.delegationOutcome ?? input.routing?.delegation_outcome ?? 'n/a',
  };
  if (input.routing) {
    result.routing_mode = input.routing.routing_mode;
    result.routing_task_class = input.routing.routing_task_class;
    result.spark_required = input.routing.spark_required;
    result.worker_5_4_required = input.routing.worker_5_4_required;
    result.controller_role = input.routing.controller_role;
    result.controller_fallback = input.routing.controller_fallback;
    result.controller_fallback_reason = input.routing.controller_fallback_reason;
    result.delegation_threshold = input.routing.delegation_threshold;
    result.routing_evidence_ref = input.routing.routing_evidence_ref;
  }
  if (input.fallback) {
    result.fallback_status = input.fallback.fallback_status;
    result.fallback_reason_quality = input.fallback.fallback_reason_quality;
    result.routing_mismatch = input.fallback.routing_mismatch.length > 0 ? input.fallback.routing_mismatch.join(',') : 'none';
  }
  if (input.findingDispositionAssessment) {
    result.finding_disposition_status = input.findingDispositionAssessment.status;
  }
  if (input.thresholdAssessment) {
    result.threshold_calibration_status = input.thresholdAssessment.status;
  }
  if (input.threshold) {
    result.task_size = String(input.threshold.task_size ?? 'n/a');
    result.risk = String(input.threshold.risk ?? 'n/a');
    result.delegation_decision = String(input.threshold.delegation_decision ?? 'n/a');
    result.threshold_ledger_ref = String(input.threshold.threshold_ledger_ref ?? 'n/a');
  }
  if (input.closeout) {
    result.closeout_readback_status = input.closeout.status;
    result.checks_status = input.closeout.checksStatus;
    if (input.closeout.unresolvedReviewThreadsCount !== null) {
      result.unresolved_review_threads_count = input.closeout.unresolvedReviewThreadsCount;
    }
    result.coderabbit_status = input.closeout.coderabbitStatus;
    result.codex_connector_status = input.closeout.codexConnectorStatus;
    result.human_review_status = input.closeout.humanReviewStatus;
    result.draft_status = input.closeout.draftStatus;
    result.source_issue_evidence_status = input.closeout.sourceIssueEvidenceStatus;
    result.spec_gate_status = input.closeout.specGateStatus;
    result.routing_evidence_status = input.closeout.routingEvidenceStatus;
    result.finding_disposition_status = input.closeout.findingDispositionStatus;
    result.ready_to_merge = input.closeout.readyToMerge;
  }
  return result;
}

function getHeadSha(repoPath: string): string {
  const result = run(['git', 'rev-parse', 'HEAD'], { cwd: repoPath });
  if (result.exitCode !== 0) return 'n/a';
  return result.stdout.trim() || 'n/a';
}

function printResult(result: WorkflowCheckResult, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`phase=${result.phase}`);
  console.log(`status=${result.status}`);
  console.log(`repo=${result.repo}`);
  console.log(`head_sha=${result.head_sha}`);
  console.log(`checked_at=${result.checked_at}`);
  console.log(`missing_fields=${result.missing_fields.length > 0 ? result.missing_fields.join(',') : 'none'}`);
  console.log(`warnings=${result.warnings.length > 0 ? result.warnings.join(' | ') : 'none'}`);
  console.log(`evidence_summary=${result.evidence_summary}`);
  for (const key of [
    'routing_mode',
    'routing_task_class',
    'spark_required',
    'worker_5_4_required',
    'controller_role',
    'controller_fallback',
    'controller_fallback_reason',
    'delegation_outcome',
    'delegation_threshold',
    'routing_evidence_ref',
    'fallback_status',
    'fallback_reason_quality',
    'routing_mismatch',
    'finding_disposition_status',
    'threshold_calibration_status',
    'closeout_readback_status',
    'task_size',
    'risk',
    'delegation_decision',
    'threshold_ledger_ref',
    'checks_status',
    'coderabbit_status',
    'codex_connector_status',
    'human_review_status',
    'draft_status',
    'source_issue_evidence_status',
    'spec_gate_status',
    'routing_evidence_status',
    'ready_to_merge',
  ] as const) {
    if (result[key]) console.log(`${key}=${result[key]}`);
  }
  if (result.unresolved_review_threads_count !== undefined) {
    console.log(`unresolved_review_threads_count=${result.unresolved_review_threads_count}`);
  }
}

function classifyRouting(issue: Issue): RoutingEvidence {
  const text = `${issue.title}\n${issue.body}\n${issue.labels.join('\n')}`;
  if (!hasAutonomousRoutingSignal(text)) return noRoutingEvidence();

  const taskClass = classifyRoutingTaskClass(text);
  if (taskClass === 'unknown') {
    return {
      routing_mode: 'hybrid_awp',
      routing_task_class: 'unknown',
      spark_required: 'n/a',
      worker_5_4_required: 'n/a',
      controller_role: 'scope|review',
      controller_fallback: 'denied',
      controller_fallback_reason: 'n/a',
      delegation_threshold: 'manual review required because deterministic routing could not classify the task',
      routing_evidence_ref: `workflow-check:start:issue-${issue.number}`,
    };
  }

  const defaults = routingDefaults(taskClass);
  return {
    ...defaults,
    routing_mode: defaults.controller_fallback === 'allowed' ? 'controller_fallback' : 'hybrid_awp',
    routing_task_class: taskClass,
    controller_fallback_reason: defaults.controller_fallback === 'allowed' ? 'n/a' : 'n/a',
    routing_evidence_ref: `workflow-check:start:issue-${issue.number}`,
  };
}

function hasAutonomousRoutingSignal(text: string): boolean {
  if (AUTONOMOUS_SIGNAL_PATTERN.test(text)) return true;
  if (!AUTONOMOUS_WORKER_ROUTING_SIGNAL_PATTERN.test(text)) return false;
  return !NEGATED_AUTONOMOUS_WORKER_ROUTING_SIGNAL_PATTERN.test(text);
}

function classifyRoutingTaskClass(text: string): RoutingTaskClass {
  if (/\b(?:merge gate|final merge|review finding|head sha|merge readiness)\b/i.test(text)) return 'merge_gate';
  if (/\breadback\b/i.test(text) || (/\b(?:GitHub|issue metadata|PR metadata|CI|review-thread|connector|CodeRabbit)\b/i.test(text) && /\b(?:metadata|readback|checks?|status)\b/i.test(text))) return 'metadata_readback';
  if (/\b(?:Scope Police|workflow policy|workflow governance|routing policy|guardrail|workflow-check|CI workflow)\b/i.test(text)) return 'workflow_policy';
  if (/\b(?:docs?|README|template|fixture|test)\b/i.test(text) && /\b(?:small|narrow|docs?|template|fixture|test)\b/i.test(text)) return 'small_docs_template_test';
  if (/\b(?:backend|frontend|runtime|auth|database|user-visible|product behavior)\b/i.test(text)) return 'product_behavior';
  if (/\b(?:trivial|0-3 minute|read-only)\b/i.test(text)) return 'trivial_readonly';
  return 'unknown';
}

function routingDefaults(
  taskClass: Exclude<RoutingTaskClass, 'unknown'>
): Omit<RoutingEvidence, 'routing_mode' | 'routing_task_class' | 'routing_evidence_ref' | 'controller_fallback_reason'> {
  const defaults: Record<Exclude<RoutingTaskClass, 'unknown'>, Omit<RoutingEvidence, 'routing_mode' | 'routing_task_class' | 'routing_evidence_ref' | 'controller_fallback_reason'>> = {
    trivial_readonly: {
      spark_required: 'no',
      worker_5_4_required: 'no',
      controller_role: 'fallback_executor',
      controller_fallback: 'allowed',
      delegation_threshold: '0-3 minute read-only checks may use controller fallback with an explicit bounded reason',
    },
    metadata_readback: {
      spark_required: 'yes',
      worker_5_4_required: 'no',
      controller_role: 'review',
      controller_fallback: 'denied',
      delegation_threshold: 'routine GitHub, CI, PR, issue, or review readback should route to ops / Spark evidence',
    },
    small_docs_template_test: {
      spark_required: 'no',
      worker_5_4_required: 'yes',
      controller_role: 'scope|review',
      controller_fallback: 'allowed',
      delegation_threshold: 'narrow docs, template, fixture, or workflow-test patches should use a bounded worker when available',
    },
    workflow_policy: {
      spark_required: 'no',
      worker_5_4_required: 'yes',
      controller_role: 'scope|architecture|review',
      controller_fallback: 'denied',
      delegation_threshold: 'workflow policy changes need controller scope and review with bounded implementation worker support',
    },
    product_behavior: {
      spark_required: 'no',
      worker_5_4_required: 'yes',
      controller_role: 'architecture|review',
      controller_fallback: 'denied',
      delegation_threshold: 'product behavior needs controller architecture ownership and bounded implementation slices',
    },
    merge_gate: {
      spark_required: 'yes',
      worker_5_4_required: 'no',
      controller_role: 'merge_gate',
      controller_fallback: 'denied',
      delegation_threshold: 'merge readiness decisions stay controller-owned while routine readback can be delegated',
    },
  };
  return defaults[taskClass];
}

function assessRoutingAlignment(
  routing: RoutingEvidence,
  evidence: PrBodyEvidence,
  phase: WorkflowPhase,
  expectedHeadSha?: string
): FallbackAssessment {
  const mismatch: string[] = [];
  if (routing.source_status && routing.source_status !== 'pass') mismatch.push('ready_routing_evidence_status');
  for (const field of routing.source_missing_fields ?? []) mismatch.push(`routing_evidence.${field}`);
  if (!evidence.hasRoutingStatus) mismatch.push('routing_evidence_status');
  if (isBlockedRoutingStatus(evidence.routingStatus)) mismatch.push('ready_routing_evidence_status');
  if (!evidence.hasRoutingRef) mismatch.push('routing_evidence_ref');
  if (routing.routing_evidence_ref !== 'n/a' && evidence.routingRef !== routing.routing_evidence_ref) mismatch.push('routing_evidence_ref_match');
  if (!evidence.hasDelegationLog) mismatch.push('delegation_execution_log');
  const workerUnavailable = resolveDelegationOutcome(evidence, routing) === 'unavailable';
  if (routing.spark_required === 'yes' && !workerUnavailable && !evidence.hasSparkEvidence && !isEvidenceRefValue(routing.spark_readback_evidence)) mismatch.push('spark_readback_evidence');
  if (routing.worker_5_4_required === 'yes' && !workerUnavailable && !evidence.hasWorker54Evidence && !isEvidenceRefValue(routing.worker_5_4_evidence)) mismatch.push('worker_5_4_evidence');
  if (routing.controller_fallback === 'denied' && evidence.claimsControllerOnly) mismatch.push('controller_fallback_denied');
  if (phase === 'merge' && expectedHeadSha && routing.head_sha && routing.head_sha !== expectedHeadSha) mismatch.push('routing_evidence_freshness');

  const fallback = assessFallback(routing, evidence);
  if (fallback.fallback_status === 'fail' || fallback.fallback_status === 'manual') mismatch.push('controller_fallback_reason');
  return {
    fallback_status: mismatch.length > 0 || fallback.fallback_status === 'fail' || fallback.fallback_status === 'manual' ? 'fail' : fallback.fallback_status,
    fallback_reason_quality: fallback.fallback_reason_quality,
    routing_mismatch: unique(mismatch),
  };
}

function assessFallback(routing: RoutingEvidence, evidence?: PrBodyEvidence): FallbackAssessment {
  const fallbackUsed = Boolean(
    evidence?.controllerFallback === 'allowed' ||
      evidence?.claimsControllerOnly ||
      evidence?.hasManualFallback
  );
  if (!fallbackUsed) {
    return noFallbackAssessment();
  }
  const reason = evidence?.controllerFallbackReason ?? routing.controller_fallback_reason;
  const quality = fallbackReasonQuality(reason);
  if (quality === 'strong') {
    return { fallback_status: 'pass', fallback_reason_quality: 'strong', routing_mismatch: [] };
  }
  return {
    fallback_status: quality === 'missing' ? 'manual' : 'fail',
    fallback_reason_quality: quality,
    routing_mismatch: ['controller_fallback_reason'],
  };
}

function isBlockedRoutingStatus(status: PrBodyEvidence['routingStatus']): boolean {
  return status === 'fail' || status === 'pending' || status === 'unknown';
}

function inferFallbackFromEvidence(evidence: PrBodyEvidence): FallbackAssessment | undefined {
  if (evidence.controllerFallback !== 'allowed' && !evidence.hasManualFallback) return undefined;
  return assessFallback(evidenceToFallbackRouting(evidence), evidence);
}

function resolveDelegationOutcome(evidence: PrBodyEvidence, routing: RoutingEvidence | null): DelegationOutcome {
  return evidence.delegationOutcome ?? routing?.delegation_outcome ?? 'n/a';
}

function delegationOutcomeWarnings(evidence: PrBodyEvidence, routing: RoutingEvidence | null): string[] {
  const hasAutonomousRoutingContext = evidence.hasAutonomousSignal || Boolean(routing && routing.routing_mode !== 'n/a');
  if (!hasAutonomousRoutingContext) return [];
  if (!evidence.hasDelegationOutcome && !routing?.delegation_outcome) {
    return ['Delegation outcome is missing; workflow-check kept backward-compatible status and reported delegation_outcome=n/a.'];
  }
  if (!evidence.delegationOutcome) {
    return [`Delegation outcome value is not recognized; expected ${DELEGATION_OUTCOMES.join('|')}.`];
  }
  return [];
}

function evidenceToFallbackRouting(evidence: PrBodyEvidence): RoutingEvidence {
  return {
    routing_mode: evidence.hasAutonomousSignal ? 'controller_fallback' : 'n/a',
    routing_task_class: 'n/a',
    spark_required: 'n/a',
    worker_5_4_required: 'n/a',
    controller_role: 'fallback_executor',
    controller_fallback: evidence.controllerFallback ?? (evidence.hasManualFallback ? 'allowed' : 'n/a'),
    controller_fallback_reason: evidence.controllerFallbackReason ?? 'n/a',
    delegation_threshold: 'manual checklist fallback evidence supplied in PR body',
    routing_evidence_ref: 'n/a',
  };
}

function fallbackReasonQuality(reason: string | null | undefined): FallbackAssessment['fallback_reason_quality'] {
  const normalized = String(reason ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'n/a') return 'missing';
  if (WEAK_FALLBACK_REASONS.has(normalized)) return 'weak';
  return normalized.length >= 12 ? 'strong' : 'weak';
}

function noRoutingEvidence(): RoutingEvidence {
  return {
    routing_mode: 'n/a',
    routing_task_class: 'n/a',
    spark_required: 'n/a',
    worker_5_4_required: 'n/a',
    controller_role: 'n/a',
    controller_fallback: 'n/a',
    controller_fallback_reason: 'n/a',
    delegation_threshold: 'n/a',
    routing_evidence_ref: 'n/a',
  };
}

function noFallbackAssessment(): FallbackAssessment {
  return {
    fallback_status: 'n/a',
    fallback_reason_quality: 'n/a',
    routing_mismatch: [],
  };
}

function parseAllowedDeniedField(body: string, fieldName: string): 'allowed' | 'denied' | null {
  const value = parseTextField(body, fieldName);
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith('allowed')) return 'allowed';
  if (normalized.startsWith('denied')) return 'denied';
  return null;
}

function parseDelegationOutcome(value: string | null): DelegationOutcome | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (DELEGATION_OUTCOMES.includes(normalized as DelegationOutcome)) return normalized as DelegationOutcome;
  return null;
}

function optionalDelegationOutcome(value: unknown, fieldName: string): DelegationOutcome | undefined {
  if (value === undefined) return undefined;
  return requiredEnum(value, [...DELEGATION_OUTCOMES], fieldName) as DelegationOutcome;
}

function parseTextField(body: string, fieldName: string): string | null {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escaped}\\s*[:=][^\\S\\n\\r]*([^\\n\\r]*)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function hasTextField(body: string, fieldName: string): boolean {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escaped}\\s*[:=]`, 'i').test(body);
}

function hasEvidenceRefValue(body: string, fieldName: string): boolean {
  return isEvidenceRefValue(parseTextField(body, fieldName));
}

function isEvidenceRefValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (WEAK_FALLBACK_REASONS.has(normalized)) return false;
  if (['missing', 'pending', 'unknown', 'fail', 'failed'].includes(normalized)) return false;
  return /^https?:\/\//i.test(value) || /^workflow-check:/i.test(value) || /#issuecomment-\d+/.test(value);
}

function requiredEnum(value: unknown, allowed: string[], fieldName: string): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${fieldName} must be one of ${allowed.join('|')}`);
  }
  return value;
}

function readStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
  return value;
}

function requiredEvidenceRef(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !isEvidenceRefValue(value)) {
    throw new Error(`${fieldName} must be a URL or workflow-check evidence ref`);
  }
  return value;
}

function parseRoutingStatus(value: string | null): PrBodyEvidence['routingStatus'] {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (GENERIC_STATUS_VALUES.includes(normalized as typeof GENERIC_STATUS_VALUES[number])) {
    return normalized as PrBodyEvidence['routingStatus'];
  }
  return 'unknown';
}

function parseGenericStatus(value: string | null): PrBodyEvidence['routingStatus'] {
  return parseRoutingStatus(value);
}

function parseReadyToMerge(body: string): 'yes' | 'no' | 'manual' | null {
  const value = parseTextField(body, 'ready_to_merge') ?? parseTextField(body, 'ready to merge');
  const normalized = normalize(value);
  if (['yes', 'no', 'manual'].includes(normalized)) return normalized as 'yes' | 'no' | 'manual';
  if (normalized === 'true') return 'yes';
  if (normalized === 'false') return 'no';
  return null;
}

function summarizeWorkflowStatus(statuses: WorkflowStatus[]): WorkflowStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('manual')) return 'manual';
  if (statuses.every((status) => status === 'skipped')) return 'skipped';
  return 'pass';
}

function meaningful(value: unknown): boolean {
  const normalized = normalize(value);
  return normalized !== '' && normalized !== 'n/a' && normalized !== 'none' && normalized !== 'missing' && normalized !== 'unknown';
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isFollowUpRef(value: string | null | undefined): boolean {
  if (!value) return false;
  if (isEvidenceRefValue(value)) return true;
  return /^#\d+$/.test(value.trim());
}

function resolvePrReadbackContext(pr: string, repoPath: string): { prRef: string; repo: string | null } {
  const match = pr.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (match) return { repo: match[1], prRef: match[2] };
  return { prRef: pr, repo: inferGitHubRepo(repoPath) };
}

function inferGitHubRepo(repoPath: string): string | null {
  const result = run(['git', 'remote', 'get-url', 'origin'], { cwd: repoPath });
  if (result.exitCode !== 0) return null;
  const value = result.stdout.trim();
  const httpsMatch = value.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/);
  if (httpsMatch) return httpsMatch[1];
  const sshMatch = value.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/);
  return sshMatch?.[1] ?? null;
}

function readGhJsonResult<T>(argv: string[]): { value?: T; error?: string } {
  const result = run(argv);
  if (result.exitCode !== 0) return { error: formatShellError(result) };
  try {
    return { value: JSON.parse(result.stdout) as T };
  } catch {
    return { error: 'Unexpected JSON output from gh.' };
  }
}

function readReviewThreads(prRef: string, repo: string): { value: Array<{ isResolved?: boolean }> | null; error?: string } {
  const [owner, name] = repo.split('/');
  const query = `query($owner:String!, $repo:String!, $number:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$number) {
        reviewThreads(first:100) { nodes { isResolved isOutdated } }
      }
    }
  }`;
  const result = run([
    'gh',
    'api',
    'graphql',
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${name}`,
    '-F',
    `number=${prRef}`,
    '-f',
    `query=${query}`,
  ]);
  if (result.exitCode !== 0) return { value: null, error: formatShellError(result) };
  try {
    const parsed = JSON.parse(result.stdout) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: Array<{ isResolved?: boolean }> } } } } };
    return { value: parsed.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [] };
  } catch {
    return { value: null, error: 'Unexpected JSON output from review thread readback.' };
  }
}

function manualCloseout(missingFields: string[], warnings: string[]): CloseoutReadback {
  return {
    status: 'manual',
    missingFields,
    warnings,
    checksStatus: 'manual',
    unresolvedReviewThreadsCount: null,
    coderabbitStatus: 'skipped',
    codexConnectorStatus: 'skipped',
    humanReviewStatus: 'manual',
    draftStatus: 'manual',
    sourceIssueEvidenceStatus: 'manual',
    specGateStatus: 'manual',
    routingEvidenceStatus: 'manual',
    findingDispositionStatus: 'manual',
    readyToMerge: 'manual',
  };
}

function summarizeChecksStatus(checks: Array<Record<string, unknown>>): WorkflowStatus {
  return summarizeChecks(checks).status;
}

function summarizeChecks(checks: Array<Record<string, unknown>>): { status: WorkflowStatus; warnings: string[] } {
  if (checks.length === 0) return { status: 'manual', warnings: ['checks_status manual fallback: no checks were returned.'] };
  const warnings: string[] = [];
  let hasManual = false;

  for (const check of checks) {
    const statusText = checkStatusText(check);
    if (/fail|failure|cancel|cancelled|timed_out|action_required|startup_failure/i.test(statusText)) {
      return { status: 'fail', warnings };
    }
    if (/pending|queued|in_progress|waiting|requested/i.test(statusText)) {
      hasManual = true;
      warnings.push(`checks_status manual fallback: ${checkName(check)} is not complete (${statusText || 'unknown status'}).`);
      continue;
    }
    if (!/\b(?:pass|passed|success|successful|skipped|skipping|neutral)\b/i.test(statusText)) {
      hasManual = true;
      warnings.push(`checks_status manual fallback: ${checkName(check)} did not include a recognized status field.`);
    }
  }

  return { status: hasManual ? 'manual' : 'pass', warnings };
}

function checkStatusText(check: Record<string, unknown>): string {
  return [
    check.bucket,
    check.conclusion,
    check.state,
    check.status,
  ].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');
}

function checkName(check: Record<string, unknown>): string {
  return String(check.name ?? check.context ?? 'unnamed check');
}

function summarizeNamedAutomationStatus(
  checks: Array<Record<string, unknown>>,
  pr: Record<string, unknown>,
  pattern: RegExp
): WorkflowStatus | 'skipped' {
  const matchingChecks = checks.filter((check) => pattern.test(String(check.name ?? check.context ?? '')));
  if (matchingChecks.length === 0) {
    const reviews = Array.isArray(pr.reviews) ? pr.reviews : [];
    return reviews.some((review) => pattern.test(String((review as { author?: { login?: string } }).author?.login ?? ''))) ? 'pass' : 'skipped';
  }
  return summarizeChecksStatus(matchingChecks);
}

function summarizeCodexConnectorStatus(pr: Record<string, unknown>): WorkflowStatus | 'skipped' {
  const reviews = Array.isArray(pr.reviews) ? pr.reviews : [];
  return reviews.some((review) => /chatgpt-codex-connector/i.test(String((review as { author?: { login?: string } }).author?.login ?? '')))
    ? 'pass'
    : 'skipped';
}

function summarizeHumanReviewStatus(pr: Record<string, unknown>): WorkflowStatus {
  const reviews = Array.isArray(pr.reviews) ? pr.reviews : [];
  const latestByAuthor = new Map<string, { state: string; submittedAt: string }>();
  for (const review of reviews) {
    const typedReview = review as { author?: { login?: string }; state?: string; submittedAt?: string };
    const login = String(typedReview.author?.login ?? '').toLowerCase();
    if (!login || isAutomationReviewLogin(login)) continue;
    const state = normalize(typedReview.state);
    if (!state) continue;
    const submittedAt = String(typedReview.submittedAt ?? '');
    const previous = latestByAuthor.get(login);
    if (!previous || submittedAt >= previous.submittedAt) {
      latestByAuthor.set(login, { state, submittedAt });
    }
  }
  return [...latestByAuthor.values()].some((review) => review.state === 'changes_requested')
    ? 'fail'
    : 'pass';
}

function isAutomationReviewLogin(login: string): boolean {
  return /(?:coderabbit|chatgpt-codex-connector|github-actions|dependabot)/i.test(login);
}

async function captureConsole(fn: () => Promise<void>): Promise<{ ok: true; warnings: string[] } | { ok: false; warnings: string[]; error: string }> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const warnings: string[] = [];

  console.log = () => undefined;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.join(' '));
  };
  console.error = (...args: unknown[]) => {
    warnings.push(args.join(' '));
  };

  try {
    await fn();
    return { ok: true, warnings };
  } catch (err) {
    return { ok: false, warnings, error: (err as Error).message };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

function normalizeGitPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function formatShellError(result: { stdout: string; stderr: string; exitCode: number }): string {
  const message = `${result.stderr}\n${result.stdout}`.trim();
  return message || `exit ${result.exitCode}`;
}
