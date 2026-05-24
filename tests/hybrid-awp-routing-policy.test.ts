import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { repoRoot } from './helpers/cli.ts';

test('repo-local AWP instructions require dispatch or explicit fallback evidence before implementation', async () => {
  const agentsPath = path.join(repoRoot, 'AGENTS.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');
  const handoffPath = path.join(repoRoot, 'docs', 'agent-handoff.md');
  const policyPath = path.join(repoRoot, 'docs', 'hybrid-awp-routing-policy.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [agents, workflow, handoff, policy, readme, englishReadme] = await Promise.all([
    fs.readFile(agentsPath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
    fs.readFile(handoffPath, 'utf8'),
    fs.readFile(policyPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(agents, /AWP \/ autonomous routing signal/);
  assert.match(agents, /controller_fallback_reason/);
  assert.match(agents, /delegation_outcome/);
  assert.match(agents, /repo-native workflow compliance 不等於 AWP delegation evidence/);

  assert.match(workflow, /Autonomous \/ AWP start-gate overlay/);
  assert.match(workflow, /after startup safety checks/);
  assert.match(workflow, /before implementation/);
  assert.match(workflow, /worker dispatch/);
  assert.match(workflow, /controller-direct fallback/);
  assert.match(workflow, /delegation_outcome/);

  assert.match(handoff, /AWP controller \/ worker handoff/);
  assert.match(handoff, /repo-native workflow compliance is not delegation proof/);
  assert.match(handoff, /dispatch worker/);
  assert.match(handoff, /controller-direct fallback/);

  assert.match(policy, /repo-native issue\/worktree\/evidence compliance does not prove AWP delegation occurred/);
  assert.match(policy, /worker dispatch or an explicit controller-direct fallback/);

  assert.doesNotMatch(agents, /controller-direct fallback[\s\S]{0,200}fell_through/);

  assert.match(readme, /AWP-signaled workflow/);
  assert.match(readme, /ordinary issue-to-PR workflow does not prove worker dispatch/);
  assert.match(englishReadme, /AWP-signaled workflow/);
  assert.match(englishReadme, /ordinary issue-to-PR workflow does not prove worker dispatch/);
});

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

test('supervised remediation loop design remains design-only and linked from workflow docs', async () => {
  const designPath = path.join(repoRoot, 'docs', 'supervised-remediation-loop.md');
  const workflowPath = path.join(repoRoot, 'docs', 'workflow.md');
  const readmePath = path.join(repoRoot, 'README.md');
  const englishReadmePath = path.join(repoRoot, 'README.en.md');

  const [design, workflow, readme, englishReadme] = await Promise.all([
    fs.readFile(designPath, 'utf8'),
    fs.readFile(workflowPath, 'utf8'),
    fs.readFile(readmePath, 'utf8'),
    fs.readFile(englishReadmePath, 'utf8'),
  ]);

  assert.match(design, /Supervised Remediation Loop Design/);
  assert.match(design, /Finding To Commit Traceability/);
  assert.match(design, /Stale Finding Prevention/);
  assert.match(design, /Validation Refresh/);
  assert.match(design, /Relationship To Existing Guardrails/);
  assert.match(design, /Do Not Automate/);
  assert.match(design, /must not become a remediation bot/i);
  assert.match(design, /must not call GitHub mutation APIs/i);
  assert.match(design, /human merge decision/i);

  assert.match(workflow, /\[supervised-remediation-loop\.md\]\(supervised-remediation-loop\.md\)/);
  assert.match(readme, /\[supervised remediation loop design\]\(docs\/supervised-remediation-loop\.md\)/);
  assert.match(englishReadme, /\[supervised remediation loop design\]\(docs\/supervised-remediation-loop\.md\)/);
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

test('4.6 and 4.7 readiness gates remain documented and linked from README showcase planning', async () => {
  const gatesPath = path.join(repoRoot, 'docs', 'readiness-gates.md');
  const showcasePath = path.join(repoRoot, 'docs', 'readme-showcase-readiness.md');

  const [gates, showcase] = await Promise.all([
    fs.readFile(gatesPath, 'utf8'),
    fs.readFile(showcasePath, 'utf8'),
  ]);

  assert.match(showcase, /\[readiness-gates\.md\]\(readiness-gates\.md\)/);
  assert.match(gates, /4\.6\+ Readiness/);
  assert.match(gates, /4\.7 Readiness/);
  assert.match(gates, /Why 4\.8\+ Remains Blocked/);
  assert.match(gates, /Third Dogfood Gate/);
  assert.match(gates, /#206 zh-TW Classifier Gate/);
  assert.match(gates, /Layer 3 Protocol Boundary/);
  assert.match(gates, /Layer 4 Visual \/ Companion \/ Status Boundary/);
  assert.match(gates, /README \/ Visual Overclaim Checklist/);
  assert.match(gates, /#149 remains parked/);
  assert.match(gates, /Do not close #198, #206, or #149/);
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
