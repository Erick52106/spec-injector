import path from 'path';
import fs from 'fs';

const EXAMPLE_RULES = `version: 1

rules:
  - id: backend
    description: "Backend changes"
    match:
      title_contains:
        - "[backend]"
      label_contains:
        - "backend"
      body_contains: []
    docs:
      - "docs/architecture.md"
    hints:
      - "Follow existing patterns in the codebase"

defaults:
  docs:
    - "README.md"
  hints:
    - "Check existing patterns before implementing"
`;

const EXAMPLE_TEMPLATE = `# Task Package: {{issue_title}}

**Issue:** [#{{issue_number}}]({{issue_url}})
**Generated:** {{generated_at}}

---

## Issue Description

{{issue_body}}

---

## Implementation Scope

{{matched_hints}}

---

## Relevant Documentation

{{doc_sections}}

---

## Acceptance Checklist

{{issue_checklist}}
`;

export async function init(opts: { repo?: string }): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const specAgentDir = path.join(repoPath, '.spec-agent');
  const outDir = path.join(specAgentDir, 'out');

  if (fs.existsSync(specAgentDir)) {
    console.error(`⚠  .spec-agent/ already exists at ${specAgentDir}`);
    console.error('   Remove it manually before re-running init.');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(specAgentDir, 'rules.yaml'), EXAMPLE_RULES, 'utf8');
  fs.writeFileSync(path.join(specAgentDir, 'prompt-template.md'), EXAMPLE_TEMPLATE, 'utf8');
  fs.writeFileSync(path.join(specAgentDir, '.gitignore'), 'out/\n', 'utf8');

  console.log(`✓ .spec-agent/ initialized at ${specAgentDir}`);
  console.log('  Files created:');
  console.log('    .spec-agent/rules.yaml');
  console.log('    .spec-agent/prompt-template.md');
  console.log('    .spec-agent/.gitignore  (ignores out/)');
  console.log("\nEdit rules.yaml to match your repo's issue conventions.");
}
