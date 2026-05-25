import test from 'node:test';
import assert from 'node:assert/strict';
import { isDurableEvidenceRef } from '../../dist/utils/evidence-ref.js';

test('isDurableEvidenceRef accepts URL, issue comment, and workflow-check refs', () => {
  for (const ref of [
    'https://example.com/evidence',
    'http://example.com/evidence',
    'https://github.com/Erick52106/spec-injector/issues/350#issuecomment-4537361050',
    'workflow-check:commit:issue-350',
    'workflow-check:start:abc123',
  ]) {
    assert.equal(isDurableEvidenceRef(ref), true, ref);
  }
});

test('isDurableEvidenceRef rejects weak placeholders and plain prose', () => {
  for (const ref of [
    '',
    '   ',
    null,
    undefined,
    'n/a',
    'na',
    'none',
    'missing',
    'unknown',
    'pending',
    'fail',
    'failed',
    'done',
    'ok',
    'small',
    'trivial',
    'local note without URL',
  ]) {
    assert.equal(isDurableEvidenceRef(ref), false, String(ref));
  }
});
