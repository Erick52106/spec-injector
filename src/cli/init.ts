import path from 'path';
import fs from 'fs';

const EXAMPLE_RULES = {
  version: 1,
  always_read: [
    'CLAUDE.md',
    'AGENTS.md',
    'docs/architecture.md',
  ],
  rules: [
    {
      id: 'backend',
      description: 'Backend changes',
      match: {
        title_contains: ['[backend]'],
        label_contains: ['backend'],
        body_contains: [],
      },
      docs: ['docs/architecture.md'],
      hints: ['Follow existing patterns in the codebase'],
    },
  ],
  defaults: {
    docs: ['README.md'],
    hints: ['Check existing patterns before implementing'],
  },
};

export async function init(opts: { repo?: string }): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const specInjectorDir = path.join(repoPath, '.spec-injector');
  const outDir = path.join(specInjectorDir, 'out');

  if (fs.existsSync(specInjectorDir)) {
    console.error(`⚠  .spec-injector/ already exists at ${specInjectorDir}`);
    console.error('   Remove it manually before re-running init.');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(specInjectorDir, 'rules.json'),
    JSON.stringify(EXAMPLE_RULES, null, 2),
    'utf8'
  );
  fs.writeFileSync(path.join(specInjectorDir, '.gitignore'), 'out/\n', 'utf8');

  console.log(`✓ .spec-injector/ initialized at ${specInjectorDir}`);
  console.log('  Files created:');
  console.log('    .spec-injector/rules.json');
  console.log('    .spec-injector/.gitignore  (ignores out/)');
  console.log("\nEdit rules.json to match your repo's issue conventions.");
}
