import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { runCommand } from './cli.ts';

type TestLifecycle = Pick<TestContext, 'after'>;

type IssuePayload = {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  url: string;
  state: string;
};

type PlanFixture = {
  repoDir: string;
  env: NodeJS.ProcessEnv;
  ghLogPath: string;
  issueUrl: string;
  taskPackagePath: string;
};

type PreflightFixture = {
  mainRepoDir: string;
  worktreeDir: string;
  branchName: string;
  env: NodeJS.ProcessEnv;
  gitLogPath: string;
};

type EvidenceCheckFixture = {
  env: NodeJS.ProcessEnv;
  ghLogPath: string;
  prNumber: number;
  repo: string;
  issueNumber: number;
  headSha: string;
  evidenceUrl: string;
};

type EvidenceCheckFixtureOptions = {
  issueNumber?: number;
  evidenceCommentId?: string;
  branch?: string;
  prBody?: string;
  issueComments?: Array<{ url: string; body: string }>;
  headSha?: string;
  expectedPrRef?: string;
  isDraft?: boolean;
  checks?: Array<{ name: string; state?: string; conclusion?: string; bucket?: string }>;
  checksCommand?: { exitCode?: number; stdout?: string; stderr?: string };
  reviews?: Array<{ author?: { login?: string }; body?: string; state?: string; submittedAt?: string }>;
};

type LabelAuditFixture = {
  env: NodeJS.ProcessEnv;
  ghLogPath: string;
  repo: string;
};

type LabelAuditIssuePayload = {
  number: number;
  title: string;
  url: string;
  state: string;
  stateReason?: string;
  labels?: Array<{ name: string }>;
  milestone?: { title: string } | null;
};

type LabelAuditPrPayload = {
  number: number;
  title: string;
  url: string;
  labels?: Array<{ name: string }>;
  milestone?: { title: string } | null;
  closingIssuesReferences?: Array<{ number: number }>;
  isDraft?: boolean;
};

type LabelAuditFixtureOptions = {
  issues?: LabelAuditIssuePayload[];
  prs?: LabelAuditPrPayload[];
  issueListCommand?: { exitCode?: number; stdout?: string; stderr?: string };
  prListCommand?: { exitCode?: number; stdout?: string; stderr?: string };
};

type ExplicitPathPlanFixtureOptions = {
  issueNumber?: number;
  title: string;
  bodyLines: string[];
  labels?: Array<{ name: string }>;
  repoFiles?: Record<string, string>;
  config?: {
    always_read?: string[];
    discovery?: {
      docs?: string[];
      source?: string[];
      max_docs?: number;
      max_source_files?: number;
    };
    guardrails?: Array<{
      id: string;
      when_detected: string[];
      risk: string;
    }>;
  };
};

export async function createTempRepo(t: TestLifecycle, prefix = 'spec-injector-test-'): Promise<string> {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });
  return repoDir;
}

export function createMissingPath(): string {
  return path.join(os.tmpdir(), `spec-injector-missing-${process.pid}-${Date.now()}`);
}

export async function createSpecPlanFixture(t: TestLifecycle): Promise<PlanFixture> {
  const repoDir = await createTempRepo(t);
  const alwaysReadLongBody = [
    'ALWAYS_READ_LONG_BODY_SENTINEL',
    'Always read instructions for deterministic planning.',
    'Keep references compact in prompt mode.',
    'Inline full content only in full task package mode.',
  ].join('\n\n');
  const discoveredDocLongBody = [
    'DISCOVERED_DOC_LONG_BODY_SENTINEL',
    'Authentication checklist for backend login and session review.',
    'This content should be referenced in prompt mode rather than inlined.',
  ].join('\n\n');
  const sourceSnippetBody = 'SOURCE_SNIPPET_BODY_SENTINEL: Auth handler for login, permission, session, and token checks.';

  await writeRepoFiles(repoDir, {
    '.spec-injector/config.json': JSON.stringify({
      version: 2,
      always_read: ['docs/always-read.md', 'docs/missing-handbook.md'],
      discovery: {
        docs: ['docs/database-guardrail.md'],
        source: ['src'],
        max_docs: 3,
        max_source_files: 2,
      },
      guardrails: [
        {
          id: 'auth-review',
          when_detected: ['auth', 'backend'],
          risk: 'Require auth reviewer before changing login or permission flows.',
        },
        {
          id: 'db-migration',
          when_detected: ['database'],
          risk: 'Review schema and migration blast radius before changing auth data persistence.',
        },
      ],
    }, null, 2) + '\n',
    'docs/always-read.md': `# Always Read\n\n${alwaysReadLongBody}\n`,
    'docs/auth-runbook.md': `# Auth Runbook\n\n${discoveredDocLongBody}\n`,
    'docs/database-guardrail.md': '# Database Guardrail\n\nDatabase migration review steps for auth schema updates.\n',
    'docs/testing-fixtures.md': '# Testing Fixtures\n\nFixture notes for spec plan tests.\n',
    'src/auth-handler.ts': `export function authHandler() { return "${sourceSnippetBody}"; }\n`,
    'src/database-auth-service.ts': 'export function databaseAuthService() { return "Database service for schema migration and auth persistence."; }\n',
    'README.md': '# Spec Injector Fixture\n\nBackend auth database planning notes.\n',
  });

  const issue = {
    number: 57,
    title: 'Add backend auth database fixture plan coverage',
    body: [
      'Need deterministic fixture-based integration coverage for spec plan.',
      '',
      '- [ ] verify auth guardrail guidance in dry-run output',
      '- [ ] verify database source references in generated task package',
      '',
      'Focus on backend auth database CLI behavior with mocked gh output and fixture docs.',
    ].join('\n'),
    labels: [{ name: 'test' }, { name: 'backend' }, { name: 'auth' }, { name: 'database' }],
    url: 'https://github.com/Erick52106/spec-injector/issues/57',
    state: 'OPEN',
  };
  const fakeGh = await createFakeGh(t, issue);

  return {
    repoDir,
    env: fakeGh.env,
    ghLogPath: fakeGh.logPath,
    issueUrl: issue.url,
    taskPackagePath: path.join(repoDir, '.spec-injector', 'out', 'issue-57-task-package.md'),
  };
}

export async function createPreflightFixture(
  t: TestLifecycle,
  options: {
    branchName?: string;
    worktreeName?: string;
    withUpstream?: boolean;
  } = {}
): Promise<PreflightFixture> {
  const branchName = options.branchName ?? 'feat/worktree-preflight-checker-108';
  const worktreeName = options.worktreeName ?? 'feat-worktree-preflight-checker-108';
  const mainRepoDir = await createTempRepo(t, 'spec-injector-preflight-main-');
  const worktreeParentDir = await createTempRepo(t, 'spec-injector-preflight-worktrees-');
  const worktreeDir = path.join(worktreeParentDir, worktreeName);

  await writeRepoFiles(mainRepoDir, {
    'README.md': '# Preflight Fixture\n',
  });

  await runCommand('git', ['init', '--initial-branch=main'], mainRepoDir);
  await runCommand('git', ['config', 'user.email', 'spec-injector@example.test'], mainRepoDir);
  await runCommand('git', ['config', 'user.name', 'Spec Injector Test'], mainRepoDir);
  await runCommand('git', ['add', '.'], mainRepoDir);
  await runCommand('git', ['commit', '-m', 'Initial fixture commit'], mainRepoDir);

  if (options.withUpstream ?? true) {
    const remoteDir = await createTempRepo(t, 'spec-injector-preflight-remote-');
    await runCommand('git', ['init', '--bare', remoteDir], mainRepoDir);
    await runCommand('git', ['remote', 'add', 'origin', remoteDir], mainRepoDir);
    await runCommand('git', ['push', '--set-upstream', 'origin', 'main'], mainRepoDir);
  }

  await runCommand('git', ['worktree', 'add', '-b', branchName, worktreeDir, 'main'], mainRepoDir);

  const gitSpy = await createGitSpyEnv(t, process.env);

  return {
    mainRepoDir,
    worktreeDir,
    branchName,
    env: gitSpy.env,
    gitLogPath: gitSpy.logPath,
  };
}

export async function createEvidenceCheckFixture(
  t: TestLifecycle,
  options: EvidenceCheckFixtureOptions = {}
): Promise<EvidenceCheckFixture> {
  const repo = 'Erick52106/spec-injector';
  const prNumber = 1091;
  const issueNumber = options.issueNumber ?? 109;
  const evidenceCommentId = options.evidenceCommentId ?? '1090001';
  const headSha = options.headSha ?? '1234567890abcdef1234567890abcdef12345678';
  const evidenceUrl = `https://github.com/${repo}/issues/${issueNumber}#issuecomment-${evidenceCommentId}`;
  const prUrl = `https://github.com/${repo}/pull/${prNumber}`;
  const branch = options.branch ?? 'feat/pr-evidence-consistency-checker-109';
  const defaultValidation = [
    '- `git diff --check` ✅',
    '- `pnpm build` ✅',
    '- `pnpm test` ✅',
  ].join('\n');
  const prBody = options.prBody ?? [
    `Closes #${issueNumber}`,
    '',
    '## Summary',
    '- 新增 repo-local evidence checker。',
    '',
    '## Scope',
    '- 只做 read-only consistency check。',
    '',
    '## Non-goals',
    '- 不 auto-fix、不 merge。',
    '',
    '## Validation',
    defaultValidation,
    '',
    '## Review finding assessment',
    '- noise / not applicable: no actionable review findings.',
    '',
    '## Implementation Evidence',
    `- Issue evidence comment URL: ${evidenceUrl}`,
    `- Latest HEAD: ${headSha}`,
    '',
    '## Follow-up notes',
    '- JSON output 留待後續。',
  ].join('\n');
  const issueComments = options.issueComments ?? [{
    url: evidenceUrl,
    body: [
      '## Implementation evidence',
      `- PR URL: ${prUrl}`,
      `- Branch: ${branch}`,
      `- Commit hash / HEAD: ${headSha}`,
      '- Tests / validation:',
      defaultValidation,
      '- Scope / non-goals: read-only checker; no auto-fix.',
    ].join('\n'),
  }];
  const fakeGh = await createFakeEvidenceGh(t, {
    repo,
    prNumber,
    issueNumber,
    pr: {
      number: prNumber,
      url: prUrl,
      body: prBody,
      headRefName: branch,
      headRefOid: headSha,
      isDraft: options.isDraft ?? false,
      reviews: options.reviews ?? [],
    },
    issue: {
      number: issueNumber,
      url: `https://github.com/${repo}/issues/${issueNumber}`,
      comments: issueComments,
    },
    checks: options.checks ?? [
      { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS', bucket: 'pass' },
    ],
    checksCommand: options.checksCommand,
    expectedPrRef: options.expectedPrRef ?? String(prNumber),
  });

  return {
    env: fakeGh.env,
    ghLogPath: fakeGh.logPath,
    prNumber,
    repo,
    issueNumber,
    headSha,
    evidenceUrl,
  };
}

export async function createLabelAuditFixture(
  t: TestLifecycle,
  options: LabelAuditFixtureOptions = {}
): Promise<LabelAuditFixture> {
  const repo = 'Erick52106/spec-injector';
  const issues = options.issues ?? [];
  const prs = options.prs ?? [];
  const fakeGh = await createFakeLabelAuditGh(t, {
    repo,
    issues,
    prs,
    issueListCommand: options.issueListCommand,
    prListCommand: options.prListCommand,
  });

  return {
    env: fakeGh.env,
    ghLogPath: fakeGh.logPath,
    repo,
  };
}

export async function createExternalConfigPlanFixture(t: TestLifecycle): Promise<{
  repoDir: string;
  configPath: string;
  env: NodeJS.ProcessEnv;
  issueUrl: string;
}> {
  const repoDir = await createTempRepo(t, 'spec-injector-external-target-');
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-external-config-'));
  t.after(async () => {
    await fs.rm(configDir, { recursive: true, force: true });
  });

  const configPath = path.join(configDir, 'config.json');
  await fs.writeFile(configPath, `${JSON.stringify({
    version: 2,
    always_read: ['docs/external-always.md'],
    discovery: {
      docs: [],
      source: ['src'],
      max_docs: 2,
      max_source_files: 2,
    },
    guardrails: [
      {
        id: 'external-auth-review',
        when_detected: ['auth'],
        risk: 'External config guardrail for read-only dogfood.',
      },
    ],
  }, null, 2)}\n`, 'utf8');

  await writeRepoFiles(repoDir, {
    'docs/external-always.md': '# External Always\n\nEXTERNAL_ALWAYS_READ_SENTINEL\n',
    'docs/auth-note.md': '# Auth Note\n\nExternal config dogfood auth documentation.\n',
    'src/auth.ts': 'export const authSentinel = "EXTERNAL_CONFIG_SOURCE_SENTINEL";\n',
    'README.md': '# External Config Target\n\nRead-only dogfood fixture.\n',
  });

  const issue = {
    number: 113,
    title: 'Support external auth config for read-only dogfood',
    body: [
      'Use external config while planning auth changes.',
      '',
      '- [ ] verify external config guardrails',
    ].join('\n'),
    labels: [{ name: 'auth' }],
    url: 'https://github.com/Erick52106/spec-injector/issues/113',
    state: 'OPEN',
  };
  const fakeGh = await createFakeGh(t, issue);
  fakeGh.env.FAKE_GH_EXPECT_REF = '113';

  return {
    repoDir,
    configPath,
    env: fakeGh.env,
    issueUrl: issue.url,
  };
}

export async function createExplicitPathPlanFixture(
  t: TestLifecycle,
  options: ExplicitPathPlanFixtureOptions
): Promise<PlanFixture> {
  const repoDir = await createTempRepo(t);
  const issueNumber = options.issueNumber ?? 80;
  const issueUrl = `https://github.com/Erick52106/spec-injector/issues/${issueNumber}`;
  const config = {
    version: 2,
    always_read: options.config?.always_read ?? [],
    discovery: {
      docs: options.config?.discovery?.docs ?? [],
      source: options.config?.discovery?.source ?? ['src', 'apps', 'services', 'packages'],
      max_docs: options.config?.discovery?.max_docs ?? 5,
      max_source_files: options.config?.discovery?.max_source_files ?? 5,
    },
    guardrails: options.config?.guardrails ?? [],
  };

  await writeRepoFiles(repoDir, {
    '.spec-injector/config.json': `${JSON.stringify(config, null, 2)}\n`,
    ...(options.repoFiles ?? {}),
  });

  const issue = {
    number: issueNumber,
    title: options.title,
    body: options.bodyLines.join('\n'),
    labels: options.labels ?? [{ name: 'plan' }],
    url: issueUrl,
    state: 'OPEN',
  };
  const fakeGh = await createFakeGh(t, issue);
  fakeGh.env.FAKE_GH_EXPECT_REF = String(issueNumber);

  return {
    repoDir,
    env: fakeGh.env,
    ghLogPath: fakeGh.logPath,
    issueUrl,
    taskPackagePath: path.join(repoDir, '.spec-injector', 'out', `issue-${issueNumber}-task-package.md`),
  };
}

async function createFakeGh(t: TestLifecycle, issuePayload: IssuePayload): Promise<{
  env: NodeJS.ProcessEnv;
  logPath: string;
}> {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-gh-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const responsePath = path.join(binDir, 'issue.json');
  const logPath = path.join(binDir, 'gh.log');
  const ghPath = path.join(binDir, 'gh');

  await fs.writeFile(responsePath, JSON.stringify(issuePayload), 'utf8');
  await fs.writeFile(logPath, '', 'utf8');
  await fs.writeFile(ghPath, `#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, args.join(' ') + '\\n', 'utf8');

if (args[0] !== 'issue' || args[1] !== 'view') {
  console.error('Unsupported gh invocation: ' + args.join(' '));
  process.exit(1);
}

if (args[2] !== process.env.FAKE_GH_EXPECT_REF) {
  console.error('Unexpected issue ref: ' + args[2]);
  process.exit(1);
}

const repoFlagIndex = args.indexOf('--repo');
if (repoFlagIndex === -1 || args[repoFlagIndex + 1] !== process.env.FAKE_GH_EXPECT_REPO) {
  console.error('Unexpected repo flag: ' + args.join(' '));
  process.exit(1);
}

const jsonFlagIndex = args.indexOf('--json');
if (jsonFlagIndex === -1 || args[jsonFlagIndex + 1] !== 'number,title,body,labels,url,state') {
  console.error('Unexpected json fields: ' + args.join(' '));
  process.exit(1);
}

process.stdout.write(fs.readFileSync(process.env.FAKE_GH_RESPONSE_FILE, 'utf8'));
`, 'utf8');
  await fs.chmod(ghPath, 0o755);

  return {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_GH_RESPONSE_FILE: responsePath,
      FAKE_GH_LOG: logPath,
      FAKE_GH_EXPECT_REF: '57',
      FAKE_GH_EXPECT_REPO: 'Erick52106/spec-injector',
    },
    logPath,
  };
}

async function createFakeEvidenceGh(
  t: TestLifecycle,
  payload: {
    repo: string;
    prNumber: number;
    issueNumber: number;
    pr: Record<string, unknown>;
    issue: Record<string, unknown>;
    checks: Array<Record<string, unknown>>;
    checksCommand?: { exitCode?: number; stdout?: string; stderr?: string };
    expectedPrRef: string;
  }
): Promise<{
  env: NodeJS.ProcessEnv;
  logPath: string;
}> {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-evidence-gh-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const payloadPath = path.join(binDir, 'evidence.json');
  const logPath = path.join(binDir, 'gh.log');
  const ghPath = path.join(binDir, 'gh');

  await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8');
  await fs.writeFile(logPath, '', 'utf8');
  await fs.writeFile(ghPath, `#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, args.join(' ') + '\\n', 'utf8');
const payload = JSON.parse(fs.readFileSync(process.env.FAKE_GH_PAYLOAD_FILE, 'utf8'));

function requireRepo() {
  const repoFlagIndex = args.indexOf('--repo');
  if (repoFlagIndex === -1 || args[repoFlagIndex + 1] !== payload.repo) {
    console.error('Unexpected repo flag: ' + args.join(' '));
    process.exit(1);
  }
}

if (args[0] === 'pr' && args[1] === 'view') {
  requireRepo();
  if (args[2] !== payload.expectedPrRef) {
    console.error('Unexpected PR ref: ' + args[2]);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(payload.pr));
  process.exit(0);
}

if (args[0] === 'issue' && args[1] === 'view') {
  requireRepo();
  if (args[2] !== String(payload.issueNumber)) {
    console.error('Unexpected issue ref: ' + args[2]);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(payload.issue));
  process.exit(0);
}

if (args[0] === 'pr' && args[1] === 'checks') {
  requireRepo();
  if (args[2] !== payload.expectedPrRef) {
    console.error('Unexpected checks PR ref: ' + args[2]);
    process.exit(1);
  }
  if (payload.checksCommand) {
    if (payload.checksCommand.stdout !== undefined) {
      process.stdout.write(payload.checksCommand.stdout);
    }
    if (payload.checksCommand.stderr !== undefined) {
      process.stderr.write(payload.checksCommand.stderr);
    }
    process.exit(payload.checksCommand.exitCode ?? 0);
  }
  process.stdout.write(JSON.stringify(payload.checks));
  process.exit(0);
}

console.error('Unsupported gh invocation: ' + args.join(' '));
process.exit(1);
`, 'utf8');
  await fs.chmod(ghPath, 0o755);

  return {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_GH_PAYLOAD_FILE: payloadPath,
      FAKE_GH_LOG: logPath,
    },
    logPath,
  };
}

async function createFakeLabelAuditGh(
  t: TestLifecycle,
  payload: {
    repo: string;
    issues: LabelAuditIssuePayload[];
    prs: LabelAuditPrPayload[];
    issueListCommand?: { exitCode?: number; stdout?: string; stderr?: string };
    prListCommand?: { exitCode?: number; stdout?: string; stderr?: string };
  }
): Promise<{
  env: NodeJS.ProcessEnv;
  logPath: string;
}> {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-label-audit-gh-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const payloadPath = path.join(binDir, 'label-audit.json');
  const logPath = path.join(binDir, 'gh.log');
  const ghPath = path.join(binDir, 'gh');

  await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8');
  await fs.writeFile(logPath, '', 'utf8');
  await fs.writeFile(ghPath, `#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, args.join(' ') + '\\n', 'utf8');
const payload = JSON.parse(fs.readFileSync(process.env.FAKE_GH_PAYLOAD_FILE, 'utf8'));

function requireRepo() {
  const repoFlagIndex = args.indexOf('--repo');
  if (repoFlagIndex === -1 || args[repoFlagIndex + 1] !== payload.repo) {
    console.error('Unexpected repo flag: ' + args.join(' '));
    process.exit(1);
  }
}

function requireJsonFields(expectedFields, commandLabel) {
  const jsonFlagIndex = args.indexOf('--json');
  if (jsonFlagIndex === -1) {
    console.error('Missing --json for ' + commandLabel + ': ' + args.join(' '));
    process.exit(1);
  }
  const actualFields = new Set(String(args[jsonFlagIndex + 1] ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  for (const field of expectedFields) {
    if (!actualFields.has(field)) {
      console.error('Missing ' + commandLabel + ' json field "' + field + '": ' + args.join(' '));
      process.exit(1);
    }
  }
}

if (args[0] === 'issue' && args[1] === 'list') {
  requireRepo();
  requireJsonFields(['number', 'title', 'url', 'state', 'stateReason', 'labels', 'milestone'], 'issue list');
  if (payload.issueListCommand) {
    if (payload.issueListCommand.stdout !== undefined) {
      process.stdout.write(payload.issueListCommand.stdout);
    }
    if (payload.issueListCommand.stderr !== undefined) {
      process.stderr.write(payload.issueListCommand.stderr);
    }
    process.exit(payload.issueListCommand.exitCode ?? 0);
  }
  process.stdout.write(JSON.stringify(payload.issues));
  process.exit(0);
}

if (args[0] === 'pr' && args[1] === 'list') {
  requireRepo();
  requireJsonFields(['number', 'title', 'url', 'labels', 'milestone', 'closingIssuesReferences', 'isDraft'], 'pr list');
  if (payload.prListCommand) {
    if (payload.prListCommand.stdout !== undefined) {
      process.stdout.write(payload.prListCommand.stdout);
    }
    if (payload.prListCommand.stderr !== undefined) {
      process.stderr.write(payload.prListCommand.stderr);
    }
    process.exit(payload.prListCommand.exitCode ?? 0);
  }
  process.stdout.write(JSON.stringify(payload.prs));
  process.exit(0);
}

console.error('Unsupported gh invocation: ' + args.join(' '));
process.exit(1);
`, 'utf8');
  await fs.chmod(ghPath, 0o755);

  return {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
      FAKE_GH_PAYLOAD_FILE: payloadPath,
      FAKE_GH_LOG: logPath,
    },
    logPath,
  };
}

export async function createFailingGitEnv(t: TestLifecycle, baseEnv: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-git-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const gitPath = path.join(binDir, 'git');
  await fs.writeFile(gitPath, [
    '#!/bin/sh',
    'echo "simulated git failure" >&2',
    'exit 2',
    '',
  ].join('\n'), 'utf8');
  await fs.chmod(gitPath, 0o755);

  return {
    ...baseEnv,
    PATH: `${binDir}${path.delimiter}${baseEnv.PATH ?? process.env.PATH ?? ''}`,
  };
}

async function createGitSpyEnv(t: TestLifecycle, baseEnv: NodeJS.ProcessEnv): Promise<{
  env: NodeJS.ProcessEnv;
  logPath: string;
}> {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-git-spy-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const realGitPath = (await runCommand('which', ['git'], process.cwd())).stdout.trim();
  const logPath = path.join(binDir, 'git.log');
  const gitPath = path.join(binDir, 'git');

  await fs.writeFile(logPath, '', 'utf8');
  await fs.writeFile(gitPath, [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$FAKE_GIT_LOG"',
    'exec "$FAKE_GIT_REAL" "$@"',
    '',
  ].join('\n'), 'utf8');
  await fs.chmod(gitPath, 0o755);

  return {
    env: {
      ...baseEnv,
      PATH: `${binDir}${path.delimiter}${baseEnv.PATH ?? process.env.PATH ?? ''}`,
      FAKE_GIT_LOG: logPath,
      FAKE_GIT_REAL: realGitPath,
    },
    logPath,
  };
}

export async function initCleanGitRepo(repoDir: string): Promise<void> {
  await runCommand('git', ['init'], repoDir);
  await runCommand('git', ['config', 'user.email', 'spec-injector@example.test'], repoDir);
  await runCommand('git', ['config', 'user.name', 'Spec Injector Test'], repoDir);
  await runCommand('git', ['add', '.'], repoDir);
  await runCommand('git', ['commit', '-m', 'Initial fixture commit'], repoDir);
}

export async function writeFiles(repoDir: string, relativePaths: string[]): Promise<void> {
  await Promise.all(relativePaths.map(async (relativePath) => {
    const absolutePath = path.join(repoDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, `${relativePath}\n`, 'utf8');
  }));
}

export async function writeRepoFiles(repoDir: string, files: Record<string, string>): Promise<void> {
  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const absolutePath = path.join(repoDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }));
}

export async function writeConfig(repoDir: string, config: object): Promise<void> {
  await writeRepoFiles(repoDir, {
    '.spec-injector/config.json': `${JSON.stringify(config, null, 2)}\n`,
  });
}

export function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

export async function readDirectorySnapshot(dirPath: string): Promise<Record<string, string>> {
  const snapshot: Record<string, string> = {};

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(dirPath, absolutePath);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      snapshot[relativePath] = await fs.readFile(absolutePath, 'utf8');
    }
  }

  await walk(dirPath);
  return snapshot;
}

export async function readGhLog(filePath: string): Promise<string[]> {
  return (await readFile(filePath))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
