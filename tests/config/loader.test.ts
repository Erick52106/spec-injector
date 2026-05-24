import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../../dist/config/loader.js';

async function createTempDir(t: { after(fn: () => void | Promise<void>): void }, name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `spec-injector-${name}-`));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('loadConfig loads a valid external config path without mutating target repo', async (t) => {
  const targetRepo = await createTempDir(t, 'target-repo');
  const configDir = await createTempDir(t, 'external-config');
  const configPath = path.join(configDir, 'config.json');
  await writeJson(configPath, {
    version: 2,
    project: { name: 'demo', type: 'node' },
    always_read: ['README.md'],
    discovery: {
      docs: ['docs'],
      source: ['src'],
      exclude: ['dist'],
      max_docs: 3,
      max_source_files: 4,
    },
    guardrails: [{
      id: 'no-runtime-change',
      when_detected: ['runtime'],
      risk: 'Stop before editing runtime behavior.',
    }],
  });

  assert.deepEqual(await fs.readdir(targetRepo), []);

  const config = await loadConfig(targetRepo, { configPath });

  assert.equal(config.repoPath, path.resolve(targetRepo));
  assert.equal(config.specAgentDir, configDir);
  assert.deepEqual(config.specConfig, {
    version: 2,
    project: { name: 'demo', type: 'node' },
    always_read: ['README.md'],
    discovery: {
      docs: ['docs'],
      source: ['src'],
      exclude: ['dist'],
      max_docs: 3,
      max_source_files: 4,
    },
    guardrails: [{
      id: 'no-runtime-change',
      when_detected: ['runtime'],
      risk: 'Stop before editing runtime behavior.',
    }],
  });
  assert.deepEqual(await fs.readdir(targetRepo), []);
});

test('loadConfig reports a clear error for missing external config path', async (t) => {
  const targetRepo = await createTempDir(t, 'missing-target-repo');
  const missingPath = path.join(await createTempDir(t, 'missing-config'), 'config.json');

  await assert.rejects(
    () => loadConfig(targetRepo, { configPath: missingPath }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message, `External config file not found: ${missingPath}`);
      return true;
    }
  );
  assert.deepEqual(await fs.readdir(targetRepo), []);
});

test('loadConfig reports invalid external config schema errors with config path', async (t) => {
  const targetRepo = await createTempDir(t, 'invalid-target-repo');
  const configPath = path.join(await createTempDir(t, 'invalid-config'), 'config.json');
  await writeJson(configPath, {
    version: 2,
    always_read: 'README.md',
  });

  await assert.rejects(
    () => loadConfig(targetRepo, { configPath }),
    /Invalid config\.json at .*config\.json: always_read must be an array, got string/
  );
  assert.deepEqual(await fs.readdir(targetRepo), []);
});

test('loadConfig rejects invalid discovery limit values clearly', async (t) => {
  const targetRepo = await createTempDir(t, 'invalid-discovery-limit-target-repo');
  const configPath = path.join(await createTempDir(t, 'invalid-discovery-limit-config'), 'config.json');

  for (const [field, value] of [
    ['max_docs', '5'],
    ['max_docs', -1],
    ['max_source_files', 1.5],
  ] as const) {
    await writeJson(configPath, {
      version: 2,
      discovery: {
        [field]: value,
      },
    });

    await assert.rejects(
      () => loadConfig(targetRepo, { configPath }),
      new RegExp(`Invalid config\\.json at .*config\\.json: discovery\\.${field} must be a non-negative integer`)
    );
  }

  assert.deepEqual(await fs.readdir(targetRepo), []);
});

test('loadConfig preserves zero discovery limits', async (t) => {
  const targetRepo = await createTempDir(t, 'zero-discovery-limit-target-repo');
  const configPath = path.join(await createTempDir(t, 'zero-discovery-limit-config'), 'config.json');
  await writeJson(configPath, {
    version: 2,
    discovery: {
      max_docs: 0,
      max_source_files: 0,
    },
  });

  const config = await loadConfig(targetRepo, { configPath });

  assert.equal(config.specConfig.discovery?.max_docs, 0);
  assert.equal(config.specConfig.discovery?.max_source_files, 0);
  assert.deepEqual(await fs.readdir(targetRepo), []);
});

test('loadConfig rejects legacy v1 rules files as non-current config', async (t) => {
  const targetRepo = await createTempDir(t, 'legacy-target-repo');
  const rulesPath = path.join(await createTempDir(t, 'legacy-config'), 'rules.json');
  await writeJson(rulesPath, {
    version: 1,
    rules: [],
  });

  await assert.rejects(
    () => loadConfig(targetRepo, { configPath: rulesPath }),
    /Invalid config\.json at .*rules\.json: Expected version: 2, got: 1/
  );
  assert.deepEqual(await fs.readdir(targetRepo), []);
});
