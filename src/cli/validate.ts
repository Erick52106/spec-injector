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
