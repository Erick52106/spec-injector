import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { classifyDomains, classifyDomainsWithEvidence } from '../dist/classifier/domain.js';

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, 'bin', 'spec.js');

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
  assert.ok(!domains.includes('wallet'), `Expected wallet to be absent from ${domains.join(', ')}`);
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
  assert.doesNotMatch(result.stdout, /issue-57-task-package\.md/);
  await assertFileMissing(fixture.taskPackagePath);
  assert.deepEqual(await readGhLog(fixture.ghLogPath), [
    'issue view 57 --repo Erick52106/spec-injector --json number,title,body,labels,url,state',
  ]);
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
  await assertFileMissing(fixture.taskPackagePath);
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

async function createTempRepo(t, prefix = 'spec-injector-test-') {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });
  return repoDir;
}

function createMissingPath() {
  return path.join(os.tmpdir(), `spec-injector-missing-${process.pid}-${Date.now()}`);
}

async function createSpecPlanFixture(t) {
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

async function createExplicitPathPlanFixture(t, options) {
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

async function createFakeGh(t, issuePayload) {
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

function runSpec(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`spec exited via signal ${signal}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeFiles(repoDir, relativePaths) {
  await Promise.all(relativePaths.map(async (relativePath) => {
    const absolutePath = path.join(repoDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, `${relativePath}\n`, 'utf8');
  }));
}

async function writeRepoFiles(repoDir, files) {
  await Promise.all(Object.entries(files).map(async ([relativePath, content]) => {
    const absolutePath = path.join(repoDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }));
}

async function writeConfig(repoDir, config) {
  await writeRepoFiles(repoDir, {
    '.spec-injector/config.json': `${JSON.stringify(config, null, 2)}\n`,
  });
}

async function readFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function readGhLog(filePath) {
  return (await readFile(filePath))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function assertFileExists(filePath) {
  await fs.access(filePath);
}

async function assertFileMissing(filePath) {
  await assert.rejects(fs.access(filePath));
}

function assertNoRawStackTrace(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(combined, /\n\s*at .+\(.+:\d+:\d+\)|\n\s*at .+:\d+:\d+/);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function normalizePlanOutput(value) {
  return value
    .replace(/\*\*Generated:\*\* .+/g, '**Generated:** <normalized>')
    .replace(/spec-injector-test-[^/]+/g, 'spec-injector-test-normalized')
    .replace(/spec-injector-gh-[^/]+/g, 'spec-injector-gh-normalized');
}

function assertOrderedSubstrings(value, substrings) {
  let previousIndex = -1;
  for (const substring of substrings) {
    const currentIndex = value.indexOf(substring);
    assert.notEqual(currentIndex, -1, `Missing substring: ${substring}`);
    assert.ok(
      currentIndex > previousIndex,
      `Expected "${substring}" to appear after "${substrings[substrings.indexOf(substring) - 1] ?? '<start>'}"`
    );
    previousIndex = currentIndex;
  }
}

function sectionBetween(value, startMarker, endMarker) {
  const startIndex = value.indexOf(startMarker);
  const endIndex = value.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not extract section between "${startMarker}" and "${endMarker}"`);
  }
  return value.slice(startIndex, endIndex);
}
