import fs from 'node:fs/promises';
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
  const awpReviewHelp = runSpecHelp(['awp-review-check', '--help']);

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
      status: /\bstart\|commit\|merge\b/.test(workflowOutput) ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes start|commit|merge',
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
      id: 'workflow_check_pr_readback',
      status: hasLongOption(workflowOutput, 'pr') ? 'pass' : 'fail',
      required: true,
      evidence: 'spec workflow-check --help includes --pr',
    },
    {
      id: 'awp_review_check_command',
      status: awpReviewHelp.exitCode === 0 ? 'pass' : 'skipped',
      required: false,
      evidence: 'spec awp-review-check --help',
    },
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

function hasLongOption(output: string, optionName: string): boolean {
  const escaped = optionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)--${escaped}(?:\\s|,|$)`, 'm').test(output);
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

async function readCommit(): Promise<string> {
  if (process.env.SPEC_INJECTOR_COMMIT) return process.env.SPEC_INJECTOR_COMMIT;
  const result = run(['git', 'rev-parse', '--short', 'HEAD'], { cwd: packageRoot() });
  return result.exitCode === 0 ? result.stdout.trim() : 'unknown';
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
