import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySpecArtifactPath,
  isSpecArtifactPath,
  normalizeArtifactPath,
} from '../../dist/utils/artifacts.js';

test('classifySpecArtifactPath returns stable match reasons for existing artifact families', () => {
  const cases = [
    {
      path: '.spec-injector/out/issue-354-task-package.md',
      kind: 'spec-agent-dir',
      reason: 'spec-injector workspace artifact',
    },
    {
      path: 'spec-output/issue-354.md',
      kind: 'spec-output-dir',
      reason: 'spec output directory',
    },
    {
      path: 'tmp/issue-354-task-package.md',
      kind: 'issue-task-package',
      reason: 'generated issue task package',
    },
    {
      path: 'tmp/spec-evidence.closeout.json',
      kind: 'generated-spec-artifact',
      reason: 'generated spec artifact',
    },
    {
      path: 'awp-readback-evidence.json',
      kind: 'routing-readback-artifact',
      reason: 'routing/readback evidence artifact',
    },
    {
      path: '.private-context/notes.md',
      kind: 'private-context',
      reason: 'private context or ledger artifact',
    },
    {
      path: 'secret-context/notes.md',
      kind: 'configured-private-exclude',
      reason: 'configured private exclude',
      privateExcludes: ['secret-context'],
    },
  ];

  for (const entry of cases) {
    const match = classifySpecArtifactPath(entry.path, { privateExcludes: entry.privateExcludes });
    assert.equal(match?.path, normalizeArtifactPath(entry.path), entry.path);
    assert.equal(match?.kind, entry.kind, entry.path);
    assert.equal(match?.reason, entry.reason, entry.path);
    assert.equal(isSpecArtifactPath(entry.path, { privateExcludes: entry.privateExcludes }), true, entry.path);
  }
});

test('classifySpecArtifactPath returns null for non-artifacts', () => {
  for (const entry of ['README.md', 'src/workflow-check.ts', 'docs/context.md', 'private-but-normal.md']) {
    assert.equal(classifySpecArtifactPath(entry), null, entry);
    assert.equal(isSpecArtifactPath(entry), false, entry);
  }
});
