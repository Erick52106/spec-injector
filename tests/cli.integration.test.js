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

test('spec config suggest always-read reports candidates and ignores excluded paths without mutating config', async (t) => {
  const repoDir = await createTempRepo(t);

  await writeFiles(repoDir, [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    'README.md',
    'docs/security.md',
    'docs/architecture.md',
    'docs/superpowers/plans/test.md',
    '.spec-injector/out/issue-1-task-package.md',
    'node_modules/noise.md',
    'dist/generated.md',
    'build/generated.md',
  ]);

  const result = await runSpec(['config', 'suggest', 'always-read', '--repo', repoDir]);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /High confidence:/);
  assert.match(result.stdout, /Medium confidence:/);
  assert.match(result.stdout, /Ignored \/ excluded:/);

  for (const file of [
    'CLAUDE.md',
    'AGENTS.md',
    'GEMINI.md',
    'README.md',
    'docs/security.md',
    'docs/architecture.md',
  ]) {
    assert.match(result.stdout, new RegExp(escapeRegExp(file)));
  }

  for (const file of [
    'docs/superpowers/plans/test.md',
    '.spec-injector/out/issue-1-task-package.md',
    'node_modules/noise.md',
    'dist/generated.md',
    'build/generated.md',
  ]) {
    assert.doesNotMatch(result.stdout, new RegExp(escapeRegExp(file)));
  }

  await assert.rejects(fs.access(path.join(repoDir, '.spec-injector', 'config.json')));
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
