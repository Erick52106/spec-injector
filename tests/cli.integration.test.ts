import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { classifyDomains, classifyDomainsWithEvidence } from '../dist/classifier/domain.js';
import { config as runConfigCommand } from '../dist/cli/config.js';
import { renderTemplate } from '../dist/template/renderer.js';
import { repoRoot, runCommand, runSpec } from './helpers/cli.ts';
import {
  createExplicitPathPlanFixture,
  createEvidenceCheckFixture,
  createExternalConfigPlanFixture,
  createFailingGitEnv,
  createLabelAuditFixture,
  createMissingPath,
  createPreflightFixture,
  createSpecPlanFixture,
  createTempRepo,
  initCleanGitRepo,
  readDirectorySnapshot,
  readFile,
  readGhLog,
  writeConfig,
  writeFiles,
  writeRepoFiles,
} from './helpers/fixtures.ts';
import {
  assertDirtyWarning,
  assertFileExists,
  assertFileMissing,
  assertNoGitMutationCommands,
  assertNoGhMutationCommands,
  assertNoCleanupCommands,
  assertNoRawStackTrace,
  assertOrderedSubstrings,
  countOccurrences,
  escapeRegExp,
  normalizePlanOutput,
  sectionBetween,
} from './helpers/assertions.ts';

const UNREPLACED_TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}|__[A-Z][A-Z0-9_]*__/;

async function captureConsoleOutput(fn: () => Promise<void>): Promise<{ stdout: string; stderr: string }> {
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: unknown[]) => {
    stdout.push(args.join(' '));
  };
  console.error = (...args: unknown[]) => {
    stderr.push(args.join(' '));
  };

  try {
    await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    stdout: stdout.length > 0 ? `${stdout.join('\n')}\n` : '',
    stderr: stderr.length > 0 ? `${stderr.join('\n')}\n` : '',
  };
}

async function createReadFailureEnv(
  t: { after(fn: () => void | Promise<void>): void },
  baseEnv: NodeJS.ProcessEnv,
  failures: Array<[string, string]>
): Promise<NodeJS.ProcessEnv> {
  const preloadDir = await fs.mkdtemp(path.join(path.dirname(createMissingPath()), 'spec-injector-read-failure-'));
  t.after(async () => {
    await fs.rm(preloadDir, { recursive: true, force: true });
  });

  const preloadPath = path.join(preloadDir, 'read-failure-preload.mjs');
  await fs.writeFile(preloadPath, [
    "import fs from 'node:fs';",
    `const failures = ${JSON.stringify(failures)};`,
    'const originalReadFile = fs.promises.readFile.bind(fs.promises);',
    'fs.promises.readFile = async function readFileWithFixtureFailures(filePath, ...args) {',
    "  const normalized = String(filePath).replaceAll('\\\\', '/');",
    '  const match = failures.find(([suffix]) => normalized.endsWith(suffix));',
    '  if (match) {',
    "    const error = new Error('fixture read failure');",
    '    error.code = match[1];',
    '    throw error;',
    '  }',
    '  return originalReadFile(filePath, ...args);',
    '};',
    '',
  ].join('\n'), 'utf8');

  const existingNodeOptions = baseEnv.NODE_OPTIONS ?? process.env.NODE_OPTIONS ?? '';
  return {
    ...baseEnv,
    NODE_OPTIONS: [existingNodeOptions, `--import=${preloadPath}`].filter(Boolean).join(' '),
  };
}

async function createStatusFailingGitEnv(
  t: { after(fn: () => void | Promise<void>): void },
  baseEnv: NodeJS.ProcessEnv,
  failCwd: string
): Promise<{ env: NodeJS.ProcessEnv; logPath: string }> {
  const binDir = await fs.mkdtemp(path.join(path.dirname(createMissingPath()), 'spec-injector-status-failing-git-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const realGitPath = (await runCommand('which', ['git'], repoRoot)).stdout.trim();
  const logPath = path.join(binDir, 'git.log');
  const gitPath = path.join(binDir, 'git');

  await fs.writeFile(logPath, '', 'utf8');
  await fs.writeFile(gitPath, [
    '#!/bin/sh',
    'printf "%s\\n" "$*" >> "$FAKE_GIT_LOG"',
    'if [ "$PWD" = "$FAKE_GIT_FAIL_CWD" ] && [ "$1" = "status" ]; then',
    '  echo "simulated git status failure" >&2',
    '  exit 2',
    'fi',
    'exec "$FAKE_GIT_REAL" "$@"',
    '',
  ].join('\n'), 'utf8');
  await fs.chmod(gitPath, 0o755);

  return {
    env: {
      ...baseEnv,
      PATH: `${binDir}${path.delimiter}${baseEnv.PATH ?? process.env.PATH ?? ''}`,
      FAKE_GIT_FAIL_CWD: await fs.realpath(failCwd),
      FAKE_GIT_LOG: logPath,
      FAKE_GIT_REAL: realGitPath,
    },
    logPath,
  };
}

test('classifier does not treat dashboard transactions endpoint wording as wallet evidence', () => {
  const domains = classifyDomains({
    number: 77,
    title: 'Dashboard frontend UI refine transactions/settings endpoint contract',
    body: [
      'Align the transactions endpoint and settings endpoint API contract.',
      'Update the backend server route handler and controller for dashboard records.',
      'Keep the frontend dashboard page and data provider response shape in sync.',
    ].join('\n'),
    labels: ['frontend', 'api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/77',
    state: 'open',
  });

  assert.ok(domains.includes('frontend'), `Expected frontend in ${domains.join(', ')}`);
  assert.ok(domains.includes('api'), `Expected api in ${domains.join(', ')}`);
  assert.ok(domains.includes('backend'), `Expected backend in ${domains.join(', ')}`);
  assert.ok(!domains.includes('blockchain'), `Expected blockchain to be absent from ${domains.join(', ')}`);
  assert.ok(!domains.includes('smart-contract'), `Expected smart-contract to be absent from ${domains.join(', ')}`);
  assert.ok(!domains.includes('wallet'), `Expected wallet to be absent from ${domains.join(', ')}`);
});

test('classifier suppresses generic dashboard endpoint contract wording from blockchain domains', () => {
  const result = classifyDomainsWithEvidence({
    number: 114,
    title: 'Dashboard transactions/settings endpoint contract alignment blocking release',
    body: [
      'Align the transactions endpoint and settings endpoint API contract.',
      'This is a backend route handler contract and request / response contract issue for dashboard records.',
      'Keep the frontend dashboard page and database-backed product transaction records in sync.',
    ].join('\n'),
    labels: ['frontend', 'api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/114',
    state: 'open',
  });

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('blockchain'), `Expected blockchain to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('smart-contract'), `Expected smart-contract to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('wallet'), `Expected wallet to be absent from ${result.domains.join(', ')}`);
  assert.ok(result.rejected.some((r) =>
    r.domain === 'smart-contract' &&
    r.signal === 'contract' &&
    r.source === 'title' &&
    r.reason === 'generic API contract wording'
  ));
  assert.ok(result.rejected.length <= 2, `Expected only targeted rejected reasons, got ${JSON.stringify(result.rejected)}`);
});

test('classifier does not overfit non-tachigo transaction history API contract wording to blockchain', () => {
  const result = classifyDomainsWithEvidence({
    number: 114,
    title: 'Admin dashboard transaction history API contract',
    body: [
      'Review the request / response contract for billing transaction history.',
      'The backend route handler should return product transaction records from database rows.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/example/product/issues/114',
    state: 'open',
  });

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('blockchain'), `Expected blockchain to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('smart-contract'), `Expected smart-contract to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('wallet'), `Expected wallet to be absent from ${result.domains.join(', ')}`);
});

test('classifier keeps wallet detection for explicit wallet and on-chain transaction evidence', () => {
  const domains = classifyDomains({
    number: 77,
    title: 'Connect wallet token transfer transaction hash tracking',
    body: [
      'Record the connected wallet address after users connect wallet.',
      'Show token transfer status, tx hash, transaction hash, and on-chain confirmation.',
    ].join('\n'),
    labels: ['wallet'],
    url: 'https://github.com/Erick52106/spec-injector/issues/77',
    state: 'open',
  });

  assert.ok(domains.includes('wallet'), `Expected wallet in ${domains.join(', ')}`);
});

test('classifier keeps blockchain detection for legitimate smart contract and on-chain evidence', () => {
  const result = classifyDomainsWithEvidence({
    number: 114,
    title: 'Smart contract on-chain tx hash contract address indexing',
    body: [
      'Index Ethereum EVM contract address activity with transaction hash and tx hash lookup.',
      'Persist block height, gas, and nonce metadata for token transfer reconciliation.',
    ].join('\n'),
    labels: ['backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/114',
    state: 'open',
  });

  assert.ok(result.domains.includes('blockchain'), `Expected blockchain in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('smart-contract'), `Expected smart-contract in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'blockchain' && e.term === 'on-chain' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'blockchain' && e.term === 'contract address' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'smart-contract' && e.term === 'smart contract' && e.source === 'title'
  ));
});

test('classifier does not overfit product transaction records to wallet', () => {
  const domains = classifyDomains({
    number: 77,
    title: 'Admin dashboard transaction history endpoint',
    body: [
      'Expose billing transaction records API for product support workflows.',
      'The backend handler should read app records from database rows.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/77',
    state: 'open',
  });

  assert.ok(domains.includes('api'), `Expected api in ${domains.join(', ')}`);
  assert.ok(domains.includes('backend'), `Expected backend in ${domains.join(', ')}`);
  assert.ok(!domains.includes('wallet'), `Expected wallet to be absent from ${domains.join(', ')}`);
});

test('classifier reports deterministic evidence for detected domains', () => {
  const result = classifyDomainsWithEvidence({
    number: 91,
    title: 'Dashboard endpoint route refine',
    body: [
      'Update the backend handler for route consistency.',
      'Keep the frontend dashboard page in sync.',
    ].join('\n'),
    labels: ['api'],
    url: 'https://github.com/Erick52106/spec-injector/issues/91',
    state: 'open',
  });

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.deepEqual(result.evidence.filter((e) => e.domain === 'api')[0], {
    domain: 'api',
    term: 'endpoint',
    source: 'title',
  });
  assert.ok(result.evidence.some((e) =>
    e.domain === 'frontend' && e.term === 'page' && e.source === 'body'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === 'handler' && e.source === 'body'
  ));
});

test('classifier reports wallet evidence for explicit on-chain signals', () => {
  const result = classifyDomainsWithEvidence({
    number: 91,
    title: 'Connect wallet token transfer transaction hash tracking',
    body: [
      'Record the connected wallet address after users connect wallet.',
      'Show token transfer status, tx hash, transaction hash, and on-chain confirmation.',
    ].join('\n'),
    labels: ['wallet'],
    url: 'https://github.com/Erick52106/spec-injector/issues/91',
    state: 'open',
  });

  assert.ok(result.domains.includes('wallet'), `Expected wallet in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'wallet' && e.term === 'wallet address' && e.source === 'body'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'wallet' && e.term === 'tx hash' && e.source === 'body'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'wallet' && e.term === 'transaction hash' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'wallet' && e.term === 'token transfer' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'wallet' && e.term === 'on-chain' && e.source === 'body'
  ));
  assert.ok(!result.rejected.some((r) => r.domain === 'wallet'));
});

test('classifier reports wallet rejected reason for generic product transaction wording only', () => {
  const result = classifyDomainsWithEvidence({
    number: 91,
    title: 'Admin dashboard billing transactions endpoint',
    body: [
      'Expose product transaction records API for support workflows.',
      'The backend handler should read app records from database rows.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/91',
    state: 'open',
  });

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('wallet'), `Expected wallet to be absent from ${result.domains.join(', ')}`);
  assert.deepEqual(result.rejected, [{
    domain: 'wallet',
    signal: 'transactions',
    source: 'title',
    reason: 'generic product transaction wording',
  }]);
});

test('classifier ignores generic transaction records wording for database domain', () => {
  const issue = {
    number: 137,
    title: 'Dashboard transaction records endpoint contract',
    body: [
      'Review the billing transaction history list and product transaction page.',
      'Update the backend route handler and API response contract for user transaction details.',
      'Keep transaction settings copy aligned with dashboard support workflows.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/137',
    state: 'open' as const,
  };

  const first = classifyDomainsWithEvidence(issue);
  const second = classifyDomainsWithEvidence(issue);

  assert.deepEqual(first, second);
  assert.ok(first.domains.includes('api'), `Expected api in ${first.domains.join(', ')}`);
  assert.ok(first.domains.includes('backend'), `Expected backend in ${first.domains.join(', ')}`);
  assert.ok(!first.domains.includes('database'), `Expected database to be absent from ${first.domains.join(', ')}`);
  assert.ok(!first.evidence.some((e) => e.domain === 'database'), `Expected no database evidence, got ${JSON.stringify(first.evidence)}`);
  assert.ok(first.rejected.some((r) =>
    r.domain === 'database' &&
    r.signal === 'transaction' &&
    r.source === 'title' &&
    r.reason === 'generic transaction wording'
  ));
  assert.ok(!first.rejected.some((r) => !['wallet', 'smart-contract', 'database'].includes(r.domain)));
});

test('classifier keeps database domain for legitimate transaction table evidence', () => {
  const result = classifyDomainsWithEvidence({
    number: 137,
    title: 'Add transaction table migration and SQL schema',
    body: [
      'Create a migration for transactions with table columns and indexes.',
      'Update the repository layer and persistence data model for persisted records.',
      'Cover PostgreSQL query behavior through the ORM path.',
    ].join('\n'),
    labels: ['backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/137',
    state: 'open',
  });

  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'migration' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'table' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'schema' && e.source === 'title'
  ));
  assert.ok(!result.rejected.some((r) => r.domain === 'database'), `Expected no database rejected reason, got ${JSON.stringify(result.rejected)}`);
});

test('classifier keeps generic transaction API backend wording out of database', () => {
  const issue = {
    number: 137,
    title: 'Transaction endpoint API contract',
    body: [
      'Align backend route handler behavior for product transaction details.',
      'Document request and response examples for the dashboard transaction API.',
      'Do not change billing dashboard UI layout in this backend-only pass.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/137',
    state: 'open' as const,
  };

  const first = classifyDomainsWithEvidence(issue);
  const second = classifyDomainsWithEvidence(issue);

  assert.deepEqual(first, second);
  assert.ok(first.domains.includes('api'), `Expected api in ${first.domains.join(', ')}`);
  assert.ok(first.domains.includes('backend'), `Expected backend in ${first.domains.join(', ')}`);
  assert.ok(!first.domains.includes('database'), `Expected database to be absent from ${first.domains.join(', ')}`);
  assert.ok(!first.evidence.some((e) => e.domain === 'database'), `Expected no database evidence, got ${JSON.stringify(first.evidence)}`);
  assert.deepEqual(first.rejected, [
    {
      domain: 'wallet',
      signal: 'transaction',
      source: 'title',
      reason: 'generic product transaction wording',
    },
    {
      domain: 'smart-contract',
      signal: 'contract',
      source: 'title',
      reason: 'generic API contract wording',
    },
    {
      domain: 'database',
      signal: 'transaction',
      source: 'title',
      reason: 'generic transaction wording',
    },
  ]);
});

test('classifier reports deterministic rejected reason for generic API contract wording only', () => {
  const issue = {
    number: 114,
    title: 'Settings endpoint contract alignment',
    body: [
      'Review the backend route handler contract.',
      'Keep the API request / response contract stable for dashboard settings.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/114',
    state: 'open' as const,
  };

  const first = classifyDomainsWithEvidence(issue);
  const second = classifyDomainsWithEvidence(issue);

  assert.deepEqual(first, second);
  assert.ok(first.domains.includes('api'), `Expected api in ${first.domains.join(', ')}`);
  assert.ok(first.domains.includes('backend'), `Expected backend in ${first.domains.join(', ')}`);
  assert.ok(!first.domains.includes('blockchain'), `Expected blockchain to be absent from ${first.domains.join(', ')}`);
  assert.ok(!first.domains.includes('smart-contract'), `Expected smart-contract to be absent from ${first.domains.join(', ')}`);
  assert.deepEqual(first.rejected, [{
    domain: 'smart-contract',
    signal: 'contract',
    source: 'title',
    reason: 'generic API contract wording',
  }]);
});

test('classifier ignores generic product spec wording for testing domain', () => {
  const result = classifyDomainsWithEvidence({
    number: 73,
    title: 'Product spec for OpenAPI specification planning',
    body: [
      'Write the product spec and API specification for the issue-to-context compiler.',
      'Keep the design spec focused on deterministic API docs and route behavior.',
      'This is documentation and API planning work only.',
    ].join('\n'),
    labels: ['api', 'docs'],
    url: 'https://github.com/Erick52106/spec-injector/issues/73',
    state: 'open',
  });

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('testing'), `Expected testing to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'testing'), `Expected no testing evidence, got ${JSON.stringify(result.evidence)}`);
  assert.ok(!result.rejected.some((r) => r.domain !== 'wallet' && r.domain !== 'smart-contract'));
});

test('classifier ignores spec-injector project name and spec plan wording for testing domain', () => {
  const result = classifyDomainsWithEvidence({
    number: 73,
    title: 'Spec-injector spec plan compiler wording',
    body: [
      'The deterministic spec compiler should preserve spec plan wording in docs.',
      'The issue-to-context compiler spec should not imply quality infrastructure work.',
      'Avoid changing prompt output, task packages, or runtime config.',
    ].join('\n'),
    labels: ['tooling', 'docs'],
    url: 'https://github.com/Erick52106/spec-injector/issues/73',
    state: 'open',
  });

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('testing'), `Expected testing to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'testing'), `Expected no testing evidence, got ${JSON.stringify(result.evidence)}`);
});

test('classifier keeps testing domain for legitimate testing evidence', () => {
  const result = classifyDomainsWithEvidence({
    number: 73,
    title: 'Add regression test coverage for classifier helpers',
    body: [
      'Add unit test and integration test cases for the deterministic classifier.',
      'Use node --test with a test helper and fixture data so the behavior stays offline.',
      'Keep pytest and jest wording classified as testing evidence when issues mention those runners.',
    ].join('\n'),
    labels: ['bug'],
    url: 'https://github.com/Erick52106/spec-injector/issues/73',
    state: 'open',
  });

  assert.ok(result.domains.includes('testing'), `Expected testing in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === 'test' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === 'fixture' && e.source === 'body'
  ));
});

test('classifier keeps testing domain for spec file patterns', () => {
  const result = classifyDomainsWithEvidence({
    number: 73,
    title: 'Classifier file pattern routing',
    body: [
      'Classify src/classifier/domain.spec.ts as a file pattern signal.',
      'Keep src/classifier/domain.test.ts aligned with the same path handling.',
    ].join('\n'),
    labels: ['bug'],
    url: 'https://github.com/Erick52106/spec-injector/issues/73',
    state: 'open',
  });

  assert.ok(result.domains.includes('testing'), `Expected testing in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === '.spec.ts' && e.source === 'body'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === '.test.ts' && e.source === 'body'
  ));
});

test('classifier stays deterministic when generic spec wording is rejected as testing evidence', () => {
  const issue = {
    number: 73,
    title: 'Roadmap spec for API specification docs',
    body: [
      'Draft the spec-injector roadmap spec and OpenAPI spec notes.',
      'Keep the compiler wording deterministic without adding runtime domains.',
    ].join('\n'),
    labels: ['api', 'docs'],
    url: 'https://github.com/Erick52106/spec-injector/issues/73',
    state: 'open' as const,
  };

  const first = classifyDomainsWithEvidence(issue);
  const second = classifyDomainsWithEvidence(issue);

  assert.deepEqual(first, second);
  assert.ok(!first.domains.includes('testing'), `Expected testing to be absent from ${first.domains.join(', ')}`);
  assert.ok(!first.evidence.some((e) => e.domain === 'testing'), `Expected no testing evidence, got ${JSON.stringify(first.evidence)}`);
  assert.ok(!first.rejected.some((r) => r.domain === 'testing'), `Expected no testing rejected reason, got ${JSON.stringify(first.rejected)}`);
  assert.ok(!first.rejected.some((r) => r.domain !== 'wallet' && r.domain !== 'smart-contract'));
});

test('classifier evidence result is deterministic across repeated calls', () => {
  const issue = {
    number: 91,
    title: 'Dashboard endpoint route transaction review',
    body: [
      'Update backend handler behavior for product transaction records.',
      'Keep frontend dashboard response rendering stable.',
    ].join('\n'),
    labels: ['api', 'backend'],
    url: 'https://github.com/Erick52106/spec-injector/issues/91',
    state: 'open' as const,
  };

  assert.deepEqual(classifyDomainsWithEvidence(issue), classifyDomainsWithEvidence(issue));
});

test('spec --help lists deterministic CLI purpose and available commands', async () => {
  const result = await runSpec(['--help']);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /deterministic/i);
  assert.match(result.stdout, /\binit\b/);
  assert.match(result.stdout, /\bvalidate\b/);
  assert.match(result.stdout, /\bplan\b/);
  assert.match(result.stdout, /\bconfig\b/);
  assert.match(result.stdout, /\bclean\b/);
  assert.match(result.stdout, /\bevidence-check\b/);
  assert.match(result.stdout, /\blabel-audit\b/);
  assert.match(result.stdout, /help \[command\]/i);
});

test('spec init and validate help explain created config files and validation expectations', async () => {
  const initHelp = await runSpec(['init', '--help']);
  assert.equal(initHelp.code, 0, initHelp.stderr);
  assert.match(initHelp.stdout, /\.spec-injector\/config\.json/);
  assert.match(initHelp.stdout, /\.spec-injector\/\.gitignore/);
  assert.match(initHelp.stdout, /does not create github actions workflow files/i);
  assert.match(initHelp.stdout, /does not modify runtime code/i);

  const validateHelp = await runSpec(['validate', '--help']);
  assert.equal(validateHelp.code, 0, validateHelp.stderr);
  assert.match(validateHelp.stdout, /\.spec-injector\/config\.json/);
  assert.match(validateHelp.stdout, /non-zero/i);
  assert.match(validateHelp.stdout, /spec init/i);
});

test('spec plan/config/clean help describe AI-facing usage and safety constraints', async () => {
  const planHelp = await runSpec(['plan', '--help']);
  assert.equal(planHelp.code, 0, planHelp.stderr);
  assert.match(planHelp.stdout, /gh cli/i);
  assert.match(planHelp.stdout, /dry-run/i);
  assert.match(planHelp.stdout, /do not write/i);
  assert.match(planHelp.stdout, /format prompt/i);
  assert.match(planHelp.stdout, /compact ai planning prompt/i);
  assert.match(planHelp.stdout, /--config <path>/);
  assert.match(planHelp.stdout, /external config file path/i);
  assert.match(planHelp.stdout, /verbose/i);
  assert.match(planHelp.stdout, /pipeline steps/i);
  assert.match(planHelp.stdout, /\.spec-injector\/out\/issue-<number>-task-package\.md/);

  const configHelp = await runSpec(['config', '--help']);
  assert.equal(configHelp.code, 0, configHelp.stderr);
  assert.match(configHelp.stdout, /always-read/i);
  assert.match(configHelp.stdout, /\blist\b/);
  assert.match(configHelp.stdout, /\badd\b/);
  assert.match(configHelp.stdout, /\bremove\b/);
  assert.match(configHelp.stdout, /\bsuggest\b/);
  assert.match(configHelp.stdout, /does not modify config/i);
  assert.match(configHelp.stdout, /add\/remove.*modify config/i);

  const cleanHelp = await runSpec(['clean', '--help']);
  assert.equal(cleanHelp.code, 0, cleanHelp.stderr);
  assert.match(cleanHelp.stdout, /generated task package/i);
  assert.match(cleanHelp.stdout, /issue-<number>-task-package\.md/);
  assert.match(cleanHelp.stdout, /does not remove .*config\.json/i);
  assert.match(cleanHelp.stdout, /unrelated files/i);
  assert.match(cleanHelp.stdout, /--issue <number>/);

  const preflightHelp = await runSpec(['preflight', '--help']);
  assert.equal(preflightHelp.code, 0, preflightHelp.stderr);
  assert.match(preflightHelp.stdout, /isolated worktree task execution/i);
  assert.match(preflightHelp.stdout, /expected branch/i);
  assert.match(preflightHelp.stdout, /expected worktree root/i);
  assert.match(preflightHelp.stdout, /target repo/i);
  assert.match(preflightHelp.stdout, /does not auto-fix/i);

  const evidenceCheckHelp = await runSpec(['evidence-check', '--help']);
  assert.equal(evidenceCheckHelp.code, 0, evidenceCheckHelp.stderr);
  assert.match(evidenceCheckHelp.stdout, /implementation evidence consistency/i);
  assert.match(evidenceCheckHelp.stdout, /--pr <number-or-url>/);
  assert.match(evidenceCheckHelp.stdout, /--expected-head <sha>/);
  assert.match(evidenceCheckHelp.stdout, /read-only guardrail/i);

  const labelAuditHelp = await runSpec(['label-audit', '--help']);
  assert.equal(labelAuditHelp.code, 0, labelAuditHelp.stderr);
  assert.match(labelAuditHelp.stdout, /label and milestone metadata audit/i);
  assert.match(labelAuditHelp.stdout, /--repo <owner\/name>/);
  assert.match(labelAuditHelp.stdout, /reports only/i);
  assert.match(labelAuditHelp.stdout, /does not create, rename, delete, or mutate/i);
});

test('spec label-audit forwards --limit to gh issue and pr list', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [],
    prs: [],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
    '--limit', '25',
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assert.match(ghLog, /issue list[\s\S]*--limit 25/);
  assert.match(ghLog, /pr list[\s\S]*--limit 25/);
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit passes for open issues with accepted type, area, status, layer, and milestone metadata', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 110,
      title: 'feat(workflow): add issue label audit for area/type/status taxonomy',
      url: `https://github.com/${'Erick52106/spec-injector'}/issues/110`,
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.match(result.stdout, /issue #110 has type metadata/i);
  assert.match(result.stdout, /issue #110 has area metadata/i);
  assert.match(result.stdout, /issue #110 has status metadata/i);
  assert.match(result.stdout, /issue #110 milestone matches layer label/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports multiple type labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 213,
      title: 'conflicting type labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/213',
      state: 'OPEN',
      labels: [
        { name: 'bug' },
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #213 has multiple type labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports more than three area labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 214,
      title: 'too many area labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/214',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'area:docs' },
        { name: 'area:cli' },
        { name: 'area:tooling' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #214 has too many area labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when open issues are missing area, status, or type metadata', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [
      {
        number: 201,
        title: 'missing area metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/201',
        state: 'OPEN',
        labels: [
          { name: 'enhancement' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 202,
        title: 'missing status metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/202',
        state: 'OPEN',
        labels: [
          { name: 'enhancement' },
          { name: 'area:workflow' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 203,
        title: 'missing type metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/203',
        state: 'OPEN',
        labels: [
          { name: 'area:workflow' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
    ],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #201 is missing a primary area label/i);
  assert.match(result.stdout, /issue #202 is missing a status label/i);
  assert.match(result.stdout, /issue #203 is missing a type or GitHub default equivalent label/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports conflicting active status labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 204,
      title: 'conflicting status labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/204',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'status:needs-design' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #204 has conflicting active status labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a closed completed issue lacks status:implemented', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 205,
      title: 'closed completed without implemented status',
      url: 'https://github.com/Erick52106/spec-injector/issues/205',
      state: 'CLOSED',
      stateReason: 'COMPLETED',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #205 is closed as completed without status:implemented/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit does not require status:implemented for issues closed as not planned', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 206,
      title: 'closed not planned without implemented status',
      url: 'https://github.com/Erick52106/spec-injector/issues/206',
      state: 'CLOSED',
      stateReason: 'NOT_PLANNED',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.match(result.stdout, /issue #206 is closed as not planned and does not require status:implemented/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit keeps accepted keep-as-is labels out of unknown-label warnings', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [
      {
        number: 207,
        title: 'keep-as-is chore issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/207',
        state: 'OPEN',
        labels: [
          { name: 'type:chore' },
          { name: 'area:tooling' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 208,
        title: 'keep-as-is ci issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/208',
        state: 'OPEN',
        labels: [
          { name: 'type:ci' },
          { name: 'area:ci' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 209,
        title: 'keep-as-is refactor issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/209',
        state: 'OPEN',
        labels: [
          { name: 'type:refactor' },
          { name: 'area:cli' },
          { name: 'status:ready' },
          { name: 'layer1 : Core Compiler' },
        ],
        milestone: { title: 'Layer 1 — Core Compiler' },
      },
    ],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.doesNotMatch(result.stdout, /unknown label/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns on unknown labels without suggesting automatic deletion', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 210,
      title: 'unknown label issue',
      url: 'https://github.com/Erick52106/spec-injector/issues/210',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
        { name: 'surprise:custom' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #210 uses unknown labels/i);
  assert.match(result.stdout, /surprise:custom/);
  assert.doesNotMatch(result.stdout, /\bdelete\b/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when an open ready issue has a non-draft PR but is not marked status:in-review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 211,
      title: 'ready issue with active review PR',
      url: 'https://github.com/Erick52106/spec-injector/issues/211',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
    prs: [{
      number: 311,
      title: 'feat(workflow): active review PR',
      url: 'https://github.com/Erick52106/spec-injector/pull/311',
      labels: [{ name: 'area:workflow' }],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
      closingIssuesReferences: [{ number: 211 }],
      isDraft: false,
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #211 may need status:in-review because open PR #311 is not draft/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a PR has a layer label but no milestone', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    prs: [{
      number: 312,
      title: 'workflow PR without milestone',
      url: 'https://github.com/Erick52106/spec-injector/pull/312',
      labels: [{ name: 'layer2 : Workflow Guardrails' }],
      milestone: null,
      closingIssuesReferences: [],
      isDraft: false,
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /PR #312 is missing a roadmap milestone/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a layer label has no configured milestone mapping', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 215,
      title: 'unmapped layer milestone issue',
      url: 'https://github.com/Erick52106/spec-injector/issues/215',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });
  const repoDir = await createTempRepo(t, 'spec-injector-label-audit-taxonomy-');
  await writeRepoFiles(repoDir, {
    'docs/label-taxonomy.md': [
      '# Minimal taxonomy',
      '',
      '- Type labels: `type:chore`, `type:ci`, `type:design`, `type:refactor`, `type:test`.',
      '- Area labels: `area:workflow`, `area:docs`, `area:cli`, `area:tooling`.',
      '- Status labels: `status:blocked`, `status:implemented`, `status:in-review`, `status:needs-design`, `status:ready`.',
      '- Layer labels: `layer1 : Core Compiler`, `layer2 : Workflow Guardrails`.',
      '- GitHub default / equivalent labels: `bug`, `documentation`, `enhancement`.',
    ].join('\n'),
    'docs/workflow.md': [
      '# Workflow',
      '',
      '- `Layer 1 — Core Compiler` / `layer1 : Core Compiler`: core compiler.',
    ].join('\n'),
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env, cwd: repoDir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #215 layer label has no configured roadmap milestone mapping/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports malformed gh output as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issueListCommand: {
      exitCode: 0,
      stdout: '{"not":"valid json"',
    },
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /could not parse gh issue list output/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports missing gh fields as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issueListCommand: {
      exitCode: 0,
      stdout: JSON.stringify([{
        number: 212,
        title: 'missing labels payload',
        url: 'https://github.com/Erick52106/spec-injector/issues/212',
        state: 'OPEN',
      }]),
    },
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /gh issue list output is missing required fields for issue #212/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports missing taxonomy markers as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [],
    prs: [],
  });
  const repoDir = await createTempRepo(t, 'spec-injector-label-audit-malformed-taxonomy-');
  await writeRepoFiles(repoDir, {
    'docs/label-taxonomy.md': [
      '# Broken taxonomy',
      '',
      '- Area labels: `area:workflow`.',
      '- Status labels: `status:ready`.',
      '- Layer labels: `layer2 : Workflow Guardrails`.',
      '- GitHub default / equivalent labels: `enhancement`.',
    ].join('\n'),
    'docs/workflow.md': [
      '# Workflow',
      '',
      '- `Layer 2 — Workflow Guardrails` / `layer2 : Workflow Guardrails`: workflow guardrails.',
    ].join('\n'),
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env, cwd: repoDir });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /could not parse accepted taxonomy markers/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec preflight passes for a clean dedicated worktree and avoids mutating git state', async (t) => {
  const fixture = await createPreflightFixture(t);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
    '--expected-worktree-root', path.dirname(fixture.worktreeDir),
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Preflight summary:\s+PASS/i);
  assert.match(result.stdout, /main repo worktree is clean/i);
  assert.match(result.stdout, /main repo is up to date with origin\/main/i);
  assert.match(result.stdout, /current worktree is dedicated/i);
  assert.match(result.stdout, /current worktree is clean/i);
  assert.match(result.stdout, new RegExp(escapeRegExp(fixture.branchName)));
  assert.equal(result.stderr, '');

  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight reports the actual main upstream ref in sync summaries', async (t) => {
  const fixture = await createPreflightFixture(t);
  await runCommand('git', ['remote', 'rename', 'origin', 'upstream'], fixture.mainRepoDir);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /main repo is up to date with upstream\/main/i);
  assert.doesNotMatch(result.stdout, /main repo is up to date with origin\/main/i);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight fails when the main repo worktree is not on main even if its upstream is current', async (t) => {
  const fixture = await createPreflightFixture(t);
  await runCommand('git', ['checkout', '-b', 'main-worktree-feature'], fixture.mainRepoDir);
  await runCommand('git', ['push', '--set-upstream', 'origin', 'main-worktree-feature'], fixture.mainRepoDir);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+FAIL/i);
  assert.match(result.stdout, /main repo worktree is not on main/i);
  assert.match(result.stdout, /found main-worktree-feature/i);
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight fails when implementation runs from the main worktree', async (t) => {
  const fixture = await createPreflightFixture(t);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.mainRepoDir,
    '--expected-branch', 'main',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+FAIL/i);
  assert.match(result.stdout, /current checkout is the main repo worktree/i);
  assert.match(result.stdout, /implementation must run from a dedicated worktree/i);
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight fails when the main repo worktree is dirty', async (t) => {
  const fixture = await createPreflightFixture(t);
  await fs.writeFile(path.join(fixture.mainRepoDir, 'main-dirty.txt'), 'dirty main\n', 'utf8');

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+FAIL/i);
  assert.match(result.stdout, /main repo worktree is dirty/i);
  assert.match(result.stdout, /stop and report/i);
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight fails when current branch does not match the expected branch', async (t) => {
  const fixture = await createPreflightFixture(t);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', 'feat/some-other-branch',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+FAIL/i);
  assert.match(result.stdout, /current branch does not match expected branch/i);
  assert.match(result.stdout, /feat\/some-other-branch/i);
  assert.match(result.stdout, new RegExp(escapeRegExp(fixture.branchName)));
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight fails when the dedicated worktree is dirty', async (t) => {
  const fixture = await createPreflightFixture(t);
  await fs.writeFile(path.join(fixture.worktreeDir, 'worktree-dirty.txt'), 'dirty worktree\n', 'utf8');

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+FAIL/i);
  assert.match(result.stdout, /current worktree is dirty/i);
  assert.match(result.stdout, /do not auto-stash, clean, or reset/i);
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight warns when the main repo has no upstream configured', async (t) => {
  const fixture = await createPreflightFixture(t, { withUpstream: false });

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Preflight summary:\s+WARNING/i);
  assert.match(result.stdout, /main repo has no upstream configured/i);
  assert.match(result.stdout, /needs human review/i);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
});

test('spec preflight exits non-zero when a check needs human review', async (t) => {
  const fixture = await createPreflightFixture(t);
  const targetRepoDir = await createTempRepo(t, 'spec-injector-target-status-failure-');
  await writeRepoFiles(targetRepoDir, {
    'README.md': '# Target Status Failure Fixture\n',
  });
  await initCleanGitRepo(targetRepoDir);
  const gitSpy = await createStatusFailingGitEnv(t, fixture.env, targetRepoDir);

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
    '--target-repo', targetRepoDir,
  ], { env: gitSpy.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Preflight summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /unable to determine target repo worktree state/i);
  assertNoRawStackTrace(result);
  const gitLog = (await readGhLog(gitSpy.logPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
  await assertFileMissing(path.join(targetRepoDir, '.spec-injector'));
});

test('spec preflight warns when the target repo is dirty and keeps the boundary read-only', async (t) => {
  const fixture = await createPreflightFixture(t);
  const targetRepoDir = await createTempRepo(t, 'spec-injector-target-repo-');
  await writeRepoFiles(targetRepoDir, {
    'README.md': '# Target Repo Fixture\n',
  });
  await initCleanGitRepo(targetRepoDir);
  await fs.writeFile(path.join(targetRepoDir, 'dirty-target.txt'), 'target repo dirty\n', 'utf8');

  const result = await runSpec([
    'preflight',
    '--repo', fixture.worktreeDir,
    '--expected-branch', fixture.branchName,
    '--target-repo', targetRepoDir,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Preflight summary:\s+WARNING/i);
  assert.match(result.stdout, /target repo is dirty/i);
  assert.match(result.stdout, /read-only only unless explicitly authorized/i);
  assert.match(result.stdout, /do not create or modify .*\.spec-injector/i);
  const gitLog = (await readGhLog(fixture.gitLogPath)).join('\n');
  assertNoGitMutationCommands(gitLog);
  await assertFileMissing(path.join(targetRepoDir, '.spec-injector'));
});

test('spec evidence-check passes for complete PR and issue evidence without mutating GitHub state', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--expected-head', fixture.headSha,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.match(result.stdout, /linked issue reference found/i);
  assert.match(result.stdout, /issue evidence comment exists/i);
  assert.match(result.stdout, /PR body HEAD matches latest PR head/i);
  assert.match(result.stdout, /validation evidence lists exact commands/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check accepts a full PR URL when --repo matches the encoded repository', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', `https://github.com/${fixture.repo}/pull/${fixture.prNumber}`,
    '--repo', fixture.repo,
    '--expected-head', fixture.headSha,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check accepts a full PR URL without requiring --repo', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', `https://github.com/${fixture.repo}/pull/${fixture.prNumber}`,
    '--expected-head', fixture.headSha,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when --repo conflicts with the repository encoded in a PR URL', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', `https://github.com/${fixture.repo}/pull/${fixture.prNumber}`,
    '--repo', 'owner-b/repo-b',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /--repo must match the repository encoded in --pr/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check still requires --repo when --pr is not a GitHub PR URL', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /--repo is required when --pr is not a GitHub PR URL/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when the PR body is missing the issue evidence URL', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /issue evidence URL is missing/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when --evidence-url is provided but PR body omits evidence URL', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--evidence-url', fixture.evidenceUrl,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /issue evidence URL is missing/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when PR body evidence URL differs from --evidence-url', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--evidence-url', 'https://github.com/Erick52106/spec-injector/issues/109#issuecomment-9999999',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /evidence URL does not match --evidence-url/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check accepts --evidence-url when it matches the PR body evidence URL', async (t) => {
  const fixture = await createEvidenceCheckFixture(t);

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--evidence-url', fixture.evidenceUrl,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.match(result.stdout, /evidence URL points to linked issue/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check does not let --issue satisfy a missing PR body closing reference', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    prBody: [
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--issue', '109',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /source issue reference is missing/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check prefers closing keyword issue over earlier bare issue mentions', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    prBody: [
      'Mention #110 as a non-goal.',
      '',
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'Do not handle #110.',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.match(result.stdout, /PR body linked issue .*#109/i);
  assert.doesNotMatch(result.stdout, /different issue/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when the evidence URL points to a different issue', async (t) => {
  const wrongEvidenceUrl = 'https://github.com/Erick52106/spec-injector/issues/999#issuecomment-1090001';
  const fixture = await createEvidenceCheckFixture(t, {
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      `- Issue evidence comment URL: ${wrongEvidenceUrl}`,
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /evidence URL points to a different issue/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails on stale PR body commit hash and expected HEAD mismatch', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
    '--expected-head', 'cccccccccccccccccccccccccccccccccccccccc',
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /expected HEAD does not match latest PR head/i);
  assert.match(result.stdout, /PR body HEAD is stale/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when issue evidence comment body is empty', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    issueComments: [{
      url: 'https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      body: '',
    }],
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /issue evidence comment is incomplete or stale/i);
  assert.match(result.stdout, /PR URL, branch, commit hash \/ HEAD, validation summary/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when issue evidence comment lacks required fields', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    issueComments: [{
      url: 'https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      body: [
        '## Implementation evidence',
        '- PR URL: https://github.com/Erick52106/spec-injector/pull/1091',
        '- Tests / validation:',
        '- `pnpm test` ✅',
      ].join('\n'),
    }],
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /issue evidence comment is incomplete or stale/i);
  assert.match(result.stdout, /branch, commit hash \/ HEAD/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check warns for vague validation evidence and draft PRs', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    isDraft: true,
    issueComments: [{
      url: 'https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      body: [
        '## Implementation evidence',
        '- PR URL: https://github.com/Erick52106/spec-injector/pull/1091',
        '- Branch: feat/pr-evidence-consistency-checker-109',
        '- Commit hash / HEAD: 1234567890abcdef1234567890abcdef12345678',
        '- Tests / validation: tests pass.',
      ].join('\n'),
    }],
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      'Tests pass.',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+WARNING/i);
  assert.match(result.stdout, /PR is draft/i);
  assert.match(result.stdout, /validation evidence needs exact commands/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check keeps empty successful checks distinct from checks read failures', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    checks: [],
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+WARNING/i);
  assert.match(result.stdout, /no checks returned/i);
  assert.doesNotMatch(result.stdout, /Could not read PR checks/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when checks command cannot be read', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    checksCommand: {
      exitCode: 1,
      stderr: 'checks API unavailable',
    },
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /Could not read PR checks/i);
  assert.doesNotMatch(result.stdout, /no checks returned/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails when checks command returns malformed JSON', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    checksCommand: {
      stdout: '{not-json',
    },
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /Could not read PR checks/i);
  assert.match(result.stdout, /Unexpected JSON output/i);
  assert.doesNotMatch(result.stdout, /no checks returned/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check fails failing CI and warns on pending checks', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    checks: [
      { name: 'build', state: 'COMPLETED', conclusion: 'FAILURE', bucket: 'fail' },
      { name: 'CodeRabbit', state: 'PENDING', conclusion: '', bucket: 'pending' },
    ],
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+FAIL/i);
  assert.match(result.stdout, /CI checks contain failures/i);
  assert.match(result.stdout, /checks are pending/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check requires review finding assessment when review findings exist', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    reviews: [
      { author: { login: 'coderabbitai' }, state: 'COMMENTED', body: 'Potential stale evidence finding.' },
    ],
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /review findings need assessment/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check treats approved actionable review body as needing assessment', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    reviews: [
      { author: { login: 'reviewer' }, state: 'APPROVED', body: 'Approved, but fix stale HEAD before merge.' },
    ],
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Evidence check summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /review findings need assessment/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check ignores non-actionable approved review text without requiring assessment', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    reviews: [
      { author: { login: 'reviewer' }, state: 'APPROVED', body: 'LGTM' },
    ],
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.doesNotMatch(result.stdout, /review findings need assessment/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check ignores commented summary-only bot wrapper without requiring assessment', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    reviews: [
      { author: { login: 'coderabbitai' }, state: 'COMMENTED', body: 'Walkthrough summary only. No actionable comments.' },
    ],
    prBody: [
      'Closes #109',
      '## Summary',
      'ok',
      '## Scope',
      'ok',
      '## Non-goals',
      'ok',
      '## Validation',
      '- `git diff --check` ✅',
      '- `pnpm build` ✅',
      '- `pnpm test` ✅',
      '## Implementation Evidence',
      '- Issue evidence comment URL: https://github.com/Erick52106/spec-injector/issues/109#issuecomment-1090001',
      '- Latest HEAD: 1234567890abcdef1234567890abcdef12345678',
    ].join('\n'),
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.doesNotMatch(result.stdout, /review findings need assessment/i);
  assert.doesNotMatch(result.stdout, /review finding assessment vocabulary found/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec evidence-check accepts actionable review body when assessment vocabulary exists', async (t) => {
  const fixture = await createEvidenceCheckFixture(t, {
    reviews: [
      { author: { login: 'coderabbitai' }, state: 'COMMENTED', body: 'Potential issue: fix stale evidence before merge.' },
    ],
  });

  const result = await runSpec([
    'evidence-check',
    '--pr', String(fixture.prNumber),
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Evidence check summary:\s+PASS/i);
  assert.match(result.stdout, /review finding assessment vocabulary found/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec init scaffolds config files with default discovery settings', async (t) => {
  const repoDir = await createTempRepo(t);

  const result = await runSpec(['init', '--repo', repoDir]);

  assert.equal(result.code, 0, result.stderr);

  const configPath = path.join(repoDir, '.spec-injector', 'config.json');
  const gitignorePath = path.join(repoDir, '.spec-injector', '.gitignore');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  assert.equal(typeof config, 'object');
  assert.deepEqual(config.always_read, []);
  assert.deepEqual(config.discovery.exclude, ['node_modules', 'dist', 'docs/superpowers']);
  assert.equal(await readFile(gitignorePath), 'out/\n');
});

test('spec validate succeeds for initialized repo and reports config summary', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /config\.json is valid/i);
  assert.match(result.stdout, /Project:/);
  assert.match(result.stdout, /Always-read:\s+0 file\(s\)/);
  assert.match(result.stdout, /Discovery/);
});

test('spec validate fails clearly when config is missing and does not create files', async (t) => {
  const repoDir = await createTempRepo(t);

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Run "spec init".*first|No \.spec-injector\/ directory found/i);
  assertNoRawStackTrace(result);
  await assertFileMissing(path.join(repoDir, '.spec-injector', 'config.json'));
  await assertFileMissing(path.join(repoDir, '.spec-injector', '.gitignore'));
});

test('spec validate fails clearly for invalid JSON config without raw stack traces', async (t) => {
  const repoDir = await createTempRepo(t);
  await writeRepoFiles(repoDir, {
    '.spec-injector/config.json': '{ invalid json\n',
  });

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Invalid config\.json: .*JSON|Unexpected token/i);
  assertNoRawStackTrace(result);
});

test('spec validate rejects unsupported config versions', async (t) => {
  const repoDir = await createTempRepo(t);
  await writeConfig(repoDir, { version: 999 });

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /version.*2|Expected version: 2|unsupported/i);
  assertNoRawStackTrace(result);
});

test('spec validate rejects malformed always_read values', async (t) => {
  const repoDir = await createTempRepo(t);
  await writeConfig(repoDir, {
    version: 2,
    always_read: 'docs/security.md',
  });

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /always_read must be an array/i);
  assertNoRawStackTrace(result);
});

test('spec validate rejects malformed discovery.exclude values', async (t) => {
  const repoDir = await createTempRepo(t);
  await writeConfig(repoDir, {
    version: 2,
    discovery: {
      exclude: 'docs/archive',
    },
  });

  const result = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /discovery\.exclude must be an array/i);
  assertNoRawStackTrace(result);
});

test('spec validate rejects malformed guardrails values and missing required fields', async (t) => {
  const repoDir = await createTempRepo(t);
  await writeConfig(repoDir, {
    version: 2,
    guardrails: [{ id: 'auth-review', when_detected: ['auth'] }],
  });

  const missingFieldResult = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(missingFieldResult.code, 0);
  assert.match(missingFieldResult.stderr, /guardrails\[0\]\.risk must be a string/i);
  assertNoRawStackTrace(missingFieldResult);

  await writeConfig(repoDir, {
    version: 2,
    guardrails: 'auth-review',
  });

  const notArrayResult = await runSpec(['validate', '--repo', repoDir]);

  assert.notEqual(notArrayResult.code, 0);
  assert.match(notArrayResult.stderr, /guardrails must be an array/i);
  assertNoRawStackTrace(notArrayResult);
});

test('spec config list/add/remove always-read manages config entries idempotently', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  const initialList = await runSpec(['config', 'list', '--repo', repoDir]);
  assert.equal(initialList.code, 0, initialList.stderr);
  assert.match(initialList.stdout, /No always_read files configured\./);

  const addResult = await runSpec(['config', 'add', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.equal(addResult.code, 0, addResult.stderr);
  assert.match(addResult.stdout, /Added always_read file: docs\/security\.md/);

  const configPath = path.join(repoDir, '.spec-injector', 'config.json');
  let config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(config.always_read, ['docs/security.md']);

  const duplicateAdd = await runSpec(['config', 'add', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.equal(duplicateAdd.code, 0, duplicateAdd.stderr);
  assert.match(duplicateAdd.stdout, /already includes: docs\/security\.md/);
  config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(config.always_read, ['docs/security.md']);

  const removeResult = await runSpec(['config', 'remove', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.equal(removeResult.code, 0, removeResult.stderr);
  assert.match(removeResult.stdout, /Removed always_read file: docs\/security\.md/);
  config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(config.always_read, []);

  const duplicateRemove = await runSpec(['config', 'remove', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.equal(duplicateRemove.code, 0, duplicateRemove.stderr);
  assert.match(duplicateRemove.stdout, /does not include: docs\/security\.md/);
});

test('config command handler lists always-read entries without direct process exit', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  const result = await captureConsoleOutput(async () => {
    await runConfigCommand('list', undefined, undefined, { repo: repoDir });
  });

  assert.equal(result.stderr, '');
  assert.match(result.stdout, /No always_read files configured\./);
});

test('config command handler throws catchable errors for invalid arguments', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  await assert.rejects(
    runConfigCommand('add', 'always-read', undefined, { repo: repoDir }),
    /Missing path\. Usage: spec config add always-read <path> --repo <repo>/
  );
});

test('spec config suggest always-read scans fixed and scoring candidates with stable grouped output', async (t) => {
  const repoDir = await createTempRepo(t);

  await writeRepoFiles(repoDir, {
    'CLAUDE.md': '# Claude\n',
    'AGENTS.md': '# Agents\n',
    'GEMINI.md': '# Gemini\n',
    'README.md': '# Overview\n\nDevelopment workflow and project overview.\n',
    'docs/security.md': '# Security\n\nDo not bypass guardrails.\n',
    'docs/architecture.md': '# Architecture\n\nSystem architecture overview.\n',
    'docs/engineering-guidelines.md': '# Engineering Guidelines\n\nDevelopers should follow conventions and workflow guidance.\n',
    'docs/backend-principles.md': '# Backend Principles\n\nCoding conventions and policy notes.\n',
    'docs/payment-architecture.md': '# Payment Architecture\n\nArchitecture and security constraints.\n',
    'docs/team-conventions.md': '# Team Conventions\n\nTeam workflow and development conventions.\n',
    '.github/copilot-instructions.md': '# AI Instructions\n\nCopilot should follow repository conventions.\n',
    '.cursor/rules/spec-injector.md': 'Always follow workflow guardrails.\n',
    '.windsurf/rules.md': '# Workflow\n\nDo not ignore policy.\n',
    'docs/superpowers/plans/test.md': '# Plan\n',
    'docs/archive/old-architecture.md': '# Architecture\n',
    'archive/old-guidelines.md': '# Guidelines\n',
    '.spec-injector/out/issue-1-task-package.md': '# Generated\n',
    'node_modules/noise.md': '# Noise\n',
    'dist/generated.md': '# Generated\n',
    'build/generated.md': '# Generated\n',
    'CHANGELOG.md': '# Changelog\n',
    'docs/meeting-notes.md': '# Meeting Notes\n',
    'docs/tmp-draft.md': '# Draft\n',
  });

  const result = await runSpec(['config', 'suggest', 'always-read', '--repo', repoDir]);
  const secondResult = await runSpec(['config', 'suggest', 'always-read', '--repo', repoDir]);

  assert.equal(result.code, 0, result.stderr);
  assert.equal(secondResult.code, 0, secondResult.stderr);
  assert.equal(secondResult.stdout, result.stdout);
  assert.match(result.stdout, /High confidence:/);
  assert.match(result.stdout, /Medium confidence:/);
  assert.match(result.stdout, /Ignored \/ excluded:/);
  assert.match(result.stdout, /No changes were made to \.spec-injector\/config\.json\./);

  for (const file of [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    'README.md',
    'docs/security.md',
    'docs/architecture.md',
    'docs/engineering-guidelines.md',
    'docs/backend-principles.md',
    'docs/payment-architecture.md',
    'docs/team-conventions.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/spec-injector.md',
    '.windsurf/rules.md',
  ]) {
    assert.match(result.stdout, new RegExp(escapeRegExp(file)));
  }

  for (const file of [
    'docs/superpowers/plans/test.md',
    'docs/archive/old-architecture.md',
    'archive/old-guidelines.md',
    '.spec-injector/out/issue-1-task-package.md',
    'node_modules/noise.md',
    'dist/generated.md',
    'build/generated.md',
    'CHANGELOG.md',
    'docs/meeting-notes.md',
    'docs/tmp-draft.md',
  ]) {
    assert.doesNotMatch(result.stdout, new RegExp(`\\n\\s*${escapeRegExp(file)}\\s+—`));
  }

  assert.match(result.stdout, /\n\s*docs\/archive\/\s+—/);
  assert.match(result.stdout, /\n\s*docs\/superpowers\/\s+—/);
  assert.match(result.stdout, /\n\s*archive\/\s+—/);
  assert.match(result.stdout, /\n\s*\.spec-injector\/out\/\s+—/);
  assert.match(result.stdout, /\n\s*node_modules\/\s+—/);
  assert.match(result.stdout, /\n\s*dist\/\s+—/);
  assert.match(result.stdout, /\n\s*build\/\s+—/);

  assert.equal(countOccurrences(result.stdout, 'README.md'), 1);
  assert.equal(countOccurrences(result.stdout, 'docs/architecture.md'), 1);

  const readmeIndex = result.stdout.indexOf('README.md');
  const cursorIndex = result.stdout.indexOf('.cursor/rules/spec-injector.md');
  assert.notEqual(readmeIndex, -1);
  assert.notEqual(cursorIndex, -1);
  assert.ok(cursorIndex < readmeIndex, result.stdout);

  await assert.rejects(fs.access(path.join(repoDir, '.spec-injector', 'config.json')));
});

test('spec config suggest always-read does not modify initialized config', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);
  await writeRepoFiles(repoDir, {
    'README.md': '# Overview\n',
    'docs/payment-architecture.md': '# Payment Architecture\n\nArchitecture workflow.\n',
  });

  const configPath = path.join(repoDir, '.spec-injector', 'config.json');
  const before = await fs.readFile(configPath, 'utf8');

  const result = await runSpec(['config', 'suggest', 'always-read', '--repo', repoDir]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /docs\/payment-architecture\.md/);
  assert.equal(await fs.readFile(configPath, 'utf8'), before);
});

test('spec clean removes generated task packages and preserves unrelated files', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);
  await writeFiles(repoDir, [
    '.spec-injector/out/issue-1-task-package.md',
    '.spec-injector/out/issue-2-task-package.md',
    '.spec-injector/out/unrelated.txt',
  ]);

  const cleanAll = await runSpec(['clean', '--repo', repoDir]);
  assert.equal(cleanAll.code, 0, cleanAll.stderr);
  assert.match(cleanAll.stdout, /Removed 2 generated task package\(s\):/);

  await assertFileMissing(path.join(repoDir, '.spec-injector', 'out', 'issue-1-task-package.md'));
  await assertFileMissing(path.join(repoDir, '.spec-injector', 'out', 'issue-2-task-package.md'));
  await assertFileExists(path.join(repoDir, '.spec-injector', 'out', 'unrelated.txt'));
  await assertFileExists(path.join(repoDir, '.spec-injector', 'config.json'));
  await assertFileExists(path.join(repoDir, '.spec-injector', '.gitignore'));

  await writeFiles(repoDir, [
    '.spec-injector/out/issue-1-task-package.md',
    '.spec-injector/out/issue-2-task-package.md',
  ]);

  const cleanOne = await runSpec(['clean', '--repo', repoDir, '--issue', '1']);
  assert.equal(cleanOne.code, 0, cleanOne.stderr);
  assert.match(cleanOne.stdout, /Removed generated task package: \.spec-injector\/out\/issue-1-task-package\.md/);

  await assertFileMissing(path.join(repoDir, '.spec-injector', 'out', 'issue-1-task-package.md'));
  await assertFileExists(path.join(repoDir, '.spec-injector', 'out', 'issue-2-task-package.md'));
  await assertFileExists(path.join(repoDir, '.spec-injector', 'out', 'unrelated.txt'));
});

test('invalid config subcommands fail with non-zero exit codes', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  const invalidSuggest = await runSpec(['config', 'suggest', 'unknown', '--repo', repoDir]);
  assert.notEqual(invalidSuggest.code, 0);
  assertNoRawStackTrace(invalidSuggest);

  const invalidListSection = await runSpec(['config', 'list', 'unknown', '--repo', repoDir]);
  assert.notEqual(invalidListSection.code, 0);
  assertNoRawStackTrace(invalidListSection);

  const invalidListPath = await runSpec(['config', 'list', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.notEqual(invalidListPath.code, 0);
  assertNoRawStackTrace(invalidListPath);

  const invalidAddSection = await runSpec(['config', 'add', 'unknown', 'docs/security.md', '--repo', repoDir]);
  assert.notEqual(invalidAddSection.code, 0);
  assertNoRawStackTrace(invalidAddSection);

  const invalidRemoveSection = await runSpec(['config', 'remove', 'unknown', 'docs/security.md', '--repo', repoDir]);
  assert.notEqual(invalidRemoveSection.code, 0);
  assertNoRawStackTrace(invalidRemoveSection);
});

test('invalid CLI arguments fail with non-zero exit codes and stable messaging', async (t) => {
  const repoDir = await createTempRepo(t);
  await runSpec(['init', '--repo', repoDir]);

  const addMissingPath = await runSpec(['config', 'add', 'always-read', '--repo', repoDir]);
  assert.notEqual(addMissingPath.code, 0);
  assert.match(addMissingPath.stderr, /Missing path|Usage: spec config add always-read <path>/i);
  assertNoRawStackTrace(addMissingPath);

  const removeMissingPath = await runSpec(['config', 'remove', 'always-read', '--repo', repoDir]);
  assert.notEqual(removeMissingPath.code, 0);
  assert.match(removeMissingPath.stderr, /Missing path|Usage: spec config remove always-read <path>/i);
  assertNoRawStackTrace(removeMissingPath);

  const cleanInvalidIssue = await runSpec(['clean', '--repo', repoDir, '--issue', 'not-a-number']);
  assert.notEqual(cleanInvalidIssue.code, 0);
  assert.match(cleanInvalidIssue.stderr, /issue number|--issue/i);
  assertNoRawStackTrace(cleanInvalidIssue);
});

test('commands fail clearly when repo path does not exist', async () => {
  const missingRepo = createMissingPath();

  const validateResult = await runSpec(['validate', '--repo', missingRepo]);
  assert.notEqual(validateResult.code, 0);
  assert.match(validateResult.stderr, /repo path does not exist|No such file or directory|Run "spec init"/i);
  assertNoRawStackTrace(validateResult);

  const configListResult = await runSpec(['config', 'list', '--repo', missingRepo]);
  assert.notEqual(configListResult.code, 0);
  assert.match(configListResult.stderr, /repo path does not exist|No \.spec-injector\/config\.json/i);
  assertNoRawStackTrace(configListResult);

  const cleanResult = await runSpec(['clean', '--repo', missingRepo]);
  assert.notEqual(cleanResult.code, 0);
  assert.match(cleanResult.stderr, /repo path does not exist|No such file or directory/i);
  assertNoRawStackTrace(cleanResult);
});

test('commands support repo paths containing spaces', async (t) => {
  const repoDir = await createTempRepo(t, 'spec injector validation test ');

  const initResult = await runSpec(['init', '--repo', repoDir]);
  assert.equal(initResult.code, 0, initResult.stderr);

  const validateResult = await runSpec(['validate', '--repo', repoDir]);
  assert.equal(validateResult.code, 0, validateResult.stderr);

  const addResult = await runSpec(['config', 'add', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.equal(addResult.code, 0, addResult.stderr);
  assert.match(addResult.stdout, /Added always_read file: docs\/security\.md/);

  const config = JSON.parse(await fs.readFile(path.join(repoDir, '.spec-injector', 'config.json'), 'utf8'));
  assert.deepEqual(config.always_read, ['docs/security.md']);
});

test('spec plan dry-run full output uses mocked gh data and keeps task package on stdout only', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Issue #57 fetched: Add backend auth database fixture plan coverage/);
  assert.match(result.stdout, /Detected domains: .*auth/);
  assert.match(result.stdout, /Detected domains: .*database/);
  assert.match(result.stdout, /Guardrails matched: auth-review, db-migration/);
  assert.match(result.stdout, /# Task Package: Add backend auth database fixture plan coverage/);
  assertOrderedSubstrings(result.stdout, [
    '# Task Package:',
    '## 1. Issue',
    '## 2. Classification',
    '## 3. Always-Read Files',
    '## 4. Issue-Mentioned Documentation',
    '## 5. Issue-Mentioned Source Files',
    '## 6. Auto-Discovered Documentation',
    '## 7. Auto-Discovered Source Files',
    '## 8. Matched Guardrails',
    '## 9. Missing Files',
  ]);
  assert.match(result.stdout, /### docs\/always-read\.md/);
  assert.match(result.stdout, /### presets\/core\/ai-collaboration\.md/);
  assert.match(result.stdout, /### docs\/auth-runbook\.md/);
  assert.match(result.stdout, /### src\/auth-handler\.ts/);
  assert.match(result.stdout, /\*\*auth-review\*\*: Require auth reviewer before changing login or permission flows\./);
  assert.match(result.stdout, /- `docs\/missing-handbook\.md` — not found/);
  assert.doesNotMatch(result.stdout, /## 8\. Implementation Constraints/);
  assert.doesNotMatch(result.stdout, /Implementation Constraints:\s*\(none\)/);
  assert.doesNotMatch(result.stdout, UNREPLACED_TEMPLATE_PLACEHOLDER_PATTERN);
  assert.doesNotMatch(result.stdout, /issue-57-task-package\.md/);
  await assertFileMissing(fixture.taskPackagePath);
  assert.deepEqual(await readGhLog(fixture.ghLogPath), [
    'issue view 57 --repo Erick52106/spec-injector --json number,title,body,labels,url,state',
  ]);
});

test('spec plan keeps default target repo config behavior without --config', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /### docs\/always-read\.md/);
  assert.match(result.stdout, /ALWAYS_READ_LONG_BODY_SENTINEL/);
  assert.match(result.stdout, /Require auth reviewer before changing login or permission flows\./);
  await assertFileMissing(fixture.taskPackagePath);
});

test('spec plan reads external config outside target repo without modifying target repo', async (t) => {
  const fixture = await createExternalConfigPlanFixture(t);
  const beforeSnapshot = await readDirectorySnapshot(fixture.repoDir);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--config', fixture.configPath, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /### docs\/external-always\.md/);
  assert.match(result.stdout, /EXTERNAL_ALWAYS_READ_SENTINEL/);
  assert.match(result.stdout, /\*\*external-auth-review\*\*: External config guardrail for read-only dogfood\./);
  assert.doesNotMatch(result.stderr, /No \.spec-injector\/ directory found/i);
  await assertFileMissing(path.join(fixture.repoDir, '.spec-injector'));
  assert.deepEqual(await readDirectorySnapshot(fixture.repoDir), beforeSnapshot);
});

test('spec plan reports missing external config path clearly without falling back to target config', async (t) => {
  const fixture = await createExternalConfigPlanFixture(t);
  const missingConfigPath = path.join(path.dirname(fixture.configPath), 'missing-config.json');

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--config', missingConfigPath, '--dry-run'],
    { env: fixture.env }
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /External config file not found/i);
  assert.match(result.stderr, new RegExp(escapeRegExp(missingConfigPath)));
  assert.doesNotMatch(result.stderr, /No \.spec-injector\/ directory found/i);
  assertNoRawStackTrace(result);
  await assertFileMissing(path.join(fixture.repoDir, '.spec-injector'));
});

test('spec plan reports invalid external config clearly without requiring target config', async (t) => {
  const fixture = await createExternalConfigPlanFixture(t);
  const invalidConfigPath = path.join(path.dirname(fixture.configPath), 'invalid-config.json');
  await fs.writeFile(invalidConfigPath, '{ invalid json\n', 'utf8');

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--config', invalidConfigPath, '--dry-run'],
    { env: fixture.env }
  );

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /Invalid config\.json/i);
  assert.match(result.stderr, new RegExp(escapeRegExp(invalidConfigPath)));
  assert.doesNotMatch(result.stderr, /No \.spec-injector\/ directory found/i);
  assertNoRawStackTrace(result);
  await assertFileMissing(path.join(fixture.repoDir, '.spec-injector'));
});

test('spec plan dry-run prompt output stays compact and omits long inline docs', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt', '--verbose'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /# Implementation Plan Prompt: Add backend auth database fixture plan coverage/);
  assertOrderedSubstrings(result.stdout, [
    '# Implementation Plan Prompt:',
    '## 1. Issue Summary',
    '## 2. Detected Domains',
    '## 3. Guardrails',
    '## 4. Relevant File References',
    '### Always-Read Files',
    '### Issue-Mentioned Docs',
    '### Issue-Mentioned Source Files',
    '### Auto-Discovered Docs',
    '### Rule-Matched Docs',
    '### Auto-Discovered Source Files',
    '## 5. Missing Files',
    '## 6. Instructions',
  ]);
  assert.match(result.stdout, /- `docs\/always-read\.md`/);
  assert.match(result.stdout, /- `presets\/core\/ai-collaboration\.md`/);
  assert.match(result.stdout, /- `docs\/auth-runbook\.md`/);
  assert.match(result.stdout, /- `docs\/database-guardrail\.md`/);
  assert.match(result.stdout, /- `src\/auth-handler\.ts`/);
  assert.match(result.stdout, /- `docs\/missing-handbook\.md` — not found/);
  assert.doesNotMatch(result.stdout, /# Task Package:/);
  assert.doesNotMatch(result.stdout, /## 3\. Always-Read Files/);
  assert.doesNotMatch(result.stdout, /### docs\/always-read\.md/);
  assert.doesNotMatch(result.stdout, /ALWAYS_READ_LONG_BODY_SENTINEL/);
  assert.doesNotMatch(result.stdout, /DISCOVERED_DOC_LONG_BODY_SENTINEL/);
  assert.doesNotMatch(result.stdout, /SOURCE_SNIPPET_BODY_SENTINEL/);
  assert.doesNotMatch(result.stdout, UNREPLACED_TEMPLATE_PLACEHOLDER_PATTERN);
  await assertFileMissing(fixture.taskPackagePath);
});

test('template renderer rejects unreplaced placeholders in full and prompt templates deterministically', () => {
  const fullTemplate = [
    '# Broken Task Package',
    '',
    '{{issue_title}}',
    '{{missing_section}}',
    '__MISSING_TOKEN__',
  ].join('\n');
  const promptTemplate = [
    '# Broken Implementation Plan Prompt',
    '',
    '{{issue_title}}',
    '{{prompt_missing_section}}',
  ].join('\n');
  const vars = {
    issue_title: 'Detect placeholder leakage',
  };

  assert.throws(
    () => renderTemplate(fullTemplate, vars),
    /Template rendering issue: unreplaced placeholder\(s\): __MISSING_TOKEN__, \{\{missing_section\}\}/
  );
  assert.throws(
    () => renderTemplate(fullTemplate, vars),
    /Template rendering issue: unreplaced placeholder\(s\): __MISSING_TOKEN__, \{\{missing_section\}\}/
  );
  assert.throws(
    () => renderTemplate(promptTemplate, vars),
    /Template rendering issue: unreplaced placeholder\(s\): \{\{prompt_missing_section\}\}/
  );
});

test('template renderer allows common Markdown braces and non-placeholder code syntax', () => {
  const rendered = renderTemplate([
    '# {{issue_title}}',
    '',
    '{{issue_body}}',
  ].join('\n'), {
    issue_title: 'Normal syntax examples',
    issue_body: [
      'Use object literals like `{ enabled: true }` in examples.',
      'Shell commands may include `echo ${HOME}`.',
      'Paths such as `apps/dashboard/src/providers/__tests__/dataProvider.test.ts` are normal source paths.',
    ].join('\n'),
  });

  assert.match(rendered, /Normal syntax examples/);
  assert.match(rendered, /\{ enabled: true \}/);
  assert.match(rendered, /\$\{HOME\}/);
  assert.match(rendered, /__tests__/);
});

test('spec plan distinguishes built-in preset references from repo always_read references', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptAlwaysReadSection = sectionBetween(promptResult.stdout, '### Always-Read Files', '### Issue-Mentioned Docs');
  assertOrderedSubstrings(promptAlwaysReadSection, [
    '- `docs/always-read.md` — repo always_read',
    '- `presets/core/ai-collaboration.md` — built-in preset',
  ]);
  assert.doesNotMatch(promptAlwaysReadSection, /docs\/always-read\.md` — built-in preset/);
  assert.doesNotMatch(promptAlwaysReadSection, /presets\/core\/ai-collaboration\.md` — repo always_read/);

  const fullAlwaysReadSection = sectionBetween(fullResult.stdout, '## 3. Always-Read Files', '## 4. Issue-Mentioned Documentation');
  assertOrderedSubstrings(fullAlwaysReadSection, [
    '### docs/always-read.md\n\n_source: repo always_read_',
    '### presets/core/ai-collaboration.md\n\n_source: built-in preset_',
  ]);
  assert.doesNotMatch(fullAlwaysReadSection, /### docs\/always-read\.md\n\n_source: built-in preset_/);
  assert.doesNotMatch(fullAlwaysReadSection, /### presets\/core\/ai-collaboration\.md\n\n_source: repo always_read_/);
});

test('spec plan separates issue-mentioned references from auto-discovered references deterministically', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 84,
    title: 'Separate payment refund issue references from auto discovery',
    bodyLines: [
      'Payment refund work needs explicit issue references and supporting auto discovery.',
      'Relevant files:',
      '- `docs/issue-contract.md`',
      '- `src/issue-handler.ts`',
      '- `docs/duplicate-ref.md`',
    ],
    repoFiles: {
      'docs/issue-contract.md': '# Issue Contract\n\nISSUE_MENTIONED_DOC_SENTINEL payment refund\n',
      'docs/payment-runbook.md': '# Payment Runbook\n\nAUTO_DISCOVERED_DOC_SENTINEL payment refund operations\n',
      'docs/duplicate-ref.md': '# Duplicate Ref\n\nDUPLICATE_ISSUE_DOC_SENTINEL payment refund\n',
      'src/issue-handler.ts': 'export const issueHandler = "ISSUE_MENTIONED_SOURCE_SENTINEL payment refund";\n',
      'src/payment-worker.ts': 'export const paymentWorker = "AUTO_DISCOVERED_SOURCE_SENTINEL payment refund";\n',
    },
  });

  const promptFirst = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const promptSecond = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullFirst = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });
  const fullSecond = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptFirst.code, 0, promptFirst.stderr);
  assert.equal(promptSecond.code, 0, promptSecond.stderr);
  assert.equal(fullFirst.code, 0, fullFirst.stderr);
  assert.equal(fullSecond.code, 0, fullSecond.stderr);
  assert.equal(normalizePlanOutput(promptSecond.stdout), normalizePlanOutput(promptFirst.stdout));
  assert.equal(normalizePlanOutput(fullSecond.stdout), normalizePlanOutput(fullFirst.stdout));

  assertOrderedSubstrings(promptFirst.stdout, [
    '### Always-Read Files',
    '### Issue-Mentioned Docs',
    '### Issue-Mentioned Source Files',
    '### Auto-Discovered Docs',
    '### Rule-Matched Docs',
    '### Auto-Discovered Source Files',
  ]);
  const promptIssueDocs = sectionBetween(promptFirst.stdout, '### Issue-Mentioned Docs', '### Issue-Mentioned Source Files');
  const promptIssueSources = sectionBetween(promptFirst.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptAutoDocs = sectionBetween(promptFirst.stdout, '### Auto-Discovered Docs', '### Rule-Matched Docs');
  const promptAutoSources = sectionBetween(promptFirst.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');

  assert.match(promptIssueDocs, /`docs\/issue-contract\.md` — issue-mentioned; mentioned in issue/);
  assert.match(promptIssueDocs, /`docs\/duplicate-ref\.md` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptIssueDocs, /auto-discovered/);
  assert.match(promptIssueSources, /`src\/issue-handler\.ts` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptIssueSources, /auto-discovered/);
  assert.match(promptAutoDocs, /`docs\/payment-runbook\.md` — auto-discovered/);
  assert.doesNotMatch(promptAutoDocs, /issue-mentioned|mentioned in issue|docs\/issue-contract\.md|docs\/duplicate-ref\.md/);
  assert.match(promptAutoSources, /`src\/payment-worker\.ts` — auto-discovered/);
  assert.doesNotMatch(promptAutoSources, /issue-mentioned|mentioned in issue|src\/issue-handler\.ts/);

  assertOrderedSubstrings(fullFirst.stdout, [
    '## 3. Always-Read Files',
    '## 4. Issue-Mentioned Documentation',
    '## 5. Issue-Mentioned Source Files',
    '## 6. Auto-Discovered Documentation',
    '## 7. Auto-Discovered Source Files',
    '## 8. Matched Guardrails',
    '## 9. Missing Files',
  ]);
  const fullIssueDocs = sectionBetween(fullFirst.stdout, '## 4. Issue-Mentioned Documentation', '## 5. Issue-Mentioned Source Files');
  const fullIssueSources = sectionBetween(fullFirst.stdout, '## 5. Issue-Mentioned Source Files', '## 6. Auto-Discovered Documentation');
  const fullAutoDocs = sectionBetween(fullFirst.stdout, '## 6. Auto-Discovered Documentation', '## 7. Auto-Discovered Source Files');
  const fullAutoSources = sectionBetween(fullFirst.stdout, '## 7. Auto-Discovered Source Files', '## 8. Matched Guardrails');

  assert.match(fullIssueDocs, /### docs\/issue-contract\.md\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.match(fullIssueDocs, /### docs\/duplicate-ref\.md\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.doesNotMatch(fullIssueDocs, /auto-discovered/);
  assert.match(fullIssueSources, /### src\/issue-handler\.ts\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.doesNotMatch(fullIssueSources, /auto-discovered/);
  assert.match(fullAutoDocs, /### docs\/payment-runbook\.md\n\n_source: auto-discovered_/);
  assert.doesNotMatch(fullAutoDocs, /issue-mentioned|mentioned in issue|docs\/issue-contract\.md|docs\/duplicate-ref\.md/);
  assert.match(fullAutoSources, /### src\/payment-worker\.ts\n\n_source: auto-discovered_/);
  assert.doesNotMatch(fullAutoSources, /issue-mentioned|mentioned in issue|src\/issue-handler\.ts/);
  assert.equal(countOccurrences(promptFirst.stdout, 'docs/duplicate-ref.md'), 1);
  assert.equal(countOccurrences(fullFirst.stdout, '### docs/duplicate-ref.md'), 1);
});

test('spec plan surfaces checkout implementation references for add-to-cart server action issues', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 165,
    title: 'Add-to-cart server action should call checkoutLinesAdd mutation',
    bodyLines: [
      'Fix the add-to-cart server action for PDP variant selection.',
      'The server action should create or reuse a checkout line and call the checkoutLinesAdd GraphQL mutation.',
      'Relevant PDP files:',
      '- `src/ui/components/pdp/add-to-cart.tsx`',
      '- `src/ui/components/pdp/variant-section-dynamic.tsx`',
    ],
    config: {
      discovery: {
        source: ['src'],
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/add-to-cart.tsx': 'export async function addToCart() { return "PDP_ADD_TO_CART_SENTINEL"; }\n',
      'src/ui/components/pdp/variant-section-dynamic.tsx': 'export const variantSection = "PDP_VARIANT_SENTINEL";\n',
      'src/lib/checkout.ts': 'export async function addCheckoutLine() { return "CHECKOUT_HELPER_SENTINEL checkoutLinesAdd server action"; }\n',
      'src/lib/graphql.ts': 'export async function storefrontGraphql() { return "GRAPHQL_HELPER_SENTINEL GraphQL mutation client"; }\n',
      'src/graphql/CheckoutAddLine.graphql': 'mutation CheckoutAddLine($checkoutId: ID!) { checkoutLinesAdd(checkoutId: $checkoutId) { checkout { id } } }\n',
      'src/graphql/generated/storefront.ts': 'export const generatedStorefrontTypes = "GENERATED_GRAPHQL_SENTINEL checkoutLinesAdd";\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptAutoSources = sectionBetween(promptResult.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');
  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/add-to-cart\.tsx` — issue-mentioned; mentioned in issue/);
  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.match(promptAutoSources, /`src\/lib\/checkout\.ts` — auto-discovered/);
  assert.match(promptAutoSources, /`src\/lib\/graphql\.ts` — auto-discovered/);
  assert.match(promptAutoSources, /`src\/graphql\/CheckoutAddLine\.graphql` — auto-discovered/);
  assert.doesNotMatch(promptAutoSources, /src\/graphql\/generated\/storefront\.ts/);

  const fullAutoSources = sectionBetween(fullResult.stdout, '## 7. Auto-Discovered Source Files', '## 8. Matched Guardrails');
  assert.match(fullAutoSources, /### src\/lib\/checkout\.ts/);
  assert.match(fullAutoSources, /CHECKOUT_HELPER_SENTINEL/);
  assert.match(fullAutoSources, /### src\/lib\/graphql\.ts/);
  assert.match(fullAutoSources, /GRAPHQL_HELPER_SENTINEL/);
  assert.match(fullAutoSources, /### src\/graphql\/CheckoutAddLine\.graphql/);
  assert.doesNotMatch(fullAutoSources, /GENERATED_GRAPHQL_SENTINEL/);
});

test('spec plan keeps generated GraphQL files out of auto-discovered source output', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 1665,
    title: 'Add-to-cart checkoutLinesAdd GraphQL mutation follow-up',
    bodyLines: [
      'Use the add-to-cart server action to call checkoutLinesAdd GraphQL mutation.',
      'Do not rely on generated GraphQL output as implementation context.',
    ],
    config: {
      discovery: {
        source: ['src'],
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/lib/checkout.ts': 'export const checkoutHelper = "CHECKOUT_HELPER_SENTINEL checkoutLinesAdd";\n',
      'src/lib/graphql.ts': 'export const graphqlHelper = "GRAPHQL_HELPER_SENTINEL GraphQL mutation";\n',
      'src/graphql/CheckoutAddLine.graphql': 'mutation CheckoutAddLine { checkoutLinesAdd { checkout { id } } }\n',
      'src/graphql/generated/storefront.ts': 'export const generatedStorefrontTypes = "GENERATED_GRAPHQL_SENTINEL checkoutLinesAdd mutation";\n',
      'src/graphql/__generated__/CheckoutAddLine.generated.ts': 'export const generatedCheckoutMutation = "GENERATED_CHECKOUT_LINE_SENTINEL checkoutLinesAdd";\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptAutoSources = sectionBetween(promptResult.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');
  assert.match(promptAutoSources, /src\/graphql\/CheckoutAddLine\.graphql/);
  assert.doesNotMatch(promptAutoSources, /src\/graphql\/generated\/storefront\.ts/);
  assert.doesNotMatch(promptAutoSources, /src\/graphql\/__generated__\/CheckoutAddLine\.generated\.ts/);
  assert.doesNotMatch(fullResult.stdout, /GENERATED_GRAPHQL_SENTINEL|GENERATED_CHECKOUT_LINE_SENTINEL/);
});

test('spec plan bounds checkout discovery without broad payment over-inclusion', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 265,
    title: 'Add-to-cart server action should add checkout line',
    bodyLines: [
      'Fix PDP add-to-cart so the server action adds the selected variant as a checkout line.',
      'The implementation should call the checkoutLinesAdd GraphQL mutation.',
    ],
    config: {
      discovery: {
        source: ['src'],
        max_source_files: 3,
      },
    },
    repoFiles: {
      'src/lib/checkout.ts': 'export async function checkoutLineHelper() { return "CHECKOUT_HELPER_SENTINEL checkoutLinesAdd"; }\n',
      'src/lib/graphql.ts': 'export async function graphqlClient() { return "GRAPHQL_HELPER_SENTINEL GraphQL mutation"; }\n',
      'src/graphql/CheckoutAddLine.graphql': 'mutation CheckoutAddLine { checkoutLinesAdd { checkout { id } } }\n',
      'src/checkout/payment-step.ts': 'export const paymentStep = "PAYMENT_STEP_SENTINEL checkout payment billing invoice";\n',
      'src/docs/checkout-payment-notes.ts': 'export const checkoutPaymentNotes = "PAYMENT_NOTES_SENTINEL broad checkout payment docs";\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptAutoSources = sectionBetween(promptResult.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');
  assert.match(promptAutoSources, /`src\/lib\/checkout\.ts` — auto-discovered/);
  assert.match(promptAutoSources, /`src\/lib\/graphql\.ts` — auto-discovered/);
  assert.match(promptAutoSources, /`src\/graphql\/CheckoutAddLine\.graphql` — auto-discovered/);
  assert.doesNotMatch(promptAutoSources, /src\/checkout\/payment-step\.ts/);
  assert.doesNotMatch(promptAutoSources, /src\/docs\/checkout-payment-notes\.ts/);
});

test('spec plan verbose output shows classifier diagnostics without changing rendered prompt', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 91,
    title: 'Admin dashboard billing transactions endpoint',
    bodyLines: [
      'Expose product transaction records API for support workflows.',
      'The backend handler should read app records from database rows.',
    ],
    labels: [{ name: 'api' }, { name: 'backend' }],
  });

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt', '--verbose'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /→ Detected domain evidence:/);
  assert.match(result.stdout, /- api: title matched "endpoint"/);
  assert.match(result.stdout, /→ Rejected domain signals:/);
  assert.match(result.stdout, /- wallet: title signal "transactions" suppressed as generic product transaction wording/);

  const renderedPrompt = result.stdout.slice(result.stdout.indexOf('# Implementation Plan Prompt:'));
  assert.match(renderedPrompt, /## 2\. Detected Domains/);
  assert.doesNotMatch(renderedPrompt, /Domain Evidence/);
  assert.doesNotMatch(renderedPrompt, /Detected domain evidence/);
  assert.doesNotMatch(renderedPrompt, /Rejected domain signals/);

  const nonVerbose = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(nonVerbose.code, 0, nonVerbose.stderr);
  assert.doesNotMatch(nonVerbose.stdout, /Detected domain evidence/);
  assert.doesNotMatch(nonVerbose.stdout, /Rejected domain signals/);
});

test('spec plan non-dry-run writes task package file with mocked gh data', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Task package written: \.spec-injector\/out\/issue-57-task-package\.md/);
  await assertFileExists(fixture.taskPackagePath);

  const written = await readFile(fixture.taskPackagePath);
  assert.match(written, /# Task Package: Add backend auth database fixture plan coverage/);
  assertOrderedSubstrings(written, [
    '# Task Package:',
    '## 1. Issue',
    '## 2. Classification',
    '## 3. Always-Read Files',
    '## 4. Issue-Mentioned Documentation',
    '## 5. Issue-Mentioned Source Files',
    '## 6. Auto-Discovered Documentation',
    '## 7. Auto-Discovered Source Files',
    '## 8. Matched Guardrails',
    '## 9. Missing Files',
  ]);
  assert.match(written, /### docs\/database-guardrail\.md/);
  assert.match(written, /## 7\. Auto-Discovered Source Files/);
  assert.match(written, /### src\/database-auth-service\.ts/);
  assert.match(written, /ALWAYS_READ_LONG_BODY_SENTINEL/);
  assert.match(written, /DISCOVERED_DOC_LONG_BODY_SENTINEL/);
  assert.match(written, /SOURCE_SNIPPET_BODY_SENTINEL/);
  assert.match(written, /Review schema and migration blast radius before changing auth data persistence\./);
  assert.match(written, /- `docs\/missing-handbook\.md` — not found/);
  assert.doesNotMatch(written, /## 8\. Implementation Constraints/);
  assert.doesNotMatch(written, /Implementation Constraints:\s*\(none\)/);
});

test('spec plan does not warn when target git repo is clean', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  await initCleanGitRepo(fixture.repoDir);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /target repo dirty/i);
  assert.doesNotMatch(result.stderr, /uncommitted or untracked changes/i);
});

test('spec plan warns without failing when target git repo has modified tracked files', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  await initCleanGitRepo(fixture.repoDir);
  await fs.appendFile(path.join(fixture.repoDir, 'README.md'), '\nDirty tracked change.\n', 'utf8');

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assertDirtyWarning(result.stderr);
});

test('spec plan warns without failing when target git repo has untracked files', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  await initCleanGitRepo(fixture.repoDir);
  await fs.writeFile(path.join(fixture.repoDir, 'untracked-notes.md'), 'Untracked fixture notes.\n', 'utf8');

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assertDirtyWarning(result.stderr);
});

test('spec plan checks --repo target state instead of current repo state', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  await initCleanGitRepo(fixture.repoDir);
  await fs.appendFile(path.join(fixture.repoDir, 'README.md'), '\nTarget-only dirty change.\n', 'utf8');

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { cwd: repoRoot, env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assertDirtyWarning(result.stderr);
});

test('spec plan silently skips dirty warning when target is not a git repo', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /target repo dirty/i);
  assert.doesNotMatch(result.stderr, /unable to determine target repo worktree state/i);
});

test('spec plan warns without failing when git worktree state check fails unexpectedly', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  const env = await createFailingGitEnv(t, fixture.env);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /unable to determine target repo worktree state/i);
  assertNoCleanupCommands(result.stderr);
});

test('spec plan dirty warning stays on stderr and out of rendered full and prompt output', async (t) => {
  const fixture = await createSpecPlanFixture(t);
  await initCleanGitRepo(fixture.repoDir);
  await fs.writeFile(path.join(fixture.repoDir, 'untracked-dirty.md'), 'dirty\n', 'utf8');

  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );
  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.equal(promptResult.code, 0, promptResult.stderr);
  assertDirtyWarning(fullResult.stderr);
  assertDirtyWarning(promptResult.stderr);
  assert.doesNotMatch(fullResult.stdout, /target repo dirty/i);
  assert.doesNotMatch(promptResult.stdout, /target repo dirty/i);
  assert.doesNotMatch(fullResult.stdout, /current worktree/i);
  assert.doesNotMatch(promptResult.stdout, /current worktree/i);
});

test('spec plan keeps missing always_read files non-fatal and reports found vs missing references', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  const alwaysReadSection = sectionBetween(result.stdout, '### Always-Read Files', '### Issue-Mentioned Docs');
  assert.match(alwaysReadSection, /- `docs\/always-read\.md`/);
  assert.doesNotMatch(alwaysReadSection, /docs\/missing-handbook\.md/);
  assert.match(result.stdout, /## 5\. Missing Files/);
  assert.match(result.stdout, /- `docs\/missing-handbook\.md` — not found/);
  assert.match(result.stderr, /Not found: docs\/missing-handbook\.md/);
});

test('spec plan surfaces matched guardrail risk text for triggered domains', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const result = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Detected domains: .*auth/);
  assert.match(result.stdout, /Detected domains: .*database/);
  assert.match(result.stdout, /Detected domains: .*testing/);
  assert.match(result.stdout, /\*\*db-migration\*\*: Review schema and migration blast radius before changing auth data persistence\./);
  assert.match(result.stdout, /### Rule-Matched Documentation/);
  assert.match(result.stdout, /### docs\/database-guardrail\.md/);
});

test('spec plan fixture output stays deterministic across repeated runs', async (t) => {
  const fixture = await createSpecPlanFixture(t);

  const promptFirst = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const promptSecond = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullFirst = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );
  const fullSecond = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptFirst.code, 0, promptFirst.stderr);
  assert.equal(promptSecond.code, 0, promptSecond.stderr);
  assert.equal(fullFirst.code, 0, fullFirst.stderr);
  assert.equal(fullSecond.code, 0, fullSecond.stderr);
  assert.equal(normalizePlanOutput(promptSecond.stdout), normalizePlanOutput(promptFirst.stdout));
  assert.equal(normalizePlanOutput(fullSecond.stdout), normalizePlanOutput(fullFirst.stdout));
});

test('spec plan includes issue-mentioned source file paths in prompt and full outputs', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 80,
    title: 'Extract explicit repo source file paths from issue body',
    bodyLines: [
      'Relevant source files:',
      '- `apps/dashboard/src/providers/dataProvider.ts`',
      '- `apps/dashboard/src/providers/__tests__/dataProvider.test.ts`',
      '- `services/api/internal/router/router.go`',
    ],
    repoFiles: {
      'apps/dashboard/src/providers/dataProvider.ts': 'export const provider = "ISSUE_SOURCE_PROVIDER_SENTINEL";\n',
      'apps/dashboard/src/providers/__tests__/dataProvider.test.ts': 'export const providerTest = "ISSUE_SOURCE_TEST_SENTINEL";\n',
      'services/api/internal/router/router.go': 'package router\n\nconst RouterSentinel = "ISSUE_ROUTER_SOURCE_SENTINEL"\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.match(promptResult.stdout, /apps\/dashboard\/src\/providers\/dataProvider\.ts/);
  assert.match(promptResult.stdout, /apps\/dashboard\/src\/providers\/__tests__\/dataProvider\.test\.ts/);
  assert.match(promptResult.stdout, /services\/api\/internal\/router\/router\.go/);
  assert.match(promptResult.stdout, /mentioned in issue/i);
  assert.match(fullResult.stdout, /### apps\/dashboard\/src\/providers\/dataProvider\.ts/);
  assert.match(fullResult.stdout, /ISSUE_SOURCE_PROVIDER_SENTINEL/);
  assert.match(fullResult.stdout, /### apps\/dashboard\/src\/providers\/__tests__\/dataProvider\.test\.ts/);
  assert.match(fullResult.stdout, /ISSUE_SOURCE_TEST_SENTINEL/);
  assert.match(fullResult.stdout, /### services\/api\/internal\/router\/router\.go/);
  assert.match(fullResult.stdout, /ISSUE_ROUTER_SOURCE_SENTINEL/);
  assert.match(fullResult.stdout, /sources:\s*3/);
});

test('spec plan includes issue-mentioned docs and de-dupes with always_read', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 81,
    title: 'Extract explicit documentation paths from issue body',
    config: {
      always_read: ['AGENTS.md'],
    },
    bodyLines: [
      'Relevant docs:',
      '- `docs/architecture.md`',
      '- `AGENTS.md`',
    ],
    repoFiles: {
      'docs/architecture.md': '# Architecture\n\nISSUE_DOC_ARCHITECTURE_SENTINEL\n',
      'AGENTS.md': '# Agents\n\nISSUE_DOC_AGENTS_SENTINEL\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.match(promptResult.stdout, /docs\/architecture\.md/);
  assert.match(promptResult.stdout, /AGENTS\.md/);
  assert.match(promptResult.stdout, /mentioned in issue/i);
  assert.equal(countOccurrences(promptResult.stdout, 'AGENTS.md'), 1);
  assert.match(fullResult.stdout, /### docs\/architecture\.md/);
  assert.match(fullResult.stdout, /ISSUE_DOC_ARCHITECTURE_SENTINEL/);
  assert.match(fullResult.stdout, /### AGENTS\.md/);
  assert.match(fullResult.stdout, /ISSUE_DOC_AGENTS_SENTINEL/);
  assert.equal(countOccurrences(fullResult.stdout, '### AGENTS.md'), 1);
});

test('spec plan excludes docs/superpowers from auto-discovered docs by default', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 79,
    title: 'Refine dashboard endpoint contract planning docs',
    bodyLines: [
      'Need plan discovery for dashboard refine endpoint contract updates.',
      '',
      'The old migration plan mentions dashboard refine endpoint contract wording too,',
      'but the task package should prefer current dashboard docs over legacy planning docs.',
    ],
    repoFiles: {
      'docs/superpowers/plans/old-plan.md': '# Old Plan\n\nLegacy dashboard refine endpoint contract migration plan.\nSUPERPOWERS_OLD_PLAN_SENTINEL\n',
      'docs/dashboard-stack-evaluation.md': '# Dashboard Stack Evaluation\n\nCurrent dashboard refine endpoint contract notes.\nDASHBOARD_STACK_SENTINEL\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.match(promptResult.stdout, /docs\/dashboard-stack-evaluation\.md/);
  assert.doesNotMatch(promptResult.stdout, /docs\/superpowers\/plans\/old-plan\.md/);
  assert.match(fullResult.stdout, /### docs\/dashboard-stack-evaluation\.md/);
  assert.match(fullResult.stdout, /DASHBOARD_STACK_SENTINEL/);
  assert.doesNotMatch(fullResult.stdout, /docs\/superpowers\/plans\/old-plan\.md/);
  assert.doesNotMatch(fullResult.stdout, /SUPERPOWERS_OLD_PLAN_SENTINEL/);
});

test('spec plan auto-discovery exclusion stays consistent with config suggest always-read ignored dirs', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 179,
    title: 'Refine dashboard endpoint contract planning docs',
    bodyLines: [
      'Need plan discovery for dashboard refine endpoint contract updates.',
      'Avoid pulling legacy migration plans when current dashboard docs exist.',
    ],
    repoFiles: {
      'docs/superpowers/plans/old-plan.md': '# Old Plan\n\nLegacy dashboard refine endpoint contract migration plan.\n',
      'docs/dashboard-stack-evaluation.md': '# Dashboard Stack Evaluation\n\nCurrent dashboard refine endpoint contract notes.\n',
    },
  });

  const suggestResult = await runSpec(['config', 'suggest', 'always-read', '--repo', fixture.repoDir], { env: fixture.env });
  const planResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });

  assert.equal(suggestResult.code, 0, suggestResult.stderr);
  assert.equal(planResult.code, 0, planResult.stderr);
  assert.match(suggestResult.stdout, /Ignored \/ excluded:/);
  assert.match(suggestResult.stdout, /docs\/superpowers\/\s+— superpowers planning docs are not always_read candidates/);
  assert.match(planResult.stdout, /docs\/dashboard-stack-evaluation\.md/);
  assert.doesNotMatch(planResult.stdout, /docs\/superpowers\/plans\/old-plan\.md/);
});

test('spec plan keeps explicit superpowers docs issue-mentioned without reintroducing them via auto-discovery', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 180,
    title: 'Review explicit dashboard planning references from issue body',
    bodyLines: [
      'Relevant docs and source files:',
      '- `docs/superpowers/plans/old-plan.md`',
      '- `docs/architecture.md`',
      '- `apps/dashboard/src/providers/dataProvider.ts`',
    ],
    repoFiles: {
      'docs/superpowers/plans/old-plan.md': '# Old Plan\n\nSUPERPOWERS_EXPLICIT_SENTINEL\n',
      'docs/architecture.md': '# Architecture\n\nEXPLICIT_ARCHITECTURE_SENTINEL\n',
      'apps/dashboard/src/providers/dataProvider.ts': 'export const provider = "EXPLICIT_SOURCE_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.match(promptResult.stdout, /`docs\/superpowers\/plans\/old-plan\.md` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptResult.stdout, /`docs\/superpowers\/plans\/old-plan\.md` — [^\n]*auto-discovered/);
  assert.match(promptResult.stdout, /`docs\/architecture\.md` — issue-mentioned; mentioned in issue/);
  assert.match(promptResult.stdout, /`apps\/dashboard\/src\/providers\/dataProvider\.ts` — issue-mentioned; mentioned in issue/);
  assert.equal(countOccurrences(promptResult.stdout, 'docs/superpowers/plans/old-plan.md'), 1);
  assert.match(fullResult.stdout, /### docs\/superpowers\/plans\/old-plan\.md\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.doesNotMatch(fullResult.stdout, /### docs\/superpowers\/plans\/old-plan\.md\n\n_[^\n]*auto-discovered_/);
  assert.match(fullResult.stdout, /SUPERPOWERS_EXPLICIT_SENTINEL/);
  assert.match(fullResult.stdout, /### docs\/architecture\.md/);
  assert.match(fullResult.stdout, /EXPLICIT_ARCHITECTURE_SENTINEL/);
  assert.match(fullResult.stdout, /### apps\/dashboard\/src\/providers\/dataProvider\.ts/);
  assert.match(fullResult.stdout, /EXPLICIT_SOURCE_SENTINEL/);
});

test('spec plan reports missing explicit issue-mentioned file paths without failing', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 82,
    title: 'Report missing explicit file paths from issue body',
    bodyLines: [
      'Missing file to verify:',
      '- `apps/dashboard/src/providers/missingProvider.ts`',
    ],
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.match(promptResult.stdout, /## 5\. Missing Files/);
  assert.match(promptResult.stdout, /apps\/dashboard\/src\/providers\/missingProvider\.ts/);
  assert.match(fullResult.stdout, /## 9\. Missing Files/);
  assert.match(fullResult.stdout, /apps\/dashboard\/src\/providers\/missingProvider\.ts/);
});

test('spec plan adds deterministic path alias hints for missing issue-mentioned paths', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 135,
    title: 'Add missing issue-mentioned path alias hints',
    bodyLines: [
      'Missing references to inspect:',
      '- `old/path/foo.ts`',
      '- `old/path/bar.ts`',
      '- `old/path/missing.ts`',
      '- `src/readable.ts`',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'new/path/foo.ts': 'export const movedFoo = "MOVED_FOO_SENTINEL";\n',
      'feature/one/bar.ts': 'export const firstBar = "FIRST_BAR_SENTINEL";\n',
      'feature/two/bar.ts': 'export const secondBar = "SECOND_BAR_SENTINEL";\n',
      'src/readable.ts': 'export const readable = "READABLE_ISSUE_SENTINEL";\n',
    },
  });

  const promptFirst = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const promptSecond = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptFirst.code, 0, promptFirst.stderr);
  assert.equal(promptSecond.code, 0, promptSecond.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.equal(normalizePlanOutput(promptSecond.stdout), normalizePlanOutput(promptFirst.stdout));

  const promptIssueSources = sectionBetween(promptFirst.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptFirst.stdout, '## 5. Missing Files', '## 6. Instructions');
  const fullIssueSources = sectionBetween(fullResult.stdout, '## 5. Issue-Mentioned Source Files', '## 6. Auto-Discovered Documentation');
  const fullMissing = sectionBetween(fullResult.stdout, '## 9. Missing Files', '## 10. Suggested Verification Checklist');

  assert.match(promptIssueSources, /`src\/readable\.ts` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptIssueSources, /path alias hint/);
  assert.doesNotMatch(promptIssueSources, /new\/path\/foo\.ts|feature\/one\/bar\.ts|feature\/two\/bar\.ts/);
  assert.match(fullIssueSources, /### src\/readable\.ts\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.doesNotMatch(fullIssueSources, /### new\/path\/foo\.ts|### feature\/one\/bar\.ts|### feature\/two\/bar\.ts/);

  assert.match(promptMissing, /`old\/path\/foo\.ts` — not found \(issue-mentioned; mentioned in issue; path alias hint: possible moved path `new\/path\/foo\.ts` \(same basename; not a confirmed issue reference\)\)/);
  assert.match(fullMissing, /`old\/path\/foo\.ts` — not found \(issue-mentioned; mentioned in issue; path alias hint: possible moved path `new\/path\/foo\.ts` \(same basename; not a confirmed issue reference\)\)/);
  assert.match(promptFirst.stderr, /Not found: old\/path\/foo\.ts; path alias hint: possible moved path new\/path\/foo\.ts \(same basename; not a confirmed issue reference\)/);

  assert.match(promptMissing, /`old\/path\/bar\.ts` — not found \(issue-mentioned; mentioned in issue; path alias hint: ambiguous same basename candidates \(2\): `feature\/one\/bar\.ts`, `feature\/two\/bar\.ts` \(not a confirmed issue reference\)\)/);
  assert.match(promptFirst.stderr, /Not found: old\/path\/bar\.ts; path alias hint: ambiguous same basename candidates \(2\): feature\/one\/bar\.ts, feature\/two\/bar\.ts \(not a confirmed issue reference\)/);

  assert.match(promptMissing, /`old\/path\/missing\.ts` — not found \(issue-mentioned; mentioned in issue\)/);
  assert.doesNotMatch(promptMissing, /old\/path\/missing\.ts[^\n]*path alias hint/);
  assert.doesNotMatch(promptMissing, /MOVED_FOO_SENTINEL|FIRST_BAR_SENTINEL|SECOND_BAR_SENTINEL/);
  assert.doesNotMatch(fullMissing, /MOVED_FOO_SENTINEL|FIRST_BAR_SENTINEL|SECOND_BAR_SENTINEL/);
});

test('spec plan de-dupes missing basename diagnostics when the same issue already confirmed a full path', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'De-dupe repeated basename after confirmed full path',
    bodyLines: [
      'Confirmed storefront reference:',
      '- `src/ui/components/pdp/variant-section-dynamic.tsx`',
      '',
      'Later shorthand mention that should not become another missing diagnostic:',
      '- `variant-section-dynamic.tsx`',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const variantSectionDynamic = "VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');
  const fullIssueSources = sectionBetween(fullResult.stdout, '## 5. Issue-Mentioned Source Files', '## 6. Auto-Discovered Documentation');
  const fullMissing = sectionBetween(fullResult.stdout, '## 9. Missing Files', '## 10. Suggested Verification Checklist');

  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.match(fullIssueSources, /### src\/ui\/components\/pdp\/variant-section-dynamic\.tsx\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.doesNotMatch(promptMissing, /variant-section-dynamic\.tsx/);
  assert.doesNotMatch(fullMissing, /variant-section-dynamic\.tsx/);
  assert.doesNotMatch(promptResult.stderr, /Not found: variant-section-dynamic\.tsx/);
});

test('spec plan de-dupes basename diagnostics when a plain bullet full path appears before an inline basename mention', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'De-dupe mixed-format repeated basename after confirmed full path',
    bodyLines: [
      'Confirmed storefront reference as a plain bullet:',
      '- src/ui/components/pdp/variant-section-dynamic.tsx',
      '',
      'Later shorthand inline mention that should not become another missing diagnostic:',
      'Please keep `variant-section-dynamic.tsx` aligned with the confirmed component path.',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const variantSectionDynamic = "VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');
  const fullMissing = sectionBetween(fullResult.stdout, '## 9. Missing Files', '## 10. Suggested Verification Checklist');

  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptMissing, /variant-section-dynamic\.tsx/);
  assert.doesNotMatch(fullMissing, /variant-section-dynamic\.tsx/);
  assert.doesNotMatch(promptResult.stderr, /Not found: variant-section-dynamic\.tsx/);
});

test('spec plan keeps basename-only missing diagnostics when no confirmed full path covers the reference', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'Keep basename-only missing diagnostics without confirmed full path coverage',
    bodyLines: [
      'Only shorthand mention is available:',
      '- `variant-section-dynamic.tsx`',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const variantSectionDynamic = "VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');
  const fullMissing = sectionBetween(fullResult.stdout, '## 9. Missing Files', '## 10. Suggested Verification Checklist');

  assert.doesNotMatch(promptIssueSources, /variant-section-dynamic\.tsx/);
  assert.match(promptMissing, /`variant-section-dynamic\.tsx` — not found \(issue-mentioned; mentioned in issue; path alias hint: possible moved path `src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` \(same basename; not a confirmed issue reference\)\)/);
  assert.match(fullMissing, /`variant-section-dynamic\.tsx` — not found \(issue-mentioned; mentioned in issue; path alias hint: possible moved path `src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` \(same basename; not a confirmed issue reference\)\)/);
  assert.match(promptResult.stderr, /Not found: variant-section-dynamic\.tsx; path alias hint: possible moved path src\/ui\/components\/pdp\/variant-section-dynamic\.tsx \(same basename; not a confirmed issue reference\)/);
});

test('spec plan preserves ambiguity when a repeated basename is between multiple confirmed full paths', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'Keep ambiguous basename diagnostics when multiple confirmed full paths share a basename',
    bodyLines: [
      'Confirmed references:',
      '- `src/ui/components/pdp/variant-section-dynamic.tsx`',
      '',
      'Ambiguous shorthand mention before a second confirmed full path:',
      '- `variant-section-dynamic.tsx`',
      '',
      'Second confirmed reference:',
      '- `src/mobile/components/pdp/variant-section-dynamic.tsx`',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const desktopVariantSectionDynamic = "DESKTOP_VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
      'src/mobile/components/pdp/variant-section-dynamic.tsx':
        'export const mobileVariantSectionDynamic = "MOBILE_VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');

  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.match(promptIssueSources, /`src\/mobile\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.match(promptMissing, /`variant-section-dynamic\.tsx` — not found \(issue-mentioned; mentioned in issue; path alias hint: ambiguous same basename candidates \(2\): /);
  assert.match(promptMissing, /src\/ui\/components\/pdp\/variant-section-dynamic\.tsx/);
  assert.match(promptMissing, /src\/mobile\/components\/pdp\/variant-section-dynamic\.tsx/);
  assert.match(promptResult.stderr, /Not found: variant-section-dynamic\.tsx; path alias hint: ambiguous same basename candidates \(2\): /);
});

test('spec plan de-dupes an inline basename after an earlier plain bullet full path', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'De-dupe inline basename after plain bullet full path',
    bodyLines: [
      'Confirmed storefront reference as a plain bullet:',
      '- src/ui/components/pdp/variant-section-dynamic.tsx',
      '',
      'Later inline shorthand mention that should not become another missing diagnostic:',
      'The silent fail is in `variant-section-dynamic.tsx`.',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const variantSectionDynamic = "VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptIssueSources = sectionBetween(promptResult.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');

  assert.match(promptIssueSources, /`src\/ui\/components\/pdp\/variant-section-dynamic\.tsx` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptMissing, /variant-section-dynamic\.tsx/);
  assert.doesNotMatch(promptResult.stderr, /Not found: variant-section-dynamic\.tsx/);
});

test('spec plan keeps basename ambiguity when another confirmed full path appears later in the issue', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 164,
    title: 'Keep basename ambiguity when later full path introduces a second confirmed candidate',
    bodyLines: [
      'First confirmed reference:',
      '- `src/ui/components/pdp/variant-section-dynamic.tsx`',
      '',
      'Shorthand mention before the second confirmed path:',
      '- `variant-section-dynamic.tsx`',
      '',
      'Later confirmed reference with the same basename:',
      '- `src/mobile/components/pdp/variant-section-dynamic.tsx`',
    ],
    config: {
      discovery: {
        docs: [],
        source: [],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'src/ui/components/pdp/variant-section-dynamic.tsx':
        'export const desktopVariantSectionDynamic = "DESKTOP_VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
      'src/mobile/components/pdp/variant-section-dynamic.tsx':
        'export const mobileVariantSectionDynamic = "MOBILE_VARIANT_SECTION_DYNAMIC_SENTINEL";\n',
    },
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');

  assert.match(promptMissing, /`variant-section-dynamic\.tsx` — not found \(issue-mentioned; mentioned in issue; path alias hint: ambiguous same basename candidates \(2\): /);
  assert.match(promptMissing, /src\/ui\/components\/pdp\/variant-section-dynamic\.tsx/);
  assert.match(promptMissing, /src\/mobile\/components\/pdp\/variant-section-dynamic\.tsx/);
  assert.match(promptResult.stderr, /Not found: variant-section-dynamic\.tsx; path alias hint: ambiguous same basename candidates \(2\): /);
});

test('spec plan distinguishes missing files from existing paths that cannot be read', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 74,
    title: 'Distinguish unreadable and missing references',
    bodyLines: [
      'Payment references to inspect:',
      '- `docs/missing-issue.md`',
      '- `docs/unreadable-issue.md`',
      '- `src/readable-reference.ts`',
    ],
    config: {
      always_read: [
        'docs/readable-always.md',
        'docs/missing-always.md',
        'docs/unreadable-always.md',
      ],
      discovery: {
        docs: [],
        source: ['src'],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'docs/readable-always.md': '# Readable Always\n\nREADABLE_ALWAYS_SENTINEL payment\n',
      'docs/unreadable-always.md/child.md': '# Directory child\n',
      'docs/unreadable-issue.md/child.md': '# Directory child\n',
      'docs/payment-runbook.md': '# Payment Runbook\n\nAUTO_DISCOVERED_PAYMENT_SENTINEL payment\n',
      'src/readable-reference.ts': 'export const readableReference = "ISSUE_READABLE_SOURCE_SENTINEL payment";\n',
      'src/payment-worker.ts': 'export const paymentWorker = "AUTO_DISCOVERED_SOURCE_SENTINEL payment";\n',
    },
  });

  const promptFirst = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const promptSecond = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptFirst.code, 0, promptFirst.stderr);
  assert.equal(promptSecond.code, 0, promptSecond.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.equal(normalizePlanOutput(promptSecond.stdout), normalizePlanOutput(promptFirst.stdout));
  assertNoRawStackTrace(promptFirst);
  assertNoRawStackTrace(fullResult);

  const promptMissing = sectionBetween(promptFirst.stdout, '## 5. Missing Files', '## 6. Instructions');
  assert.match(promptMissing, /`docs\/missing-issue\.md` — not found \(issue-mentioned; mentioned in issue\)/);
  assert.match(promptMissing, /`docs\/missing-always\.md` — not found \(repo always_read; always_read\)/);
  assert.match(promptMissing, /`docs\/unreadable-issue\.md` — read failed \(EISDIR; issue-mentioned; mentioned in issue\)/);
  assert.match(promptMissing, /`docs\/unreadable-always\.md` — read failed \(EISDIR; repo always_read; always_read\)/);
  assert.doesNotMatch(promptMissing, /docs\/unreadable-issue\.md` — not found/);
  assert.doesNotMatch(promptMissing, /docs\/unreadable-always\.md` — not found/);
  assert.doesNotMatch(promptMissing, /docs\/missing-issue\.md` — read failed/);

  const promptIssueSources = sectionBetween(promptFirst.stdout, '### Issue-Mentioned Source Files', '### Auto-Discovered Docs');
  assert.match(promptIssueSources, /`src\/readable-reference\.ts` — issue-mentioned; mentioned in issue/);
  assert.doesNotMatch(promptIssueSources, /read failed|not found/);

  const promptAutoDocs = sectionBetween(promptFirst.stdout, '### Auto-Discovered Docs', '### Rule-Matched Docs');
  const promptAutoSources = sectionBetween(promptFirst.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');
  assert.match(promptAutoDocs, /`docs\/payment-runbook\.md` — auto-discovered/);
  assert.match(promptAutoSources, /`src\/payment-worker\.ts` — auto-discovered/);
  assert.doesNotMatch(promptAutoDocs, /issue-mentioned|mentioned in issue/);
  assert.doesNotMatch(promptAutoSources, /issue-mentioned|mentioned in issue/);

  assert.match(promptFirst.stderr, /Not found: docs\/missing-issue\.md/);
  assert.match(promptFirst.stderr, /Not found: docs\/missing-always\.md/);
  assert.match(promptFirst.stderr, /Read failed: docs\/unreadable-issue\.md \(EISDIR\)/);
  assert.match(promptFirst.stderr, /Read failed: docs\/unreadable-always\.md \(EISDIR\)/);
  assert.doesNotMatch(promptFirst.stderr, /Not found: docs\/unreadable-issue\.md/);
  assert.doesNotMatch(promptFirst.stderr, /Not found: docs\/unreadable-always\.md/);

  assert.match(fullResult.stdout, /### src\/readable-reference\.ts\n\n_source: issue-mentioned; mentioned in issue_/);
  assert.match(fullResult.stdout, /ISSUE_READABLE_SOURCE_SENTINEL/);
  assert.match(fullResult.stdout, /### docs\/payment-runbook\.md\n\n_source: auto-discovered_/);
  assert.match(fullResult.stdout, /### src\/payment-worker\.ts\n\n_source: auto-discovered_/);
});

test('spec plan keeps failed auto-discovered references out of prompt reference lists', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 174,
    title: 'Payment auto discovery read failure regression',
    bodyLines: [
      'Payment work should include readable auto-discovered references only.',
      'The payment failed doc and source names score by path, but read failures must not be trusted references.',
    ],
    config: {
      discovery: {
        docs: [],
        source: ['src'],
        max_docs: 5,
        max_source_files: 5,
      },
    },
    repoFiles: {
      'docs/payment-readable.md': '# Payment Readable\n\nREADABLE_AUTO_DOC_SENTINEL payment\n',
      'docs/payment-failed.md': '# Payment Failed\n\nFAILED_AUTO_DOC_SENTINEL payment\n',
      'src/payment-readable.ts': 'export const readablePayment = "READABLE_AUTO_SOURCE_SENTINEL payment";\n',
      'src/payment-failed.ts': 'export const failedPayment = "FAILED_AUTO_SOURCE_SENTINEL payment";\n',
    },
  });
  const env = await createReadFailureEnv(t, fixture.env, [
    ['docs/payment-failed.md', 'EIO'],
    ['src/payment-failed.ts', 'EIO'],
  ]);

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assertNoRawStackTrace(promptResult);

  const promptAutoDocs = sectionBetween(promptResult.stdout, '### Auto-Discovered Docs', '### Rule-Matched Docs');
  const promptAutoSources = sectionBetween(promptResult.stdout, '### Auto-Discovered Source Files', '## 5. Missing Files');
  const promptMissing = sectionBetween(promptResult.stdout, '## 5. Missing Files', '## 6. Instructions');

  assert.match(promptAutoDocs, /`docs\/payment-readable\.md` — auto-discovered/);
  assert.doesNotMatch(promptAutoDocs, /docs\/payment-failed\.md/);
  assert.match(promptAutoSources, /`src\/payment-readable\.ts` — auto-discovered/);
  assert.doesNotMatch(promptAutoSources, /src\/payment-failed\.ts/);

  assert.match(promptMissing, /`docs\/payment-failed\.md` — read failed \(EIO; auto-discovered\)/);
  assert.match(promptMissing, /`src\/payment-failed\.ts` — read failed \(EIO; auto-discovered\)/);
  assert.doesNotMatch(promptMissing, /path alias hint/);
  assert.match(promptResult.stderr, /Read failed: docs\/payment-failed\.md \(EIO\)/);
  assert.match(promptResult.stderr, /Read failed: src\/payment-failed\.ts \(EIO\)/);
});

test('spec plan ignores API and route paths when extracting file references', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 83,
    title: 'Ignore API route paths in issue body extraction',
    bodyLines: [
      'Do not treat these routes as files:',
      '- `/api/v1/users/me/points/history`',
      '- `/api/v1/dashboard/settings`',
      '- `/transactions`',
      '- `/dashboard/settings`',
    ],
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });
  const fullResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);
  assert.doesNotMatch(promptResult.stdout, /Relevant File References[\s\S]*\/api\/v1\/users\/me\/points\/history/);
  assert.doesNotMatch(promptResult.stdout, /Missing Files[\s\S]*\/api\/v1\/dashboard\/settings/);
  assert.doesNotMatch(fullResult.stdout, /Auto-Discovered Source Files[\s\S]*\/transactions/);
  assert.doesNotMatch(fullResult.stdout, /Missing Files[\s\S]*\/dashboard\/settings/);
});

test('spec plan ignores URLs, traversal paths, and absolute paths', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 84,
    title: 'Ignore unsafe or non-repo paths in issue body extraction',
    bodyLines: [
      'Unsafe references to ignore:',
      '- `https://github.com/nurockplayer/tachigo/issues/467`',
      '- `../secrets.env`',
      '- `/absolute/path.ts`',
    ],
  });

  const result = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  const refsSection = sectionBetween(result.stdout, '## 3. Always-Read Files', '## 10. Suggested Verification Checklist');
  assert.doesNotMatch(refsSection, /https:\/\/github\.com\/nurockplayer\/tachigo\/issues\/467/);
  assert.doesNotMatch(refsSection, /\.\.\/secrets\.env/);
  assert.doesNotMatch(refsSection, /\/absolute\/path\.ts/);
});

test('spec plan tachigo-like fixture extracts explicit source files without misclassifying API paths', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 467,
    title: 'Support dashboard points history contract updates',
    bodyLines: [
      'Relevant files from issue body:',
      '- `apps/dashboard/src/providers/dataProvider.ts`',
      '- `apps/dashboard/src/providers/__tests__/dataProvider.test.ts`',
      '- `services/api/internal/router/router.go`',
      '- `services/api/internal/handlers/points_handler.go`',
      '- `services/api/internal/handlers/agency_handler.go`',
      '',
      'Related API routes that are not files:',
      '- `/api/v1/users/me/points/history`',
      '- `/api/v1/dashboard/settings`',
    ],
    repoFiles: {
      'apps/dashboard/src/providers/dataProvider.ts': 'export const tachigoProvider = "TACHIGO_PROVIDER_SENTINEL";\n',
      'apps/dashboard/src/providers/__tests__/dataProvider.test.ts': 'export const tachigoProviderTest = "TACHIGO_PROVIDER_TEST_SENTINEL";\n',
      'services/api/internal/router/router.go': 'package router\n\nconst TachigoRouterSentinel = "TACHIGO_ROUTER_SENTINEL"\n',
      'services/api/internal/handlers/points_handler.go': 'package handlers\n\nconst PointsHandlerSentinel = "TACHIGO_POINTS_HANDLER_SENTINEL"\n',
      'services/api/internal/handlers/agency_handler.go': 'package handlers\n\nconst AgencyHandlerSentinel = "TACHIGO_AGENCY_HANDLER_SENTINEL"\n',
    },
  });

  const promptResult = await runSpec(['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'], { env: fixture.env });

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.match(promptResult.stdout, /apps\/dashboard\/src\/providers\/dataProvider\.ts/);
  assert.match(promptResult.stdout, /services\/api\/internal\/handlers\/points_handler\.go/);
  assert.match(promptResult.stdout, /services\/api\/internal\/handlers\/agency_handler\.go/);
  assert.match(promptResult.stdout, /mentioned in issue/i);
  assert.doesNotMatch(promptResult.stdout, /Missing Files[\s\S]*\/api\/v1\/users\/me\/points\/history/);
  assert.doesNotMatch(promptResult.stdout, /Missing Files[\s\S]*\/api\/v1\/dashboard\/settings/);
  assert.match(promptResult.stdout, /sources:\s*5/);
});

test('spec plan preserves nested verification checklist subcases in prompt and full output', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Preserve nested verification checklist subcases',
    bodyLines: [
      'Verification checklist:',
      '- [ ] preserve parent verification item',
      '  - first nested failure mode',
      '  - second nested failure mode',
      '    - deeper implementation note',
      '- [ ] keep sibling verification item',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assertOrderedSubstrings(promptChecklist, [
    '- [ ] preserve parent verification item',
    '  - first nested failure mode',
    '  - second nested failure mode',
    '    - deeper implementation note',
    '- [ ] keep sibling verification item',
  ]);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*- \[ \] preserve parent verification item/);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*  - first nested failure mode/);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*  - second nested failure mode/);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*    - deeper implementation note/);
});

test('spec plan preserves nested checkbox checklist subcases', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Preserve nested checkbox verification subcases',
    bodyLines: [
      'Verification checklist:',
      '- [ ] parent verification item',
      '  - [ ] checkbox subcase one',
      '  - [ ] checkbox subcase two',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );
  const fullResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);
  assert.equal(fullResult.code, 0, fullResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assertOrderedSubstrings(promptChecklist, [
    '- [ ] parent verification item',
    '  - [ ] checkbox subcase one',
    '  - [ ] checkbox subcase two',
  ]);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*- \[ \] parent verification item/);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*  - \[ \] checkbox subcase one/);
  assert.match(fullResult.stdout, /## 10\. Suggested Verification Checklist[\s\S]*  - \[ \] checkbox subcase two/);
});

test('spec plan preserves mixed nested checkbox and plain bullet checklist subcases', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Preserve mixed nested checkbox and bullet subcases',
    bodyLines: [
      'Verification checklist:',
      '- [ ] parent verification item',
      '  - [ ] checkbox subcase',
      '  - plain bullet subcase',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assertOrderedSubstrings(promptChecklist, [
    '- [ ] parent verification item',
    '  - [ ] checkbox subcase',
    '  - plain bullet subcase',
  ]);
});

test('spec plan keeps flat verification checklist behavior stable', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Keep flat checklist behavior stable',
    bodyLines: [
      'Validation checklist:',
      '- [ ] run build before review',
      '- [ ] run tests before review',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assert.match(promptChecklist, /- \[ \] run build before review/);
  assert.match(promptChecklist, /- \[ \] run tests before review/);
  assert.doesNotMatch(promptChecklist, /  - /);
});

test('spec plan does not promote unrelated nested prose bullets into verification checklist', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Keep unrelated nested prose bullets out of checklist extraction',
    bodyLines: [
      'Planning notes:',
      '- parent prose bullet that should stay outside verification checklist',
      '  - nested prose bullet that should stay outside verification checklist',
      '- [ ] actual verification parent',
      '  - expected nested verification subcase',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assert.doesNotMatch(promptChecklist, /parent prose bullet/);
  assert.doesNotMatch(promptChecklist, /nested prose bullet that should stay outside verification checklist/);
  assert.match(promptChecklist, /- \[ \] actual verification parent/);
  assert.match(promptChecklist, /  - expected nested verification subcase/);
});

test('spec plan preserves dogfood-shaped silent fail checklist subcases', async (t) => {
  const fixture = await createExplicitPathPlanFixture(t, {
    issueNumber: 166,
    title: 'Preserve brownfield dogfood verification subcases',
    bodyLines: [
      'Suggested regression coverage:',
      '- [ ] silent fail / error handling for add-to-cart',
      '  - checkout creation failure',
      '  - GraphQL mutation error including `checkoutLinesAdd.errors`',
      '  - unexpected exception',
    ],
  });

  const promptResult = await runSpec(
    ['plan', fixture.issueUrl, '--repo', fixture.repoDir, '--dry-run', '--format', 'prompt'],
    { env: fixture.env }
  );

  assert.equal(promptResult.code, 0, promptResult.stderr);

  const promptChecklist = sectionBetween(promptResult.stdout, 'Suggested verification checklist:', 'Read the referenced files as needed');

  assertOrderedSubstrings(promptChecklist, [
    '- [ ] silent fail / error handling for add-to-cart',
    '  - checkout creation failure',
    '  - GraphQL mutation error including `checkoutLinesAdd.errors`',
    '  - unexpected exception',
  ]);
});
