import { Command } from 'commander';

const program = new Command();

program
  .name('spec')
  .description('Deterministic CLI that turns GitHub issues into task packages')
  .showSuggestionAfterError()
  .showHelpAfterError('\nRun `spec --help` to see available commands.')
  .addHelpText('after', '\nUse `spec <command> --help` for command-specific usage and safety notes.\n')
  .version('0.1.0');

// plan subcommand
program
  .command('plan <issue>')
  .description('Read a GitHub issue via gh CLI and generate a task package')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .option('--config <path>', 'External config file path (may be outside target repo)')
  .option('--dry-run', 'Print output to stdout only; do not write a task package file')
  .option('--verbose', 'Show detailed pipeline steps while planning')
  .option('--format <format>', 'Output format: "full" task package or "prompt" compact AI planning prompt (default: full)')
  .addHelpText('after', `
Requires gh CLI with authentication to read the source issue.

Non-dry-run output:
  Writes .spec-injector/out/issue-<number>-task-package.md

Notes:
  --dry-run        Preview output without writing files
  --format prompt  Emit a compact AI planning prompt instead of the full package
  --config <path>  Read an external config file without copying it into the target repo
  --verbose        Print fetch / config / discovery pipeline steps
`)
  .action(async (issue: string, opts: { repo?: string; config?: string; dryRun?: boolean; verbose?: boolean; format?: string }) => {
    const { plan } = await import('./plan.js');
    await plan(issue, opts);
  });

// init subcommand
program
  .command('init')
  .description('Create .spec-injector/config.json and .spec-injector/.gitignore in a repo')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .addHelpText('after', `
Creates:
  .spec-injector/config.json
  .spec-injector/.gitignore

This command does not create GitHub Actions workflow files and does not modify runtime code.
`)
  .action(async (opts: { repo?: string }) => {
    const { init } = await import('./init.js');
    await init(opts);
  });

// validate subcommand
program
  .command('validate')
  .description('Validate .spec-injector/config.json and exit non-zero for invalid config')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .addHelpText('after', `
Checks .spec-injector/config.json against schema v2.

If config is missing, run \`spec init\` first.
`)
  .action(async (opts: { repo?: string }) => {
    const { validate } = await import('./validate.js');
    await validate(opts);
  });

// config subcommand
program
  .command('config <action> [section] [path]')
  .description('Manage .spec-injector/config.json settings (currently always-read only)')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .addHelpText('after', `
Supported section:
  always-read

Mutation rules:
  add/remove modify config.json
  suggest always-read does not modify config.json

Actions:
  list                    Print configured always-read entries
  add always-read <path>  Modify config.json by adding one path
  remove always-read <path>
                          Modify config.json by removing one path
  suggest always-read     Print deterministic suggestions only
`)
  .action(async (
    action: string,
    section: string | undefined,
    filePath: string | undefined,
    opts: { repo?: string }
  ) => {
    const { config } = await import('./config.js');
    await config(action, section, filePath, opts);
  });

// clean subcommand
program
  .command('clean')
  .description('Remove generated task package files from .spec-injector/out only')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .option('--issue <number>', 'Only remove .spec-injector/out/issue-<number>-task-package.md for one issue')
  .addHelpText('after', `
Safety:
  Removes only generated files matching .spec-injector/out/issue-<number>-task-package.md
  Does not remove .spec-injector/config.json, .spec-injector/.gitignore, or unrelated files
`)
  .action(async (opts: { repo?: string; issue?: string }) => {
    const { clean } = await import('./clean.js');
    await clean(opts);
  });

// preflight subcommand
program
  .command('preflight')
  .description('Run repo-local preflight checks for isolated worktree task execution')
  .option('--repo <path>', 'Path to the current implementation worktree (default: CWD)')
  .option('--expected-branch <name>', 'Expected current branch name for the dedicated worktree')
  .option('--expected-worktree-root <path>', 'Expected parent directory for dedicated worktrees')
  .option('--target-repo <path>', 'Optional target repo path for read-only safety checks')
  .addHelpText('after', `
Checks:
  - main repo clean / synced status
  - dedicated worktree vs main worktree
  - current branch and worktree cleanliness
  - expected branch and expected worktree root / naming
  - optional target repo read-only safety reminder

Safety:
  Does not auto-fix, stash, clean, reset, checkout, or mutate target repos.
  Failing checks should trigger stop-and-report before implementation continues.
`)
  .action(async (opts: {
    repo?: string;
    expectedBranch?: string;
    expectedWorktreeRoot?: string;
    targetRepo?: string;
  }) => {
    const { preflight } = await import('./preflight.js');
    await preflight(opts);
  });

// doctor subcommand
program
  .command('doctor')
  .description('Run local workflow capability readiness checks')
  .option('--workflow <workflow>', 'Workflow capability set to check: awp (default: awp)')
  .option('--format <format>', 'Output format: text or json (default: text)')
  .addHelpText('after', `
Checks:
  - AWP workflow-check command and start|commit|merge phase support
  - #242 workflow-check flags: --finding-disposition, --threshold-evidence, and --pr
  - awp-review-check availability when present
  - local package version and git commit metadata when available

Safety:
  Local-only capability check. Does not call GitHub, auto-install, auto-update, write files, or mutate target repos.
`)
  .action(async (opts: { workflow?: string; format?: string }) => {
    const { doctor } = await import('./doctor.js');
    await doctor(opts);
  });

// workflow-check subcommand
program
  .command('workflow-check')
  .description('Run local-only workflow gate checks for autonomous PR evidence')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .requiredOption('--phase <phase>', 'Workflow phase: start|commit|merge')
  .option('--format <format>', 'Output format: text or json (default: text)')
  .option('--issue <number-or-url>', 'Issue number or URL for start-phase dry-run bounded context checks')
  .option('--pr-body <path>', 'Path to a local PR body markdown file for commit/merge evidence checks')
  .option('--pr <number-or-url>', 'Pull request number or URL for read-only merge closeout readback')
  .option('--head-sha <sha>', 'Expected latest head SHA for merge evidence freshness checks')
  .option('--routing-evidence <path>', 'Path to local Hybrid AWP start-gate routing evidence JSON')
  .option('--finding-disposition <path>', 'Path to local review finding disposition evidence JSON')
  .option('--threshold-evidence <path>', 'Path to local threshold calibration evidence JSON')
  .addHelpText('after', `
Checks:
  - start: validate config; with --issue, dry-run bounded context generation without writing a task package
  - commit: detect staged .spec-injector/spec output/private context artifacts and optional PR body spec/routing evidence
  - merge: require final merge gate, spec gate status/ref, routing evidence alignment, finding disposition evidence, threshold evidence, and latest HEAD evidence in the local PR body
  - merge with --pr: collect read-only closeout readback evidence from gh without mutating GitHub

Safety:
  Local-only workflow gate. Prints to stdout by default.
  Does not edit GitHub, add/commit files, write task packages, comment, merge, or mutate downstream repos.
`)
  .action(async (opts: {
    repo?: string;
    phase: string;
    format?: string;
    issue?: string;
    pr?: string;
    prBody?: string;
    headSha?: string;
    routingEvidence?: string;
    findingDisposition?: string;
    thresholdEvidence?: string;
  }) => {
    const { workflowCheck } = await import('./workflow-check.js');
    await workflowCheck(opts);
  });

// awp-review-check subcommand
program
  .command('awp-review-check')
  .description('Run local-only AWP review triage, root-cause, patch-budget, and closeout ledger checks')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .requiredOption('--evidence <path>', 'Path to local AWP review evidence JSON')
  .option('--format <format>', 'Output format: text or json (default: text)')
  .addHelpText('after', `
Checks:
  - review batch freshness by reviewed HEAD vs current HEAD
  - duplicate finding collapse by fingerprint / duplicate_of evidence
  - repeated-concept root-cause and matrix-test evidence
  - follow-up patch budget and split assessment
  - closeout ledger disposition, rationale, validation, and evidence refs

Safety:
  Local-only evidence checker. Prints to stdout by default.
  Does not call GitHub, resolve review threads, comment, auto-fix, merge, close, or mutate downstream repos.
  PASS is evidence only; it is not approval or merge authorization.
`)
  .action(async (opts: { repo?: string; evidence: string; format?: string }) => {
    const { awpReviewCheck } = await import('./awp-review-check.js');
    await awpReviewCheck(opts);
  });

// evidence-check subcommand
program
  .command('evidence-check')
  .description('Run read-only PR and implementation evidence consistency checks')
  .requiredOption('--pr <number-or-url>', 'Pull request number or URL to inspect')
  .option('--repo <owner/name>', 'GitHub repository owner/name; inferred from PR URL when possible')
  .option('--issue <number>', 'Expected linked source issue number')
  .option('--expected-head <sha>', 'Expected latest PR head SHA')
  .option('--evidence-url <url>', 'Expected source issue implementation evidence comment URL')
  .option('--format <format>', 'Output format: text or json (default: text)')
  .addHelpText('after', `
Checks:
  - PR body linked issue, required sections, evidence URL, and HEAD freshness
  - source issue evidence comment presence and validation evidence
  - draft state, review finding assessment, and CI/check summary

Safety:
  Read-only guardrail. Does not edit PRs, edit/close issues, comment, merge, or resolve review threads.
  Stale HEAD or stale evidence should trigger stop-and-report before merge readiness.
`)
  .action(async (opts: {
    pr: string;
    repo?: string;
    issue?: string;
    expectedHead?: string;
    evidenceUrl?: string;
    format?: string;
  }) => {
    const { evidenceCheck } = await import('./evidence-check.js');
    await evidenceCheck(opts);
  });

// label-audit subcommand
program
  .command('label-audit')
  .description('Run a read-only label and milestone metadata audit for issues and PRs')
  .requiredOption('--repo <owner/name>', 'GitHub repository owner/name to audit')
  .option('--limit <number>', 'Maximum number of issues / PRs to fetch per list (default: 200)')
  .option('--format <format>', 'Output format: text or json (default: text)')
  .addHelpText('after', `
Checks:
  - open issue area / type / status coverage
  - conflicting status labels and needs-design vs active review PRs
  - unknown labels outside the accepted taxonomy snapshot
  - primary layer / roadmap milestone consistency

Safety:
  Reports only. Does not create, rename, delete, or mutate labels, issues, milestones, or PR metadata.
  Needs human review means stop-and-report; the checker does not auto-decide remediation.
`)
  .action(async (opts: {
    repo: string;
    limit?: string;
    format?: string;
  }) => {
    const { labelAudit } = await import('./label-audit.js');
    await labelAudit(opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
