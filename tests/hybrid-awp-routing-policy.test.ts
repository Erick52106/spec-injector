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
  assert.match(contract, /spec workflow-check --help/);
  assert.match(contract, /--finding-disposition/);
  assert.match(contract, /--threshold-evidence/);
  assert.match(contract, /--pr(?!-)\b/);
  assert.match(contract, /spec doctor --workflow awp --format json/);
  assert.match(contract, /Do not commit `.spec-injector\/out\/`/);
  assert.match(contract, /tachigo/i);
  assert.match(contract, /tachiya/i);
  assert.match(workflow, /\[AI bootstrap install contract\]\(ai-bootstrap-install-contract\.md\)/);
  assert.match(readme, /\[AI bootstrap install contract\]\(docs\/ai-bootstrap-install-contract\.md\)/);
  assert.match(englishReadme, /\[AI bootstrap install contract\]\(docs\/ai-bootstrap-install-contract\.md\)/);
});

test('AWP dogfood outcome ledger remains linked from dogfood docs and README', async () => {
  const ledgerPath = path.join(repoRoot, 'docs', 'awp-dogfood-outcome-ledger.md');
  const dogfoodPath = path.join(repoRoot, 'docs', 'dogfood.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [ledger, dogfood, readme, englishReadme] = await Promise.all([
    fs.readFile(ledgerPath, 'utf8'),
    fs.readFile(dogfoodPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(ledger, /AWP Dogfood Outcome Ledger/);
  assert.match(ledger, /至少 3-5/);
  assert.match(ledger, /missed worker/i);
  assert.match(ledger, /over-delegated worker/i);
  assert.match(ledger, /workflow-check caught real issue/i);
  assert.match(ledger, /Scope Police false positive/i);
  assert.match(ledger, /review rounds/i);
  assert.match(ledger, /main rework reason/i);
  assert.match(ledger, /Workflow-created friction/);
  assert.match(ledger, /P0 must-fix/i);
  assert.match(ledger, /follow-up ledger/i);
  assert.match(ledger, /Downstream Scope Police should not parse full `spec plan` output/);

  assert.match(dogfood, /\[AWP Dogfood Outcome Ledger\]\(awp-dogfood-outcome-ledger\.md\)/);
  assert.match(readme, /\[docs\/awp-dogfood-outcome-ledger\.md\]\(docs\/awp-dogfood-outcome-ledger\.md\)/);
  assert.match(englishReadme, /\[docs\/awp-dogfood-outcome-ledger\.md\]\(docs\/awp-dogfood-outcome-ledger\.md\)/);
});

test('third brownfield dogfood report remains indexed with safety and caveat evidence', async () => {
  const dogfoodIndexPath = path.join(repoRoot, 'docs', 'dogfood.md');
  const reportPath = path.join(repoRoot, 'docs', 'dogfood', 'hono-2026-05-14.md');

  const [dogfoodIndex, report] = await Promise.all([
    fs.readFile(dogfoodIndexPath, 'utf8'),
    fs.readFile(reportPath, 'utf8'),
  ]);

  assert.match(dogfoodIndex, /\[Hono 2026-05-14 third brownfield dogfood\]\(dogfood\/hono-2026-05-14\.md\)/);
  assert.match(report, /honojs\/hono/);
  assert.match(report, /16c4e3885f51376cb6cbddc80eeae0202cd86234/);
  assert.match(report, /https:\/\/github\.com\/honojs\/hono\/issues\/4916/);
  assert.match(report, /Did not create `\.spec-injector\/` in target repo/);
  assert.match(report, /src\/utils\/cookie\.ts/);
  assert.match(report, /src\/helper\/cookie\/index\.ts/);
  assert.match(report, /src\/utils\/cookie\.test\.ts/);
  assert.match(report, /Verdict: `WARN`/);
  assert.match(report, /does not unblock #206/);
  assert.match(report, /No target repo code was modified/);
});

test('optional AWP delegation evidence manifest remains linked from policy docs and README', async () => {
  const manifestPath = path.join(repoRoot, 'docs', 'awp-delegation-evidence-manifest.md');
  const policyPath = path.join(repoRoot, 'docs', 'hybrid-awp-routing-policy.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [manifest, policy, readme, englishReadme] = await Promise.all([
    fs.readFile(manifestPath, 'utf8'),
    fs.readFile(policyPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(manifest, /Optional AWP Delegation Evidence Manifest/);
  assert.match(manifest, /worker profile/i);
  assert.match(manifest, /model/i);
  assert.match(manifest, /reasoning/i);
  assert.match(manifest, /assigned_scope/);
  assert.match(manifest, /result_summary/);
  assert.match(manifest, /closeout_status/);
  assert.match(manifest, /fallback_reason/);
  assert.match(manifest, /AI controller manual entry/);
  assert.match(manifest, /Agent wrapper \/ local runner/);
  assert.match(manifest, /Target repo local script/);
  assert.match(manifest, /only validate shape and readback consistency/i);
  assert.match(manifest, /must not:\s*\n\s*-\s*spawn, close, or manage subagents/i);
  assert.match(manifest, /cannot prove/);
  assert.match(manifest, /separate implementation issue/);
  assert.match(manifest, /Do not require non-AWP users to adopt this manifest/);

  assert.match(policy, /\[optional AWP delegation evidence manifest\]\(awp-delegation-evidence-manifest\.md\)/);
  assert.match(readme, /\[docs\/awp-delegation-evidence-manifest\.md\]\(docs\/awp-delegation-evidence-manifest\.md\)/);
  assert.match(englishReadme, /\[docs\/awp-delegation-evidence-manifest\.md\]\(docs\/awp-delegation-evidence-manifest\.md\)/);
});

test('release versioning policy documents patch, minor, major, and no-publish boundaries', async () => {
  const releasePath = path.join(repoRoot, 'docs', 'release.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [release, readme, englishReadme] = await Promise.all([
    fs.readFile(releasePath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(release, /Versioning Policy/);
  assert.match(release, /Patch version: default bump for merged deliverable changes/);
  assert.match(release, /CLI behavior, flags, output, error handling, or command routing/);
  assert.match(release, /No Patch Bump Needed/);
  assert.match(release, /capability checks/i);
  assert.match(release, /Minor bumps require human or high-level reviewer assessment/);
  assert.match(release, /Major bumps require explicit product-level approval/);
  assert.match(release, /simplified manual release PR/);
  assert.match(release, /No `pnpm publish`/);
  assert.match(release, /Anti-Churn Rules/);
  assert.match(release, /does not auto-publish npm packages/);

  assert.match(readme, /\[docs\/release\.md\]\(docs\/release\.md\)/);
  assert.match(englishReadme, /\[docs\/release\.md\]\(docs\/release\.md\)/);
});
