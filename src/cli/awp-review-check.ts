import fs from 'node:fs/promises';
import path from 'node:path';
import { isDurableEvidenceRef } from '../utils/evidence-ref.js';
import { ensureRepoPath } from '../utils/fs.js';
import { run } from '../utils/shell.js';

type WorkflowStatus = 'pass' | 'fail' | 'manual' | 'skipped';
type OutputFormat = 'text' | 'json';
type GateStatus = 'pass' | 'fail' | 'manual' | 'skipped';

type AwpReviewCheckOptions = {
  repo?: string;
  evidence: string;
  format?: string;
};

type Finding = {
  finding_id?: string;
  source?: string;
  head_sha?: string;
  category?: string;
  adoption_decision?: string;
  fix_strategy?: string;
  risk_if_local_patch?: string;
  validation_required?: string;
  finding_fingerprint?: string;
  is_outdated?: string;
  duplicate_of?: string;
  module?: string;
  concept_key?: string;
  root_cause_assessment?: string;
  state_model_required?: string;
  matrix_tests_required?: string;
  finding_count_for_concept?: number;
  disposition?: string;
  rationale?: string;
  validation?: string;
  evidence_ref?: string;
};

type PatchBudget = {
  base_changed_lines?: number;
  followup_changed_lines?: number;
  budget_ratio?: number;
  split_assessment?: string;
};

type Evidence = {
  autonomous_signal?: string;
  batch_id?: string;
  review_head_sha?: string;
  current_head_sha?: string;
  patch_budget?: PatchBudget;
  findings?: Finding[];
};

type GateAssessment = {
  status: GateStatus;
  missingFields: string[];
  warnings: string[];
};

type AwpReviewCheckResult = {
  status: WorkflowStatus;
  repo: string;
  head_sha: string;
  checked_at: string;
  missing_fields: string[];
  warnings: string[];
  evidence_summary: string;
  batch_id: string;
  autonomous_signal: 'present' | 'absent';
  review_head_sha: string;
  current_head_sha: string;
  head_freshness: 'fresh' | 'stale' | 'missing' | 'n/a';
  actionable_findings: number;
  duplicate_findings: number;
  manual_findings: number;
  review_batch_status: GateStatus;
  root_cause_status: GateStatus;
  patch_budget_status: GateStatus;
  closeout_ledger_status: GateStatus;
  evidence_ref: string;
};

const FORMATS = new Set<OutputFormat>(['text', 'json']);
const AUTONOMOUS_SIGNALS = new Set(['yes', 'awp', 'hybrid_awp', 'codex_autonomous', 'autonomous_worker_routing', 'present', 'true']);
const PASSIVE_SIGNALS = new Set(['no', 'none', 'n/a', 'absent', 'false', '']);
const ACTIVE_CATEGORIES = new Set(['correctness', 'normalization_gap', 'docs_contract', 'test_gap']);
const LEDGER_RATIONALE_DISPOSITIONS = new Set(['partial', 'rejected', 'deferred', 'superseded']);
const VALID_SOURCES = new Set(['coderabbit', 'codex', 'human', 'ci']);
const VALID_DECISIONS = new Set(['adopt', 'partial', 'reject', 'defer']);
const VALID_STRATEGIES = new Set(['local_patch', 'normalize_state_model', 'docs_only', 'test_only', 'no_change', 'split_followup']);
const VALID_DISPOSITIONS = new Set(['adopted', 'partial', 'rejected', 'deferred', 'superseded']);
const PATCH_BUDGET_RATIO = 0.3;

export async function awpReviewCheck(opts: AwpReviewCheckOptions): Promise<void> {
  const format = parseFormat(opts.format ?? 'text');
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const checkedAt = new Date().toISOString();
  let evidence: Evidence;

  try {
    ensureRepoPath(repoPath);
  } catch (err) {
    const result = buildResult({
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['repo'],
      warnings: [(err as Error).message],
      evidenceSummary: 'AWP review check failed: repo path could not be validated',
      evidenceRef: opts.evidence,
    });
    printResult(result, format);
    process.exit(1);
  }

  try {
    evidence = JSON.parse(await fs.readFile(path.resolve(opts.evidence), 'utf8')) as Evidence;
  } catch (err) {
    const result = buildResult({
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields: ['evidence'],
      warnings: [`Could not read AWP review evidence: ${(err as Error).message}`],
      evidenceSummary: 'AWP review check failed: local evidence JSON could not be read',
      evidenceRef: opts.evidence,
    });
    printResult(result, format);
    process.exit(1);
  }

  const result = assessEvidence(repoPath, checkedAt, evidence, path.resolve(opts.evidence));
  printResult(result, format);
  if (result.status === 'fail') process.exit(1);
}

function parseFormat(value: string): OutputFormat {
  if (FORMATS.has(value as OutputFormat)) return value as OutputFormat;
  throw new Error(`Unsupported awp-review-check format: ${value}. Expected text|json.`);
}

function assessEvidence(repoPath: string, checkedAt: string, evidence: Evidence, evidenceRef: string): AwpReviewCheckResult {
  const signal = normalize(evidence.autonomous_signal);
  if (!isAutonomousSignal(signal)) {
    return buildResult({
      repoPath,
      checkedAt,
      status: 'skipped',
      missingFields: [],
      warnings: PASSIVE_SIGNALS.has(signal) ? [] : [`Unrecognized autonomous_signal '${evidence.autonomous_signal ?? ''}'; treating as absent.`],
      evidenceSummary: 'AWP review check skipped: ordinary workflows do not require review triage records',
      evidenceRef,
      evidence,
      reviewBatch: skippedGate(),
      rootCause: skippedGate(),
      patchBudget: skippedGate(),
      closeoutLedger: skippedGate(),
    });
  }

  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  const repoHead = getHeadSha(repoPath);
  const reviewBatch = assessReviewBatch(evidence, findings, repoHead);
  const rootCause = assessRootCause(findings);
  const patchBudget = assessPatchBudget(evidence.patch_budget);
  const closeoutLedger = assessCloseoutLedger(findings);
  const gates = [reviewBatch, rootCause, patchBudget, closeoutLedger];
  const missingFields = unique(gates.flatMap((gate) => gate.missingFields));
  const warnings = unique(gates.flatMap((gate) => gate.warnings));
  const status = summarizeStatus(gates);

  return buildResult({
    repoPath,
    checkedAt,
    status,
    missingFields,
    warnings,
    evidenceSummary: summarizeEvidence(status, reviewBatch, rootCause, patchBudget, closeoutLedger),
    evidenceRef,
    evidence,
    reviewBatch,
    rootCause,
    patchBudget,
    closeoutLedger,
  });
}

function assessReviewBatch(evidence: Evidence, findings: Finding[], repoHead: string): GateAssessment {
  const missing: string[] = [];
  const warnings: string[] = [];
  const reviewHead = normalizeRef(evidence.review_head_sha);
  const currentHead = normalizeRef(evidence.current_head_sha);
  if (!reviewHead) missing.push('review_head_sha');
  if (!currentHead) missing.push('current_head_sha');

  for (const finding of findings) {
    for (const field of [
      'finding_id',
      'source',
      'head_sha',
      'category',
      'adoption_decision',
      'fix_strategy',
      'risk_if_local_patch',
      'validation_required',
      'finding_fingerprint',
      'is_outdated',
      'duplicate_of',
      'finding_count_for_concept',
    ] as const) {
      if (!provided(finding[field])) missing.push(field);
    }
    if (meaningful(finding.source) && !VALID_SOURCES.has(normalize(finding.source))) warnings.push(`Unknown finding source: ${finding.source}`);
    if (meaningful(finding.category) && !ACTIVE_CATEGORIES.has(normalize(finding.category)) && !['nit', 'noise'].includes(normalize(finding.category))) missing.push('category');
    if (meaningful(finding.adoption_decision) && !VALID_DECISIONS.has(normalize(finding.adoption_decision))) missing.push('adoption_decision');
    if (meaningful(finding.fix_strategy) && !VALID_STRATEGIES.has(normalize(finding.fix_strategy))) missing.push('fix_strategy');
    if (reviewHead && meaningful(finding.head_sha) && normalizeRef(finding.head_sha) !== reviewHead) missing.push('finding_head_sha');
  }

  if (missing.length > 0) return { status: 'manual', missingFields: unique(missing), warnings };
  if (repoHead === 'n/a') return { status: 'fail', missingFields: ['repo_head_sha'], warnings };
  if (repoHead !== 'n/a' && currentHead !== repoHead) return { status: 'fail', missingFields: ['current_head_sha_freshness'], warnings };
  if (reviewHead !== currentHead) return { status: 'fail', missingFields: ['review_head_freshness'], warnings };
  return { status: 'pass', missingFields: [], warnings };
}

function assessRootCause(findings: Finding[]): GateAssessment {
  const missing: string[] = [];
  const activeByConcept = new Map<string, Finding[]>();
  for (const finding of findings) {
    if (!participatesInRootCauseGate(finding)) continue;
    const concept = normalizeRef(finding.concept_key);
    if (!concept) {
      missing.push('concept_key');
      continue;
    }
    activeByConcept.set(concept, [...(activeByConcept.get(concept) ?? []), finding]);
  }

  for (const conceptFindings of activeByConcept.values()) {
    const count = Math.max(conceptFindings.length, ...conceptFindings.map((finding) => numericFindingCount(finding)));
    if (count < 2) continue;
    const hasRootCause = conceptFindings.some((finding) => meaningful(finding.root_cause_assessment));
    const hasStateModel = conceptFindings.some((finding) =>
      normalize(finding.state_model_required) === 'yes' ||
      normalize(finding.fix_strategy) === 'normalize_state_model'
    );
    const hasMatrixTests = conceptFindings.some((finding) => normalize(finding.matrix_tests_required) === 'yes');
    if (!hasRootCause) missing.push('root_cause_assessment');
    if (!hasStateModel) missing.push('state_model_required');
    if (!hasMatrixTests) missing.push('matrix_tests_required');
  }

  return missing.length > 0
    ? { status: 'fail', missingFields: unique(missing), warnings: [] }
    : { status: 'pass', missingFields: [], warnings: [] };
}

function assessPatchBudget(patchBudget: PatchBudget | undefined): GateAssessment {
  if (!patchBudget) {
    return {
      status: 'manual',
      missingFields: ['patch_budget'],
      warnings: ['Patch budget evidence is missing; review follow-up size must be checked manually.'],
    };
  }

  const missing: string[] = [];
  if (typeof patchBudget.base_changed_lines !== 'number') missing.push('base_changed_lines');
  if (typeof patchBudget.followup_changed_lines !== 'number') missing.push('followup_changed_lines');
  const ratio = typeof patchBudget.budget_ratio === 'number'
    ? patchBudget.budget_ratio
    : inferBudgetRatio(patchBudget.base_changed_lines, patchBudget.followup_changed_lines);
  if (ratio === null) missing.push('budget_ratio');
  if (missing.length > 0) return { status: 'manual', missingFields: unique(missing), warnings: [] };
  if (ratio === null) return { status: 'manual', missingFields: ['budget_ratio'], warnings: [] };
  if (ratio > PATCH_BUDGET_RATIO && !meaningful(patchBudget.split_assessment)) {
    return { status: 'fail', missingFields: ['split_assessment'], warnings: [] };
  }
  return { status: 'pass', missingFields: [], warnings: [] };
}

function assessCloseoutLedger(findings: Finding[]): GateAssessment {
  const missing: string[] = [];
  for (const finding of findings) {
    if (isDuplicate(finding) && normalize(finding.disposition) === 'superseded') {
      if (!meaningful(finding.rationale)) missing.push('ledger_rationale');
      continue;
    }
    if (isActionableFinding(finding) && !VALID_DISPOSITIONS.has(normalize(finding.disposition))) {
      missing.push('ledger_disposition');
      continue;
    }
    if (LEDGER_RATIONALE_DISPOSITIONS.has(normalize(finding.disposition)) && !meaningful(finding.rationale)) {
      missing.push('ledger_rationale');
    }
    if (isActionableFinding(finding) && !isDurableEvidenceRef(finding.evidence_ref)) missing.push('ledger_evidence_ref');
    if (isActionableFinding(finding) && !meaningful(finding.validation)) missing.push('ledger_validation');
  }
  return missing.length > 0
    ? { status: 'fail', missingFields: unique(missing), warnings: [] }
    : { status: 'pass', missingFields: [], warnings: [] };
}

function buildResult(input: {
  repoPath: string;
  checkedAt: string;
  status: WorkflowStatus;
  missingFields: string[];
  warnings: string[];
  evidenceSummary: string;
  evidenceRef: string;
  evidence?: Evidence;
  reviewBatch?: GateAssessment;
  rootCause?: GateAssessment;
  patchBudget?: GateAssessment;
  closeoutLedger?: GateAssessment;
}): AwpReviewCheckResult {
  const evidence = input.evidence ?? {};
  const findings = Array.isArray(evidence.findings) ? evidence.findings : [];
  const localHead = getHeadSha(input.repoPath);
  return {
    status: input.status,
    repo: input.repoPath,
    head_sha: localHead,
    checked_at: input.checkedAt,
    missing_fields: unique(input.missingFields),
    warnings: unique(input.warnings),
    evidence_summary: input.evidenceSummary,
    batch_id: meaningful(evidence.batch_id) ? String(evidence.batch_id) : 'n/a',
    autonomous_signal: isAutonomousSignal(normalize(evidence.autonomous_signal)) ? 'present' : 'absent',
    review_head_sha: normalizeRef(evidence.review_head_sha) ?? 'n/a',
    current_head_sha: normalizeRef(evidence.current_head_sha) ?? 'n/a',
    head_freshness: headFreshness(evidence, localHead),
    actionable_findings: findings.filter((finding) => !isDuplicate(finding) && isActionableFinding(finding)).length,
    duplicate_findings: findings.filter(isDuplicate).length,
    manual_findings: input.missingFields.length > 0 && input.status === 'manual' ? findings.length : 0,
    review_batch_status: input.reviewBatch?.status ?? 'skipped',
    root_cause_status: input.rootCause?.status ?? 'skipped',
    patch_budget_status: input.patchBudget?.status ?? 'skipped',
    closeout_ledger_status: input.closeoutLedger?.status ?? 'skipped',
    evidence_ref: input.evidenceRef,
  };
}

function printResult(result: AwpReviewCheckResult, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) {
      console.log(`${key}=${value.length > 0 ? value.join(',') : 'none'}`);
    } else {
      console.log(`${key}=${value}`);
    }
  }
}

function summarizeStatus(gates: GateAssessment[]): WorkflowStatus {
  if (gates.some((gate) => gate.status === 'fail')) return 'fail';
  if (gates.some((gate) => gate.status === 'manual')) return 'manual';
  if (gates.every((gate) => gate.status === 'skipped')) return 'skipped';
  return 'pass';
}

function summarizeEvidence(
  status: WorkflowStatus,
  reviewBatch: GateAssessment,
  rootCause: GateAssessment,
  patchBudget: GateAssessment,
  closeoutLedger: GateAssessment
): string {
  if (status === 'pass') return 'AWP review gate passed: fresh batch, duplicates collapsed, root-cause gate satisfied, closeout ledger complete';
  if (status === 'skipped') return 'AWP review gate skipped: no autonomous routing signal';
  return [
    `AWP review gate ${status}`,
    `review_batch=${reviewBatch.status}`,
    `root_cause=${rootCause.status}`,
    `patch_budget=${patchBudget.status}`,
    `closeout_ledger=${closeoutLedger.status}`,
  ].join('; ');
}

function skippedGate(): GateAssessment {
  return { status: 'skipped', missingFields: [], warnings: [] };
}

function headFreshness(evidence: Evidence, repoHead: string): AwpReviewCheckResult['head_freshness'] {
  const signal = normalize(evidence.autonomous_signal);
  if (!isAutonomousSignal(signal)) return 'n/a';
  const reviewHead = normalizeRef(evidence.review_head_sha);
  const currentHead = normalizeRef(evidence.current_head_sha);
  if (!reviewHead || !currentHead) return 'missing';
  if (repoHead === 'n/a') return 'missing';
  if (repoHead !== 'n/a' && currentHead !== repoHead) return 'stale';
  return reviewHead === currentHead ? 'fresh' : 'stale';
}

function inferBudgetRatio(base: number | undefined, followup: number | undefined): number | null {
  if (typeof base !== 'number' || typeof followup !== 'number' || base <= 0) return null;
  return followup / base;
}

function numericFindingCount(finding: Finding): number {
  return typeof finding.finding_count_for_concept === 'number' ? finding.finding_count_for_concept : 1;
}

function isAutonomousSignal(value: string): boolean {
  return AUTONOMOUS_SIGNALS.has(value);
}

function isActiveFinding(finding: Finding): boolean {
  return ACTIVE_CATEGORIES.has(normalize(finding.category));
}

function isActionableFinding(finding: Finding): boolean {
  if (isDuplicate(finding)) return false;
  if (normalize(finding.is_outdated) === 'yes') return false;
  if (normalize(finding.adoption_decision) === 'reject' && normalize(finding.category) === 'noise') return true;
  return isActiveFinding(finding) && normalize(finding.adoption_decision) !== 'defer';
}

function participatesInRootCauseGate(finding: Finding): boolean {
  if (isDuplicate(finding)) return false;
  if (normalize(finding.is_outdated) === 'yes') return false;
  if (normalize(finding.adoption_decision) === 'defer') return false;
  return isActiveFinding(finding);
}

function isDuplicate(finding: Finding): boolean {
  return meaningful(finding.duplicate_of);
}

function meaningful(value: unknown): boolean {
  const normalized = normalize(value);
  return normalized !== '' && normalized !== 'n/a' && normalized !== 'none' && normalized !== 'missing' && normalized !== 'unknown';
}

function provided(value: unknown): boolean {
  return String(value ?? '').trim() !== '';
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeRef(value: unknown): string | null {
  return meaningful(value) ? String(value).trim() : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getHeadSha(repoPath: string): string {
  const result = run(['git', 'rev-parse', 'HEAD'], { cwd: repoPath });
  if (result.exitCode !== 0) return 'n/a';
  return result.stdout.trim() || 'n/a';
}
