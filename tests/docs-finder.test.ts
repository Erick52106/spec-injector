import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverRelevantDocs } from '../dist/docs/finder.js';
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
