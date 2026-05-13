import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './helpers/cli.ts';

test('Hybrid AWP routing policy remains linked from workflow-check docs', async () => {
  const policyPath = path.join(repoRoot, 'docs', 'hybrid-awp-routing-policy.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');

  const [policy, readme, englishReadme, workflow] = await Promise.all([
    fs.readFile(policyPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
  ]);

  assert.match(policy, /Hybrid Autonomous Worker Profiles routing policy/);
  assert.match(policy, /routing_mode=hybrid_awp\|strict_awp\|controller_fallback/);
  assert.match(policy, /Absence of autonomous routing signal/);
  assert.match(policy, /Downstream Scope Police/);

  assert.match(readme, /\[Hybrid AWP routing policy\]\(docs\/hybrid-awp-routing-policy\.md\)/);
  assert.match(englishReadme, /\[Hybrid AWP routing policy\]\(docs\/hybrid-awp-routing-policy\.md\)/);
  assert.match(workflow, /\[Hybrid AWP routing policy\]\(hybrid-awp-routing-policy\.md\)/);
});
