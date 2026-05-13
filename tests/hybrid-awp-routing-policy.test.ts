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

test('AWP review triage gate policy remains linked from CLI docs', async () => {
  const policyPath = path.join(repoRoot, 'docs', 'awp-review-triage-gates.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');

  const [policy, readme, englishReadme, workflow] = await Promise.all([
    fs.readFile(policyPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
  ]);

  assert.match(policy, /AWP Review Triage and Root-Cause Gates/);
  assert.match(policy, /finding_id=.*source=.*head_sha/s);
  assert.match(policy, /root_cause_assessment/);
  assert.match(policy, /patch budget/i);
  assert.match(policy, /closeout ledger/i);
  assert.match(policy, /Non-autonomous/);

  assert.match(readme, /spec awp-review-check --repo \. --evidence/);
  assert.match(readme, /\[AWP review triage gates\]\(docs\/awp-review-triage-gates\.md\)/);
  assert.match(englishReadme, /spec awp-review-check --repo \. --evidence/);
  assert.match(englishReadme, /\[AWP review triage gates\]\(docs\/awp-review-triage-gates\.md\)/);
  assert.match(workflow, /\[AWP review triage gates\]\(awp-review-triage-gates\.md\)/);
});

test('target repo adoption contract remains linked from workflow docs', async () => {
  const contractPath = path.join(repoRoot, 'docs', 'target-repo-adoption-contract.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');

  const [contract, workflow] = await Promise.all([
    fs.readFile(contractPath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
  ]);

  assert.match(contract, /Target Repo Adoption Contract/);
  assert.match(contract, /tachigo/i);
  assert.match(contract, /tachiya/i);
  assert.match(contract, /Do not commit `.spec-injector\/out\/`/);
  assert.match(contract, /does not mutate downstream repos/i);
  assert.match(workflow, /\[target repo adoption contract\]\(target-repo-adoption-contract\.md\)/);
});

test('AI bootstrap install contract remains linked from workflow docs and README', async () => {
  const contractPath = path.join(repoRoot, 'docs', 'ai-bootstrap-install-contract.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [contract, workflow, readme, englishReadme] = await Promise.all([
    fs.readFile(contractPath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(contract, /AI Bootstrap Install Contract/);
  assert.match(contract, /https:\/\/github\.com\/Erick52106\/spec-injector/);
  assert.match(contract, /SPEC_INJECTOR_DIR/);
  assert.match(contract, /node "\$SPEC_INJECTOR_DIR\/dist\/cli\/index\.js"/);
  assert.match(contract, /command -v spec/);
  assert.match(contract, /spec doctor --workflow awp --format json/);
  assert.match(contract, /Do not commit `.spec-injector\/out\/`/);
  assert.match(contract, /tachigo/i);
  assert.match(contract, /tachiya/i);
  assert.match(workflow, /\[AI bootstrap install contract\]\(ai-bootstrap-install-contract\.md\)/);
  assert.match(readme, /\[AI bootstrap install contract\]\(docs\/ai-bootstrap-install-contract\.md\)/);
  assert.match(englishReadme, /\[AI bootstrap install contract\]\(docs\/ai-bootstrap-install-contract\.md\)/);
});
