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

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
