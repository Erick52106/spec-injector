import test from 'node:test';
import assert from 'node:assert/strict';
import { runSpec } from './helpers/cli.ts';
import {
  createLabelAuditFixture,
  createTempRepo,
  readGhLog,
  writeRepoFiles,
} from './helpers/fixtures.ts';
import {
  assertNoGhMutationCommands,
  assertNoRawStackTrace,
} from './helpers/assertions.ts';

test('spec label-audit forwards --limit to gh issue and pr list', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [],
    prs: [],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
    '--limit', '25',
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assert.match(ghLog, /issue list[\s\S]*--limit 25/);
  assert.match(ghLog, /pr list[\s\S]*--limit 25/);
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit passes for open issues with accepted type, area, status, layer, and milestone metadata', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 110,
      title: 'feat(workflow): add issue label audit for area/type/status taxonomy',
      url: `https://github.com/${'Erick52106/spec-injector'}/issues/110`,
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.match(result.stdout, /issue #110 has type metadata/i);
  assert.match(result.stdout, /issue #110 has area metadata/i);
  assert.match(result.stdout, /issue #110 has status metadata/i);
  assert.match(result.stdout, /issue #110 milestone matches layer label/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports multiple type labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 213,
      title: 'conflicting type labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/213',
      state: 'OPEN',
      labels: [
        { name: 'bug' },
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #213 has multiple type labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports more than three area labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 214,
      title: 'too many area labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/214',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'area:docs' },
        { name: 'area:cli' },
        { name: 'area:tooling' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #214 has too many area labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when open issues are missing area, status, or type metadata', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [
      {
        number: 201,
        title: 'missing area metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/201',
        state: 'OPEN',
        labels: [
          { name: 'enhancement' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 202,
        title: 'missing status metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/202',
        state: 'OPEN',
        labels: [
          { name: 'enhancement' },
          { name: 'area:workflow' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 203,
        title: 'missing type metadata',
        url: 'https://github.com/Erick52106/spec-injector/issues/203',
        state: 'OPEN',
        labels: [
          { name: 'area:workflow' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
    ],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #201 is missing a primary area label/i);
  assert.match(result.stdout, /issue #202 is missing a status label/i);
  assert.match(result.stdout, /issue #203 is missing a type or GitHub default equivalent label/i);
  assert.equal(result.stderr, '');
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports conflicting active status labels as needs human review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 204,
      title: 'conflicting status labels',
      url: 'https://github.com/Erick52106/spec-injector/issues/204',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'status:needs-design' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /issue #204 has conflicting active status labels/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a closed completed issue lacks status:implemented', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 205,
      title: 'closed completed without implemented status',
      url: 'https://github.com/Erick52106/spec-injector/issues/205',
      state: 'CLOSED',
      stateReason: 'COMPLETED',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #205 is closed as completed without status:implemented/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit does not require status:implemented for issues closed as not planned', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 206,
      title: 'closed not planned without implemented status',
      url: 'https://github.com/Erick52106/spec-injector/issues/206',
      state: 'CLOSED',
      stateReason: 'NOT_PLANNED',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.match(result.stdout, /issue #206 is closed as not planned and does not require status:implemented/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit keeps accepted keep-as-is labels out of unknown-label warnings', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [
      {
        number: 207,
        title: 'keep-as-is chore issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/207',
        state: 'OPEN',
        labels: [
          { name: 'type:chore' },
          { name: 'area:tooling' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 208,
        title: 'keep-as-is ci issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/208',
        state: 'OPEN',
        labels: [
          { name: 'type:ci' },
          { name: 'area:ci' },
          { name: 'status:ready' },
          { name: 'layer2 : Workflow Guardrails' },
        ],
        milestone: { title: 'Layer 2 — Workflow Guardrails' },
      },
      {
        number: 209,
        title: 'keep-as-is refactor issue',
        url: 'https://github.com/Erick52106/spec-injector/issues/209',
        state: 'OPEN',
        labels: [
          { name: 'type:refactor' },
          { name: 'area:cli' },
          { name: 'status:ready' },
          { name: 'layer1 : Core Compiler' },
        ],
        milestone: { title: 'Layer 1 — Core Compiler' },
      },
    ],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+PASS/i);
  assert.doesNotMatch(result.stdout, /unknown label/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns on unknown labels without suggesting automatic deletion', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 210,
      title: 'unknown label issue',
      url: 'https://github.com/Erick52106/spec-injector/issues/210',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
        { name: 'surprise:custom' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #210 uses unknown labels/i);
  assert.match(result.stdout, /surprise:custom/);
  assert.doesNotMatch(result.stdout, /\bdelete\b/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when an open ready issue has a non-draft PR but is not marked status:in-review', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 211,
      title: 'ready issue with active review PR',
      url: 'https://github.com/Erick52106/spec-injector/issues/211',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
    prs: [{
      number: 311,
      title: 'feat(workflow): active review PR',
      url: 'https://github.com/Erick52106/spec-injector/pull/311',
      labels: [{ name: 'area:workflow' }],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
      closingIssuesReferences: [{ number: 211 }],
      isDraft: false,
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #211 may need status:in-review because open PR #311 is not draft/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a PR has a layer label but no milestone', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    prs: [{
      number: 312,
      title: 'workflow PR without milestone',
      url: 'https://github.com/Erick52106/spec-injector/pull/312',
      labels: [{ name: 'layer2 : Workflow Guardrails' }],
      milestone: null,
      closingIssuesReferences: [],
      isDraft: false,
    }],
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /PR #312 is missing a roadmap milestone/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit warns when a layer label has no configured milestone mapping', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [{
      number: 215,
      title: 'unmapped layer milestone issue',
      url: 'https://github.com/Erick52106/spec-injector/issues/215',
      state: 'OPEN',
      labels: [
        { name: 'enhancement' },
        { name: 'area:workflow' },
        { name: 'status:ready' },
        { name: 'layer2 : Workflow Guardrails' },
      ],
      milestone: { title: 'Layer 2 — Workflow Guardrails' },
    }],
  });
  const repoDir = await createTempRepo(t, 'spec-injector-label-audit-taxonomy-');
  await writeRepoFiles(repoDir, {
    'docs/label-taxonomy.md': [
      '# Minimal taxonomy',
      '',
      '- Type labels: `type:chore`, `type:ci`, `type:design`, `type:refactor`, `type:test`.',
      '- Area labels: `area:workflow`, `area:docs`, `area:cli`, `area:tooling`.',
      '- Status labels: `status:blocked`, `status:implemented`, `status:in-review`, `status:needs-design`, `status:ready`.',
      '- Layer labels: `layer1 : Core Compiler`, `layer2 : Workflow Guardrails`.',
      '- GitHub default / equivalent labels: `bug`, `documentation`, `enhancement`.',
    ].join('\n'),
    'docs/workflow.md': [
      '# Workflow',
      '',
      '- `Layer 1 — Core Compiler` / `layer1 : Core Compiler`: core compiler.',
    ].join('\n'),
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env, cwd: repoDir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Label audit summary:\s+WARNING/i);
  assert.match(result.stdout, /issue #215 layer label has no configured roadmap milestone mapping/i);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports malformed gh output as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issueListCommand: {
      exitCode: 0,
      stdout: '{"not":"valid json"',
    },
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /could not parse gh issue list output/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports missing gh fields as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issueListCommand: {
      exitCode: 0,
      stdout: JSON.stringify([{
        number: 212,
        title: 'missing labels payload',
        url: 'https://github.com/Erick52106/spec-injector/issues/212',
        state: 'OPEN',
      }]),
    },
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /gh issue list output is missing required fields for issue #212/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});

test('spec label-audit reports missing taxonomy markers as needs human review without a raw stack trace', async (t) => {
  const fixture = await createLabelAuditFixture(t, {
    issues: [],
    prs: [],
  });
  const repoDir = await createTempRepo(t, 'spec-injector-label-audit-malformed-taxonomy-');
  await writeRepoFiles(repoDir, {
    'docs/label-taxonomy.md': [
      '# Broken taxonomy',
      '',
      '- Area labels: `area:workflow`.',
      '- Status labels: `status:ready`.',
      '- Layer labels: `layer2 : Workflow Guardrails`.',
      '- GitHub default / equivalent labels: `enhancement`.',
    ].join('\n'),
    'docs/workflow.md': [
      '# Workflow',
      '',
      '- `Layer 2 — Workflow Guardrails` / `layer2 : Workflow Guardrails`: workflow guardrails.',
    ].join('\n'),
  });

  const result = await runSpec([
    'label-audit',
    '--repo', fixture.repo,
  ], { env: fixture.env, cwd: repoDir });

  assert.notEqual(result.code, 0);
  assert.match(result.stdout, /Label audit summary:\s+NEEDS-HUMAN-REVIEW/i);
  assert.match(result.stdout, /could not parse accepted taxonomy markers/i);
  assertNoRawStackTrace(result);
  const ghLog = (await readGhLog(fixture.ghLogPath)).join('\n');
  assertNoGhMutationCommands(ghLog);
});
