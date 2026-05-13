import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../config/loader.js';
import { ensureRepoPath } from '../utils/fs.js';
import { run } from '../utils/shell.js';
import { plan } from './plan.js';
import type { Config } from '../config/types.js';

type WorkflowPhase = 'start' | 'commit' | 'merge';
type WorkflowStatus = 'pass' | 'fail' | 'manual' | 'skipped';
type OutputFormat = 'text' | 'json';

type WorkflowCheckOptions = {
  repo?: string;
  phase: string;
  format?: string;
  issue?: string;
  prBody?: string;
  headSha?: string;
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
};

type PrBodyEvidence = {
  hasSpecStatus: boolean;
  specStatus: 'pass' | 'fail' | 'manual' | 'skipped' | 'pending' | 'unknown' | null;
  hasSpecRef: boolean;
  hasManualFallback: boolean;
  hasFinalMergeGate: boolean;
  hasLatestHead: boolean;
  headMatches: boolean | null;
};

const PHASES = new Set<WorkflowPhase>(['start', 'commit', 'merge']);
const FORMATS = new Set<OutputFormat>(['text', 'json']);
const SPEC_STATUS_PATTERN = /\b(?:spec(?:[-_ ](?:gate|workflow|workflow-check|evidence))?|workflow-check|spec_evidence_status)\b[^\n\r]{0,120}\b(pass|fail|manual|skipped|pending|unknown)\b/i;
const SPEC_REF_PATTERN = /\b(?:spec[_ -]evidence[_ -]ref|spec[_ -]gate[_ -]ref|workflow-check[_ -]ref|spec gate evidence ref|spec gate evidence|workflow-check evidence)\b\s*[:=]?\s*\S+/i;
const MANUAL_FALLBACK_PATTERN = /\bmanual(?: checklist)? fallback\b|\bmanual spec gate\b|\bmanual workflow gate\b/i;
const FINAL_MERGE_GATE_PATTERN = /\bfinal merge gate\b|\bmerge gate\b/i;
const LATEST_HEAD_PATTERN = /\b(?:latest head|head sha|commit hash|head)\b[^\n\r]{0,80}\b[0-9a-f]{7,40}\b/i;

export async function workflowCheck(opts: WorkflowCheckOptions): Promise<void> {
  const phase = parsePhase(opts.phase);
  const format = parseFormat(opts.format ?? 'text');
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const checkedAt = new Date().toISOString();
  const warnings: string[] = [];
  let config: Config | null = null;

  try {
    ensureRepoPath(repoPath);
    config = await loadConfig(repoPath);
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

  const result = await runPhase(phase, repoPath, config, opts, checkedAt, warnings);
  printResult(result, format);
  if (result.status === 'fail') process.exit(1);
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
  config: Config,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[]
): Promise<WorkflowCheckResult> {
  if (phase === 'start') {
    return runStartPhase(repoPath, opts, checkedAt, warnings);
  }

  const staged = readStagedPaths(repoPath, config);
  warnings.push(...staged.warnings);
  const dirtyWarning = getDirtyUnstagedWarning(repoPath);
  if (dirtyWarning) warnings.push(dirtyWarning);

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
  if (!opts.issue) {
    return buildResult({
      phase: 'start',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: ['issue'],
      warnings: [...warnings, 'Start phase did not receive --issue; bounded context generation must be checked manually.'],
      evidenceSummary: 'start gate requires manual fallback because --issue was not provided',
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
    });
  }

  return buildResult({
    phase: 'start',
    repoPath,
    checkedAt,
    status: 'pass',
    missingFields: [],
    warnings: [...warnings, ...dryRun.warnings],
    evidenceSummary: 'start gate passed: bounded context generated with dry-run stdout-only plan check',
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

  const evidence = await parsePrBodyEvidence(opts.prBody, opts.headSha);
  if (evidence.hasManualFallback && !isBlockedSpecStatus(evidence.specStatus)) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields: [],
      warnings,
      evidenceSummary: 'commit gate recorded manual fallback evidence and staged state is clean',
    });
  }

  const missingFields = missingCommitFields(evidence);
  if (isBlockedSpecStatus(evidence.specStatus)) {
    missingFields.push('ready_spec_gate_status');
  }

  if (missingFields.length > 0) {
    return buildResult({
      phase: 'commit',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields,
      warnings,
      evidenceSummary: `commit gate missing ${missingFields.join(', ')}`,
    });
  }

  return buildResult({
    phase: 'commit',
    repoPath,
    checkedAt,
    status: 'pass',
    missingFields: [],
    warnings,
    evidenceSummary: 'commit gate passed: staged artifacts clean and PR body contains spec gate evidence',
  });
}

async function runMergePhase(
  repoPath: string,
  opts: WorkflowCheckOptions,
  checkedAt: string,
  warnings: string[],
  forbiddenStagedPaths: string[]
): Promise<WorkflowCheckResult> {
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

  const evidence = await parsePrBodyEvidence(opts.prBody, opts.headSha);
  const missingFields = missingMergeFields(evidence, Boolean(opts.headSha));
  if (isBlockedSpecStatus(evidence.specStatus)) {
    missingFields.push('ready_spec_gate_status');
  }
  if (evidence.headMatches === false) {
    missingFields.push('head_sha_freshness');
  }

  if (evidence.hasManualFallback && missingFields.length > 0 && !isBlockedSpecStatus(evidence.specStatus) && evidence.headMatches !== false) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'manual',
      missingFields,
      warnings,
      evidenceSummary: `merge gate requires manual fallback: missing ${missingFields.join(', ')}`,
    });
  }

  if (missingFields.length > 0) {
    return buildResult({
      phase: 'merge',
      repoPath,
      checkedAt,
      status: 'fail',
      missingFields,
      warnings,
      evidenceSummary: renderMergeFailureSummary(missingFields),
    });
  }

  return buildResult({
    phase: 'merge',
    repoPath,
    checkedAt,
    status: 'pass',
    missingFields: [],
    warnings,
    evidenceSummary: 'merge gate passed: final merge gate, spec evidence, and HEAD freshness are present',
  });
}

function readStagedPaths(repoPath: string, config: Config): { forbidden: string[]; warnings: string[] } {
  const result = run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { cwd: repoPath });
  if (result.exitCode !== 0) {
    return {
      forbidden: [],
      warnings: [`Could not inspect staged files with git diff --cached: ${formatShellError(result)}`],
    };
  }

  const stagedPaths = result.stdout.split('\0').filter(Boolean).map(normalizeGitPath);
  const forbidden = stagedPaths.filter((stagedPath) => isForbiddenArtifactPath(stagedPath, config));
  return { forbidden, warnings: [] };
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
  const statusMatch = body.match(SPEC_STATUS_PATTERN);
  const specStatus = statusMatch?.[1]?.toLowerCase() as PrBodyEvidence['specStatus'] | undefined;
  const hasLatestHead = Boolean(expectedHeadSha)
    ? body.includes(expectedHeadSha as string)
    : LATEST_HEAD_PATTERN.test(body);

  return {
    hasSpecStatus: Boolean(statusMatch),
    specStatus: specStatus ?? null,
    hasSpecRef: SPEC_REF_PATTERN.test(body),
    hasManualFallback: MANUAL_FALLBACK_PATTERN.test(body),
    hasFinalMergeGate: FINAL_MERGE_GATE_PATTERN.test(body),
    hasLatestHead,
    headMatches: expectedHeadSha ? body.includes(expectedHeadSha) : null,
  };
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
}): WorkflowCheckResult {
  return {
    phase: input.phase,
    status: input.status,
    repo: input.repoPath,
    head_sha: getHeadSha(input.repoPath),
    checked_at: input.checkedAt,
    missing_fields: unique(input.missingFields),
    warnings: unique(input.warnings),
    evidence_summary: input.evidenceSummary,
  };
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
