import path from 'path';
import { loadConfig } from '../config/loader.js';

export async function validate(opts: { repo?: string }): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());

  try {
    const config = await loadConfig(repoPath);
    const { rules, defaults } = config.rulesFile;
    console.log('✓ rules.json is valid');
    console.log(`  Rules: ${rules.length}`);
    for (const rule of rules) {
      const matchCount = [
        ...(rule.match.title_contains ?? []),
        ...(rule.match.label_contains ?? []),
        ...(rule.match.body_contains ?? []),
      ].length;
      console.log(`    [${rule.id}] ${rule.description} — ${matchCount} match terms, ${rule.docs.length} docs`);
    }
    if (defaults) {
      console.log(`  Defaults: ${defaults.docs?.length ?? 0} docs, ${defaults.hints?.length ?? 0} hints`);
    }
  } catch (err) {
    console.error(`✗ Validation failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
