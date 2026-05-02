import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import type { SpecRunResult } from './cli.ts';

export async function assertFileExists(filePath: string): Promise<void> {
  await fs.access(filePath);
}

export async function assertFileMissing(filePath: string): Promise<void> {
  await assert.rejects(fs.access(filePath));
}

export function assertNoRawStackTrace(result: SpecRunResult): void {
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(combined, /\n\s*at .+\(.+:\d+:\d+\)|\n\s*at .+:\d+:\d+/);
}

export function assertDirtyWarning(stderr: string): void {
  assert.match(stderr, /target repo dirty/i);
  assert.match(stderr, /references may reflect the current worktree/i);
  assert.match(stderr, /human/i);
  assert.match(stderr, /continue without modifying files/i);
  assertNoCleanupCommands(stderr);
}

export function assertNoCleanupCommands(value: string): void {
  assert.doesNotMatch(value, /\bstash\b/i);
  assert.doesNotMatch(value, /\bclean\b/i);
  assert.doesNotMatch(value, /\breset\b/i);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

export function normalizePlanOutput(value: string): string {
  return value
    .replace(/\*\*Generated:\*\* .+/g, '**Generated:** <normalized>')
    .replace(/spec-injector-test-[^/]+/g, 'spec-injector-test-normalized')
    .replace(/spec-injector-gh-[^/]+/g, 'spec-injector-gh-normalized');
}

export function assertOrderedSubstrings(value: string, substrings: string[]): void {
  let previousIndex = -1;
  for (const substring of substrings) {
    const currentIndex = value.indexOf(substring);
    assert.notEqual(currentIndex, -1, `Missing substring: ${substring}`);
    assert.ok(
      currentIndex > previousIndex,
      `Expected "${substring}" to appear after "${substrings[substrings.indexOf(substring) - 1] ?? '<start>'}"`
    );
    previousIndex = currentIndex;
  }
}

export function sectionBetween(value: string, startMarker: string, endMarker: string): string {
  const startIndex = value.indexOf(startMarker);
  const endIndex = value.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not extract section between "${startMarker}" and "${endMarker}"`);
  }
  return value.slice(startIndex, endIndex);
}
