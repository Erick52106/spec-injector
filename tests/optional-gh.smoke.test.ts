import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runCommand, runSpec, repoRoot } from './helpers/cli.ts';
import { assertNoRawStackTrace } from './helpers/assertions.ts';

const ISSUE_URL = 'https://github.com/Erick52106/spec-injector/issues/61';
const ISSUE_NUMBER = '#61';

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
      await runCommand('gh', ['auth', 'status'], repoRoot);
    } catch (error) {
      assert.fail(
        'Optional gh smoke test precondition failed: gh auth status is not usable.\n' +
          'Please run `gh auth login` before `pnpm test:gh` to authenticate against GitHub.\n' +
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
