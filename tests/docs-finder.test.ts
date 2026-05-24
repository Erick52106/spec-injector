import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { discoverRelevantDocs, extractExplicitIssueFileReferences } from '../dist/docs/finder.js';
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

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}
