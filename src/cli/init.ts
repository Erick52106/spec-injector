import path from 'path';
import fs from 'fs';

const EXAMPLE_CONFIG = {
  version: 2,
  project: {
    name: "example",
    type: "fullstack",
  },
  always_read: [
    "CLAUDE.md",
    "AGENTS.md",
  ],
  discovery: {
    docs: [],
    source: ["src"],
    exclude: [],
    max_docs: 5,
    max_source_files: 5,
  },
  guardrails: [
    {
      id: "database-change",
      when_detected: ["database"],
      risk: "Database/schema changes require explicit issue scope and migration review.",
    },
  ],
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
    path.join(specInjectorDir, 'config.json'),
    JSON.stringify(EXAMPLE_CONFIG, null, 2),
    'utf8'
  );
  fs.writeFileSync(path.join(specInjectorDir, '.gitignore'), 'out/\n', 'utf8');

  console.log(`✓ .spec-injector/ initialized at ${specInjectorDir}`);
  console.log('  Files created:');
  console.log('    .spec-injector/config.json');
  console.log('    .spec-injector/.gitignore  (ignores out/)');
  console.log("\nEdit config.json to match your repo's guardrail conventions.");
}
