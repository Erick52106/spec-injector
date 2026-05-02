import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, 'bin', 'spec.js');

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

  const invalidListSection = await runSpec(['config', 'list', 'unknown', '--repo', repoDir]);
  assert.notEqual(invalidListSection.code, 0);

  const invalidListPath = await runSpec(['config', 'list', 'always-read', 'docs/security.md', '--repo', repoDir]);
  assert.notEqual(invalidListPath.code, 0);
});

async function createTempRepo(t) {
  const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-test-'));
  t.after(async () => {
    await fs.rm(repoDir, { recursive: true, force: true });
  });
  return repoDir;
}

function runSpec(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: process.env,
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

async function readFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function assertFileExists(filePath) {
  await fs.access(filePath);
}

async function assertFileMissing(filePath) {
  await assert.rejects(fs.access(filePath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}
