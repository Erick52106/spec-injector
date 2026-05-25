import fs from 'node:fs/promises';
import path from 'path';
import { loadConfig } from '../config/loader.js';
import { ensureRepoPath } from '../utils/fs.js';

export async function validate(opts: { repo?: string }): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());

  try {
    ensureRepoPath(repoPath);
    const config = await loadConfig(repoPath);
    const { specConfig } = config;
    console.log('✓ config.json is valid');
    console.log(`  Version: ${specConfig.version}`);
    if (specConfig.project) {
      console.log(`  Project: ${specConfig.project.name ?? '(unnamed)'} (${specConfig.project.type ?? 'unknown type'})`);
    }
    const alwaysRead = specConfig.always_read ?? [];
    console.log(`  Always-read: ${alwaysRead.length} file(s)`);
    if (specConfig.discovery) {
      const d = specConfig.discovery;
      console.log(`  Discovery — docs: ${(d.docs ?? []).length}, source dirs: ${(d.source ?? []).length}, exclude: ${(d.exclude ?? []).length}, max_docs: ${d.max_docs ?? 5}, max_source_files: ${d.max_source_files ?? 5}`);
      await warnFileShapedSourceEntries(repoPath, d.source ?? []);
    }
    const guardrails = specConfig.guardrails ?? [];
    console.log(`  Guardrails: ${guardrails.length}`);
    for (const g of guardrails) {
      console.log(`    [${g.id}] when: ${g.when_detected.join(', ')} — ${g.risk}`);
    }
  } catch (err) {
    console.error(`✗ Validation failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

async function warnFileShapedSourceEntries(repoPath: string, sourceEntries: string[]): Promise<void> {
  for (const entry of sourceEntries) {
    const absolutePath = path.resolve(repoPath, entry);
    if (!isPathInsideRepo(repoPath, absolutePath)) continue;
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.isFile()) {
        console.log(`  Warning: discovery.source entry \`${entry}\` is a file; discovery.source expects directory roots for auto-discovery, so this file will not be auto-discovered.`);
      }
    } catch {
      // Keep missing or unreadable source roots non-fatal during validate.
    }
  }
}

function isPathInsideRepo(repoPath: string, targetPath: string): boolean {
  const relative = path.relative(repoPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
