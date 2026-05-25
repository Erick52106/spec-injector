import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../utils/shell.js';

type DoctorOptions = {
  workflow?: string;
  format?: string;
};

type DoctorStatus = 'pass' | 'fail' | 'manual' | 'skipped';
type OutputFormat = 'text' | 'json';

type Capability = {
  id: string;
  status: DoctorStatus;
  required: boolean;
  evidence: string;
};

type DoctorResult = {
  workflow: string;
  status: DoctorStatus;
  checked_at: string;
  executable: string;
  version: string;
  commit: string;
  missing_capabilities: string[];
  warnings: string[];
  capabilities: Capability[];
  evidence_summary: string;
};

const SUPPORTED_WORKFLOWS = new Set(['awp']);
const SUPPORTED_FORMATS = new Set(['text', 'json']);

export async function doctor(opts: DoctorOptions): Promise<void> {
  const workflow = parseWorkflow(opts.workflow ?? 'awp');
  const format = parseFormat(opts.format ?? 'text');
  const result = await runDoctor(workflow);
  printDoctorResult(result, format);
  if (result.status === 'fail') process.exit(1);
}

async function runDoctor(workflow: string): Promise<DoctorResult> {
  const checkedAt = new Date().toISOString();
  const executable = doctorExecutableLabel();
  const [version, commit] = await Promise.all([readPackageVersion(), readCommit()]);
  const rootHelp = runSpecHelp(['--help']);
  const workflowHelp = runSpecHelp(['workflow-check', '--help']);
  const preflightHelp = runSpecHelp(['preflight', '--help']);
  const awpReviewHelp = runSpecHelp(['awp-review-check', '--help']);
  const [preflightTargetArtifactGate, awpReviewDurableRefs] = await Promise.all([
    checkPreflightTargetArtifactGate(preflightHelp),
    checkAwpReviewDurableEvidenceRefs(),
  ]);
  const [adoptionContract, bootstrapContract] = await Promise.all([
    readDocContract('docs/target-repo-adoption-contract.md', [/status\/ref/i, /Scope Police/i, /does not mutate downstream repos/i]),
    readDocContract('docs/ai-bootstrap-install-contract.md', [/SPEC_INJECTOR_DIR/i, /spec doctor --workflow awp --format json/i, /durable review evidence refs/i, /does not call GitHub/i]),
  ]);

  const workflowOutput = `${workflowHelp.stdout}\n${workflowHelp.stderr}`;
  const capabilities: Capability[] = [
    {
      id: 'workflow_check_command',
      status: rootHelp.exitCode === 0 && /\bworkflow-check\b/.test(rootHelp.stdout) && workflowHelp.exitCode === 0 ? 'pass' : 'fail',
      required: true,
      evidence: 'spec --help; spec workflow-check --help',
    },
    {
      id: 'workflow_check_phase_start_commit_merge',
      status: hasWords(workflowOutput, ['start', 'commit', 'merge']) ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes start|commit|merge',
    },
    {
      id: 'workflow_check_external_config',
      status: hasLongOptionWithValue(workflowOutput, 'config', 'path') ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --config <path>',
    },
    {
      id: 'workflow_check_finding_disposition',
      status: /--finding-disposition\b/.test(workflowOutput) ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --finding-disposition',
    },
    {
      id: 'workflow_check_threshold_evidence',
      status: /--threshold-evidence\b/.test(workflowOutput) ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --threshold-evidence',
    },
    {
      id: 'workflow_check_readback_evidence',
      status: /--readback-evidence\b/.test(workflowOutput) ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --readback-evidence',
    },
    {
      id: 'workflow_check_pr_readback',
      status: hasLongOption(workflowOutput, 'pr') ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --pr',
    },
    preflightTargetArtifactGate,
    {
      id: 'target_repo_adoption_contract_doc',
      status: adoptionContract ? 'pass' : 'fail',
      required: true,
      evidence: 'docs/target-repo-adoption-contract.md documents status/ref thin wiring and no mutation',
    },
    {
      id: 'ai_bootstrap_install_contract_doc',
      status: bootstrapContract ? 'pass' : 'fail',
      required: true,
      evidence: 'docs/ai-bootstrap-install-contract.md documents SPEC_INJECTOR_DIR fallback and local-only doctor',
    },
    {
      id: 'awp_review_check_command',
      status: awpReviewHelp.exitCode === 0 ? 'pass' : 'skipped',
      required: false,
      evidence: 'spec awp-review-check --help',
    },
    awpReviewDurableRefs,
  ];

  const missingCapabilities = capabilities
    .filter((capability) => capability.required && capability.status !== 'pass')
    .map((capability) => capability.id);
  const warnings = capabilities
    .filter((capability) => !capability.required && capability.status !== 'pass')
    .map((capability) => `${capability.id} unavailable; AWP review ledger checks may need manual fallback.`);
  const status: DoctorStatus = missingCapabilities.length > 0 ? 'fail' : 'pass';

  return {
    workflow,
    status,
    checked_at: checkedAt,
    executable,
    version,
    commit,
    missing_capabilities: missingCapabilities,
    warnings,
    capabilities,
    evidence_summary: status === 'pass'
      ? 'AWP workflow capabilities available; doctor is local-only and does not call GitHub or mutate target repos'
      : `AWP workflow capabilities missing: ${missingCapabilities.join(', ')}`,
  };
}

async function checkPreflightTargetArtifactGate(preflightHelp: { stdout: string; stderr: string; exitCode: number }): Promise<Capability> {
  const id = 'preflight_target_artifact_gate';
  const evidence = 'local target artifact smoke uses spec preflight --target-repo with staged .spec-injector/out task package';
  const helpOutput = `${preflightHelp.stdout}\n${preflightHelp.stderr}`;
  if (preflightHelp.exitCode !== 0 || !hasLongOptionWithValue(helpOutput, 'target-repo', 'path')) {
    return {
      id,
      status: 'fail',
      required: true,
      evidence: `preflight --help does not expose target artifact gate: ${formatCommandResult(preflightHelp)}`,
    };
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-doctor-preflight-'));
  try {
    const mainRepo = path.join(tempRoot, 'source-main');
    const worktree = path.join(tempRoot, 'source-worktree');
    const targetRepo = path.join(tempRoot, 'target-repo');
    await Promise.all([
      fs.mkdir(mainRepo, { recursive: true }),
      fs.mkdir(targetRepo, { recursive: true }),
    ]);

    await fs.writeFile(path.join(mainRepo, 'README.md'), '# Doctor preflight source fixture\n', 'utf8');
    const mainInit = run(['git', 'init', '--initial-branch=main'], { cwd: mainRepo });
    if (mainInit.exitCode !== 0) return failCapability(id, evidence, mainInit);
    run(['git', 'config', 'user.email', 'spec-injector@example.test'], { cwd: mainRepo });
    run(['git', 'config', 'user.name', 'Spec Injector Doctor'], { cwd: mainRepo });
    const mainAdd = run(['git', 'add', 'README.md'], { cwd: mainRepo });
    if (mainAdd.exitCode !== 0) return failCapability(id, evidence, mainAdd);
    const mainCommit = run(['git', 'commit', '-m', 'doctor preflight source fixture'], { cwd: mainRepo });
    if (mainCommit.exitCode !== 0) return failCapability(id, evidence, mainCommit);
    const worktreeAdd = run(['git', 'worktree', 'add', '-b', 'doctor-preflight-smoke', worktree, 'main'], { cwd: mainRepo });
    if (worktreeAdd.exitCode !== 0) return failCapability(id, evidence, worktreeAdd);

    await fs.writeFile(path.join(targetRepo, 'README.md'), '# Doctor target fixture\n', 'utf8');
    const targetInit = run(['git', 'init', '--initial-branch=main'], { cwd: targetRepo });
    if (targetInit.exitCode !== 0) return failCapability(id, evidence, targetInit);
    run(['git', 'config', 'user.email', 'spec-injector@example.test'], { cwd: targetRepo });
    run(['git', 'config', 'user.name', 'Spec Injector Doctor'], { cwd: targetRepo });
    const targetAdd = run(['git', 'add', 'README.md'], { cwd: targetRepo });
    if (targetAdd.exitCode !== 0) return failCapability(id, evidence, targetAdd);
    const targetCommit = run(['git', 'commit', '-m', 'doctor target fixture'], { cwd: targetRepo });
    if (targetCommit.exitCode !== 0) return failCapability(id, evidence, targetCommit);

    const stagedArtifact = path.join(targetRepo, '.spec-injector', 'out', 'issue-350-task-package.md');
    await fs.mkdir(path.dirname(stagedArtifact), { recursive: true });
    await fs.writeFile(stagedArtifact, '# generated task package\n', 'utf8');
    const artifactAdd = run(['git', 'add', '.spec-injector/out/issue-350-task-package.md'], { cwd: targetRepo });
    if (artifactAdd.exitCode !== 0) return failCapability(id, evidence, artifactAdd);

    const result = run([
      ...doctorExecutableCommand(),
      'preflight',
      '--repo',
      worktree,
      '--target-repo',
      targetRepo,
      '--format',
      'json',
    ]);
    const output = `${result.stdout}\n${result.stderr}`;
    const rejectedTargetArtifact = result.exitCode !== 0 &&
      /target repo has staged spec artifacts/i.test(output) &&
      /\.spec-injector\/out\/issue-350-task-package\.md/i.test(output);

    return {
      id,
      status: rejectedTargetArtifact ? 'pass' : 'fail',
      required: true,
      evidence: rejectedTargetArtifact
        ? 'local target artifact smoke rejected staged .spec-injector/out task package'
        : `target artifact smoke was accepted or failed without target artifact evidence: ${formatCommandResult(result)}`,
    };
  } catch (err) {
    return {
      id,
      status: 'fail',
      required: true,
      evidence: `target artifact smoke could not run: ${(err as Error).message}`,
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function parseWorkflow(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (SUPPORTED_WORKFLOWS.has(normalized)) return normalized;
  throw new Error(`Unsupported doctor workflow: ${value}. Expected awp.`);
}

function parseFormat(value: string): OutputFormat {
  const normalized = value.trim().toLowerCase();
  if (SUPPORTED_FORMATS.has(normalized)) return normalized as OutputFormat;
  throw new Error(`Unsupported doctor format: ${value}. Expected text|json.`);
}

function runSpecHelp(args: string[]) {
  return run([...doctorExecutableCommand(), ...args]);
}

async function checkAwpReviewDurableEvidenceRefs(): Promise<Capability> {
  const evidence = 'local weak evidence_ref smoke uses spec awp-review-check with evidence_ref=done';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-doctor-awp-review-'));
  try {
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Doctor AWP review fixture\n', 'utf8');
    const init = run(['git', 'init', '--initial-branch=main'], { cwd: tempDir });
    if (init.exitCode !== 0) return failCapability('awp_review_durable_evidence_refs', evidence, init);
    run(['git', 'config', 'user.email', 'spec-injector@example.test'], { cwd: tempDir });
    run(['git', 'config', 'user.name', 'Spec Injector Doctor'], { cwd: tempDir });
    const add = run(['git', 'add', 'README.md'], { cwd: tempDir });
    if (add.exitCode !== 0) return failCapability('awp_review_durable_evidence_refs', evidence, add);
    const commit = run(['git', 'commit', '-m', 'doctor fixture'], { cwd: tempDir });
    if (commit.exitCode !== 0) return failCapability('awp_review_durable_evidence_refs', evidence, commit);
    const head = run(['git', 'rev-parse', 'HEAD'], { cwd: tempDir });
    if (head.exitCode !== 0) return failCapability('awp_review_durable_evidence_refs', evidence, head);

    const headSha = head.stdout.trim();
    const evidencePath = path.join(tempDir, 'awp-review-weak-ref.json');
    await fs.writeFile(evidencePath, `${JSON.stringify(buildWeakEvidenceRefFixture(headSha), null, 2)}\n`, 'utf8');
    const result = run([
      ...doctorExecutableCommand(),
      'awp-review-check',
      '--repo',
      tempDir,
      '--evidence',
      evidencePath,
      '--format',
      'json',
    ]);
    const output = `${result.stdout}\n${result.stderr}`;
    const rejectedWeakRef = result.exitCode !== 0 && /ledger_evidence_ref/i.test(output);

    return {
      id: 'awp_review_durable_evidence_refs',
      status: rejectedWeakRef ? 'pass' : 'fail',
      required: true,
      evidence: rejectedWeakRef
        ? 'local weak evidence_ref smoke rejected with ledger_evidence_ref'
        : `weak evidence_ref smoke was accepted or failed without ledger_evidence_ref: ${formatCommandResult(result)}`,
    };
  } catch (err) {
    return {
      id: 'awp_review_durable_evidence_refs',
      status: 'fail',
      required: true,
      evidence: `weak evidence_ref smoke could not run: ${(err as Error).message}`,
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function buildWeakEvidenceRefFixture(headSha: string) {
  return {
    autonomous_signal: 'yes',
    batch_id: 'doctor-weak-evidence-ref',
    review_head_sha: headSha,
    current_head_sha: headSha,
    patch_budget: {
      base_changed_lines: 100,
      followup_changed_lines: 10,
      budget_ratio: 0.1,
      split_assessment: 'n/a',
    },
    findings: [
      {
        finding_id: 'doctor-weak-ref',
        source: 'coderabbit',
        head_sha: headSha,
        category: 'normalization_gap',
        adoption_decision: 'adopt',
        fix_strategy: 'test_only',
        risk_if_local_patch: 'low',
        validation_required: 'pnpm test',
        finding_fingerprint: 'doctor-weak-ref',
        is_outdated: 'no',
        duplicate_of: 'n/a',
        concept_key: 'doctor-weak-ref',
        finding_count_for_concept: 1,
        root_cause_assessment: 'n/a',
        state_model_required: 'no',
        matrix_tests_required: 'no',
        disposition: 'adopted',
        rationale: 'n/a',
        validation: 'pnpm test',
        evidence_ref: 'done',
      },
    ],
  };
}

function failCapability(id: string, evidence: string, result: { stdout: string; stderr: string; exitCode: number }): Capability {
  return {
    id,
    status: 'fail',
    required: true,
    evidence: `${evidence}: ${formatCommandResult(result)}`,
  };
}

function formatCommandResult(result: { stdout: string; stderr: string; exitCode: number }): string {
  const message = `${result.stderr}\n${result.stdout}`.trim();
  return message ? `exit ${result.exitCode}: ${message}` : `exit ${result.exitCode}`;
}

function hasLongOption(output: string, optionName: string): boolean {
  const escaped = optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|,|$)`, 'm').test(output);
}

function hasLongOptionWithValue(output: string, optionName: string, valueName: string): boolean {
  const escapedOption = optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedValue = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escapedOption}\\s+<${escapedValue}>(?:\\s|,|$)`, 'm').test(output);
}

function hasWords(output: string, words: string[]): boolean {
  return words.every((word) => new RegExp(`\\b${word}\\b`, 'i').test(output));
}

function doctorExecutableCommand(): string[] {
  if (process.env.SPEC_DOCTOR_SPEC_BIN) return [process.env.SPEC_DOCTOR_SPEC_BIN];
  return [process.execPath, process.argv[1]];
}

function doctorExecutableLabel(): string {
  return process.env.SPEC_DOCTOR_SPEC_BIN ?? `${process.execPath} ${process.argv[1]}`;
}

async function readPackageVersion(): Promise<string> {
  try {
    const packagePath = path.join(packageRoot(), 'package.json');
    const parsed = JSON.parse(await fs.readFile(packagePath, 'utf8')) as { version?: string };
    return parsed.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function readDocContract(docPath: string, requiredPatterns: RegExp[]): Promise<boolean> {
  try {
    const content = await fs.readFile(path.join(packageRoot(), docPath), 'utf8');
    return requiredPatterns.every((pattern) => pattern.test(content));
  } catch {
    return false;
  }
}

async function readCommit(): Promise<string> {
  if (process.env.SPEC_INJECTOR_COMMIT) return process.env.SPEC_INJECTOR_COMMIT;
  const root = packageRoot();
  const topLevel = run(['git', 'rev-parse', '--show-toplevel'], { cwd: root });
  if (topLevel.exitCode !== 0) return 'unknown';

  const [realRoot, realTopLevel] = await Promise.all([
    realPathOrResolved(root),
    realPathOrResolved(topLevel.stdout.trim()),
  ]);
  if (realRoot !== realTopLevel) return 'unknown';

  const result = run(['git', 'rev-parse', '--short', 'HEAD'], { cwd: root });
  return result.exitCode === 0 ? result.stdout.trim() : 'unknown';
}

async function realPathOrResolved(value: string): Promise<string> {
  try {
    return await fs.realpath(value);
  } catch {
    return path.resolve(value);
  }
}

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function printDoctorResult(result: DoctorResult, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`workflow=${result.workflow}`);
  console.log(`status=${result.status}`);
  console.log(`executable=${result.executable}`);
  console.log(`version=${result.version}`);
  console.log(`commit=${result.commit}`);
  console.log(`missing_capabilities=${result.missing_capabilities.length > 0 ? result.missing_capabilities.join(',') : 'none'}`);
  console.log(`warnings=${result.warnings.length > 0 ? result.warnings.join(' | ') : 'none'}`);
  for (const capability of result.capabilities) {
    console.log(`${capability.id}=${capability.status}`);
  }
  console.log(`evidence_summary=${result.evidence_summary}`);
}
