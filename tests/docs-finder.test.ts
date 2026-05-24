import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverRelevantDocs, discoverSourceFiles, extractExplicitIssueFileReferences } from '../dist/docs/finder.js';
import { createTempRepo, writeRepoFiles } from './helpers/fixtures.ts';

test('auto relevant docs discovery includes GEMINI.md fixed candidate unless excluded', async (t) => {
  const repoDir = await createTempRepo(t);
  const issue = {
    number: 280,
    title: 'Refresh Gemini worker routing docs',
    body: 'Gemini worker routing should be available to planning context.',
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/280',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'GEMINI.md': '# Gemini Worker Routing\n\nGemini worker routing guidance for bounded implementation.\n',
  });

  const discovered = await discoverRelevantDocs(issue, repoDir, new Set(), 5);
  assert.equal(discovered.some((doc) => doc.filePath === 'GEMINI.md'), true);

  const excluded = await discoverRelevantDocs(issue, repoDir, new Set(['GEMINI.md']), 5);
  assert.equal(excluded.some((doc) => doc.filePath === 'GEMINI.md'), false);
});

test('root doc candidates share one source for fixed discovery and explicit references', async (t) => {
  const repoDir = await createTempRepo(t);
  const rootDocs = ['README.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md'];
  const issue = {
    number: 282,
    title: 'Refresh root doc candidate discovery',
    body: rootDocs.map((doc) => `- ${doc}`).join('\n'),
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/282',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'README.md': '# Readme\n\nRefresh root doc candidate discovery.\n',
    'CLAUDE.md': '# Claude\n\nRefresh root doc candidate discovery.\n',
    'AGENTS.md': '# Agents\n\nRefresh root doc candidate discovery.\n',
    'GEMINI.md': '# Gemini\n\nRefresh root doc candidate discovery.\n',
  });

  const discovered = await discoverRelevantDocs(issue, repoDir, new Set(), 10);
  assert.deepEqual(discovered.map((doc) => doc.filePath), rootDocs);

  const explicit = await extractExplicitIssueFileReferences(issue, repoDir);
  assert.deepEqual(explicit.docs.map((doc) => doc.filePath), rootDocs);
  assert.deepEqual(explicit.sources.map((doc) => doc.filePath), []);
  assert.deepEqual(explicit.missing.map((doc) => doc.filePath), []);

  const finderSource = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/docs/finder.ts'),
    'utf8'
  );
  assert.equal(
    rootDocs.every((doc) => countOccurrences(finderSource, `'${doc}'`) === 1),
    true
  );
});

test('explicit issue-mentioned MDX docs are classified as issue docs', async (t) => {
  const repoDir = await createTempRepo(t);
  const issue = {
    number: 286,
    title: 'Include MDX docs in docs finder',
    body: 'Relevant docs:\n- `docs/usage.mdx`',
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/286',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'docs/usage.mdx': '# Usage\n\nMDX usage guidance for docs finder.\n',
  });

  const explicit = await extractExplicitIssueFileReferences(issue, repoDir);

  assert.deepEqual(explicit.docs.map((doc) => doc.filePath), ['docs/usage.mdx']);
  assert.equal(explicit.docs[0]?.kind, 'issue-doc');
  assert.deepEqual(explicit.sources.map((doc) => doc.filePath), []);
  assert.deepEqual(explicit.missing.map((doc) => doc.filePath), []);
});

test('auto relevant docs discovery includes scored MDX docs without adding MDX to source discovery', async (t) => {
  const repoDir = await createTempRepo(t);
  const issue = {
    number: 286,
    title: 'Refresh usage guide docs',
    body: 'Usage guide docs should be found during relevant docs discovery.',
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/286',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'docs/usage.mdx': '# Usage Guide\n\nRelevant usage guide docs for MDX discovery.\n',
    'src/usage.mdx': '# Usage Guide\n\nThis MDX file must not be treated as source.\n',
  });

  const discoveredDocs = await discoverRelevantDocs(issue, repoDir, new Set(), 5);
  assert.equal(discoveredDocs.some((doc) => doc.filePath === 'docs/usage.mdx'), true);

  const discoveredSources = await discoverSourceFiles(issue, repoDir, ['src'], 5);
  assert.deepEqual(discoveredSources.map((doc) => doc.filePath), []);
});

test('explicit issue-mentioned source references include Node module extensions', async (t) => {
  const repoDir = await createTempRepo(t);
  const sourceFiles = ['src/cli.mjs', 'src/config.cjs', 'src/module.mts', 'src/legacy.cts'];
  const issue = {
    number: 284,
    title: 'Include explicit Node module source references',
    body: [
      'Relevant source files:',
      ...sourceFiles.map((filePath) => `- \`${filePath}\``),
    ].join('\n'),
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/284',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, Object.fromEntries(
    sourceFiles.map((filePath) => [filePath, `export const sentinel = "${filePath}";\n`])
  ));

  const explicit = await extractExplicitIssueFileReferences(issue, repoDir);

  assert.deepEqual(explicit.docs.map((doc) => doc.filePath), []);
  assert.deepEqual(explicit.sources.map((doc) => doc.filePath), sourceFiles);
  assert.deepEqual(explicit.missing.map((doc) => doc.filePath), []);
});

test('explicit issue-mentioned JSONC config references are classified as issue sources', async (t) => {
  const repoDir = await createTempRepo(t);
  const sourceFiles = ['wrangler.jsonc', 'config/tsconfig.jsonc'];
  const issue = {
    number: 288,
    title: 'Include explicit JSONC config references',
    body: [
      'Relevant config references:',
      ...sourceFiles.map((filePath) => `- \`${filePath}\``),
    ].join('\n'),
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/288',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'wrangler.jsonc': '{\n  "name": "jsonc-worker"\n}\n',
    'config/tsconfig.jsonc': '{\n  "extends": "../tsconfig.json"\n}\n',
  });

  const explicit = await extractExplicitIssueFileReferences(issue, repoDir);

  assert.deepEqual(explicit.docs.map((doc) => doc.filePath), []);
  assert.deepEqual(explicit.sources.map((doc) => doc.filePath), sourceFiles);
  assert.deepEqual(explicit.missing.map((doc) => doc.filePath), []);
});

test('explicit issue-mentioned TOML config references are classified as issue sources only', async (t) => {
  const repoDir = await createTempRepo(t);
  const sourceFiles = ['pyproject.toml', 'config/wrangler.toml', 'Cargo.toml'];
  const issue = {
    number: 290,
    title: 'Include explicit TOML config references',
    body: [
      'Relevant config references:',
      ...sourceFiles.map((filePath) => `- \`${filePath}\``),
    ].join('\n'),
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/290',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'pyproject.toml': '[project]\nname = "toml-package"\n',
    'config/wrangler.toml': 'name = "toml-worker"\n',
    'Cargo.toml': '[package]\nname = "toml-crate"\n',
  });

  const explicit = await extractExplicitIssueFileReferences(issue, repoDir);

  assert.deepEqual(explicit.docs.map((doc) => doc.filePath), []);
  assert.deepEqual(explicit.sources.map((doc) => doc.filePath), sourceFiles);
  assert.deepEqual(explicit.missing.map((doc) => doc.filePath), []);

  const autoDiscovered = await discoverSourceFiles(issue, repoDir, ['.'], 10);
  assert.deepEqual(autoDiscovered.map((doc) => doc.filePath), []);
});

test('auto source discovery includes Node module extensions while preserving generated and skip-dir filtering', async (t) => {
  const repoDir = await createTempRepo(t);
  const sourceFiles = ['src/cli.mjs', 'src/config.cjs', 'src/module.mts', 'src/legacy.cts'];
  const issue = {
    number: 284,
    title: 'Refresh cli config module legacy source discovery',
    body: 'Auto discovery should find cli config module legacy Node module extension files.',
    labels: [],
    url: 'https://github.com/Erick52106/spec-injector/issues/284',
    state: 'OPEN',
  };

  await writeRepoFiles(repoDir, {
    'src/cli.mjs': 'export const cli = "NODE_EXTENSION_DISCOVERY_SENTINEL cli";\n',
    'src/config.cjs': 'module.exports = { config: "NODE_EXTENSION_DISCOVERY_SENTINEL config" };\n',
    'src/module.mts': 'export const moduleSource = "NODE_EXTENSION_DISCOVERY_SENTINEL module";\n',
    'src/legacy.cts': 'export const legacySource = "NODE_EXTENSION_DISCOVERY_SENTINEL legacy";\n',
    'src/generated/cli.mjs': 'export const generatedCli = "NODE_EXTENSION_DISCOVERY_SENTINEL cli";\n',
    'src/node_modules/config.cjs': 'module.exports = { skipped: "NODE_EXTENSION_DISCOVERY_SENTINEL config" };\n',
    'src/types.generated.mts': 'export const generatedModule = "NODE_EXTENSION_DISCOVERY_SENTINEL module";\n',
  });

  const discovered = await discoverSourceFiles(issue, repoDir, ['src'], 10);
  const discoveredPaths = discovered.map((source) => source.filePath);

  assert.deepEqual([...discoveredPaths].sort(), [...sourceFiles].sort());
});

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}
