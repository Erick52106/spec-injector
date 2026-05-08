import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runCommand, runSpec, repoRoot } from './helpers/cli.ts';
import { assertNoGhMutationCommands, assertNoRawStackTrace } from './helpers/assertions.ts';

const ISSUE_URL = 'https://github.com/Erick52106/spec-injector/issues/61';
const ISSUE_NUMBER = '#61';
const LABEL_AUDIT_REPO = 'Erick52106/spec-injector';
const LABEL_AUDIT_LIMIT = '5';

function formatSpecPlanFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('rate limit')) {
    return `Optional gh smoke test failed due rate limit or GitHub quota: ${message}`;
  }

  if (lower.includes('connection') || lower.includes('timed out') || lower.includes('network')) {
    return `Optional gh smoke test failed due network issue: ${message}`;
  }

  if (lower.includes('authentication') || lower.includes('must authenticate')) {
    return `Optional gh smoke test failed because GitHub authentication is required: ${message}`;
  }

  return `Optional gh smoke test failed for live spec plan execution. This is optional and may be environment-dependent. ${message}`;
}

type LiveGhSpy = {
  env: NodeJS.ProcessEnv;
  ghLogPath: string;
  cleanup: () => Promise<void>;
};

async function createLiveGhSpy(): Promise<LiveGhSpy> {
  const whichResult = await runCommand('which', ['gh'], repoRoot);
  const realGhPath = whichResult.stdout.trim();
  if (!realGhPath) {
    assert.fail('Optional gh smoke test precondition failed: unable to resolve real gh executable path.');
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-live-gh-smoke-'));
  const ghLogPath = path.join(tempDir, 'gh.log');
  const ghPath = path.join(tempDir, 'gh');

  const escapedGhPath = realGhPath.replaceAll("'", "'\\''");
  const escapedLogPath = ghLogPath.replaceAll("'", "'\\''");

  await fs.writeFile(
    ghPath,
    [
      '#!/usr/bin/env sh',
      `REAL_GH='${escapedGhPath}'`,
      `LOG_PATH='${escapedLogPath}'`,
      'printf "%s\\n" "$*" >> "$LOG_PATH"',
      'exec "$REAL_GH" "$@"',
      '',
    ].join('\n'),
    'utf8'
  );
  await fs.chmod(ghPath, 0o755);

  return {
    env: {
      ...process.env,
      PATH: `${tempDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
    ghLogPath,
    cleanup: async () => {
      await fs.rm(tempDir, { force: true, recursive: true });
    },
  };
}

function assertNoLiveGhMutationCommands(logValue: string): void {
  const lines = logValue.split('\n').map((line) => line.trim()).filter(Boolean);

  assertNoGhMutationCommands(logValue);

  for (const line of lines) {
    const [resource, action] = line.split(/\s+/).map((value) => value.toLowerCase());
    if (resource === 'label' && ['create', 'edit', 'delete'].includes(action ?? '')) {
      assert.fail(`Unexpected mutating gh command: ${line}`);
    }
    if (resource === 'issue' && ['edit', 'close', 'comment', 'reopen'].includes(action ?? '')) {
      assert.fail(`Unexpected mutating gh command: ${line}`);
    }
    if (resource === 'pr' && ['edit', 'merge', 'comment', 'close', 'reopen'].includes(action ?? '')) {
      assert.fail(`Unexpected mutating gh command: ${line}`);
    }
    if (resource === 'api' && /\b(PATCH|POST|DELETE)\b/i.test(line)) {
      assert.fail(`Unexpected mutating gh api command: ${line}`);
    }
  }
}

function assertNoLabelAuditReadFailures(output: string): void {
  const lowerOutput = output.toLowerCase();
  const forbiddenPatterns = [
    'could not read gh issue list output',
    'could not read gh pr list output',
    'could not parse gh issue list output',
    'could not parse gh pr list output',
    'could not parse accepted taxonomy markers',
    'could not parse workflow layer-to-milestone mapping',
    'gh issue list output is missing required fields',
    'gh pr list output is missing required fields',
    'failed to parse',
    'api error',
    'gh issue list failed',
    'gh pr list failed',
    'rate limit',
    'authentication',
  ];

  for (const pattern of forbiddenPatterns) {
    assert.ok(!lowerOutput.includes(pattern), `label-audit live smoke should not report read/parse/API failures, found: ${pattern}`);
  }
}

test(
  'optional gh smoke test: `spec plan` against public issue 61',
  { skip: process.env.SPEC_INJECTOR_RUN_GH_TESTS !== '1' },
  async () => {
    try {
      await runCommand('gh', ['--version'], repoRoot);
    } catch (error) {
      assert.fail(
        'Optional gh smoke test precondition failed: gh CLI is not available or not callable. ' +
          'Please install `gh` and ensure it is on PATH, then run `pnpm test:gh` again.\n' +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await runCommand('gh', ['auth', 'status', '--active', '--hostname', 'github.com'], repoRoot);
    } catch (error) {
      assert.fail(
        'Optional gh smoke test precondition failed: gh auth status --active --hostname github.com is not usable.\n' +
          'Please run `gh auth login --hostname github.com` before `pnpm test:gh`, or run `gh auth status --active --hostname github.com` to verify active GitHub auth.\n' +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const tempConfigDir = await fs.mkdtemp(path.join(os.tmpdir(), 'spec-injector-smoke-config-'));
    const configPath = path.join(tempConfigDir, 'config.json');
    try {
      await fs.writeFile(configPath, `${JSON.stringify({ version: 2 }, null, 2)}\n`, 'utf8');
    } catch (error) {
      await fs.rm(tempConfigDir, { force: true, recursive: true });
      assert.fail(
        `Optional gh smoke test precondition failed: unable to prepare temporary config at ${configPath}.\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let result;
    try {
      result = await runSpec([
        'plan',
        ISSUE_URL,
        '--dry-run',
        '--format',
        'prompt',
        '--config',
        configPath,
      ]).catch((error: unknown) => {
        throw new Error(formatSpecPlanFailure(error));
      });
    } finally {
      await fs.rm(tempConfigDir, { force: true, recursive: true });
    }

    assert.strictEqual(result.code, 0, 'spec plan should exit with code 0 for the smoke test target issue');
    assert.ok(result.stdout.includes('# Implementation Plan Prompt:'), 'prompt output should include prompt title');
    assert.ok(result.stdout.includes('## 1. Issue Summary'), 'prompt output should include issue summary section');
    assert.ok(result.stdout.includes(`- Issue: ${ISSUE_NUMBER}`), 'prompt output should include parsed issue number');
    assert.ok(result.stdout.includes('Suggested verification checklist:'), 'prompt output should include the suggestion section');
    assert.ok(result.stdout.includes('Read the referenced files as needed'), 'prompt output should include output contract tail text');
    assert.ok(result.stdout.length > 0, 'prompt output should not be empty');
    assertNoRawStackTrace(result);
  }
);

test(
  'optional gh smoke test: `spec label-audit` against this repo',
  { skip: process.env.SPEC_INJECTOR_RUN_GH_TESTS !== '1' },
  async () => {
    try {
      await runCommand('gh', ['--version'], repoRoot);
    } catch (error) {
      assert.fail(
        'Optional gh smoke test precondition failed: gh CLI is not available or not callable. ' +
          'Please install `gh` and ensure it is on PATH, then run `pnpm test:gh` again.\n' +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    try {
      await runCommand('gh', ['auth', 'status', '--active', '--hostname', 'github.com'], repoRoot);
    } catch (error) {
      assert.fail(
        'Optional gh smoke test precondition failed: gh auth status --active --hostname github.com is not usable.\n' +
          'Please run `gh auth login --hostname github.com` before `pnpm test:gh`, or run `gh auth status --active --hostname github.com` to verify active GitHub auth.\n' +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const liveGh = await createLiveGhSpy();
    try {
      const result = await runSpec(
        ['label-audit', '--repo', LABEL_AUDIT_REPO, '--limit', LABEL_AUDIT_LIMIT],
        { env: liveGh.env }
      );

      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      // Keep opt-in tolerance for metadata quality states (warning/needs-human-review),
      // but fail fast when live GitHub reads / parsing are broken.
      assert.ok(result.code === 0 || result.code === 1, `expected exit code 0 or 1, got ${String(result.code)}`);
      assert.match(result.stdout, /Label audit summary:/i);
      assert.match(result.stdout, /Label audit summary:\s+(PASS|WARNING|NEEDS-HUMAN-REVIEW|FAIL)/i);
      assert.ok(result.stdout.length > 0 || result.stderr.length > 0, 'label-audit command should emit output');
      assertNoLabelAuditReadFailures(combinedOutput);

      const ghLog = (await fs.readFile(liveGh.ghLogPath, 'utf8')).trim();
      assert.ok(
        ghLog.includes('issue list') && ghLog.includes('--limit 5'),
        'label-audit should execute gh issue list with the configured limit'
      );
      assert.ok(
        ghLog.includes('pr list') && ghLog.includes('--limit 5'),
        'label-audit should execute gh pr list with the configured limit'
      );
      assert.ok(ghLog.includes(LABEL_AUDIT_REPO), 'label-audit should be scoped to target repository');
      assertNoLiveGhMutationCommands(ghLog);
      assert.match(combinedOutput, /Label audit summary:/i);
      assertNoRawStackTrace(result);

    } finally {
      await liveGh.cleanup();
    }
  }
);
