import { Command } from 'commander';

const program = new Command();

program
  .name('spec')
  .description('Deterministic task package generator from GitHub issues')
  .version('0.1.0');

// plan subcommand
program
  .command('plan <issue>')
  .description('Generate a task package for a GitHub issue')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .option('--dry-run', 'Print output to stdout, do not write file')
  .option('--verbose', 'Show detailed matching steps')
  .option('--format <format>', 'Output format: full or prompt (default: full)')
  .action(async (issue: string, opts: { repo?: string; dryRun?: boolean; verbose?: boolean; format?: string }) => {
    const { plan } = await import('./plan.js');
    await plan(issue, opts);
  });

// init subcommand
program
  .command('init')
  .description('Scaffold .spec-injector/config.json in target repo')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .action(async (opts: { repo?: string }) => {
    const { init } = await import('./init.js');
    await init(opts);
  });

// validate subcommand
program
  .command('validate')
  .description('Validate .spec-injector/config.json against schema v2')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .action(async (opts: { repo?: string }) => {
    const { validate } = await import('./validate.js');
    await validate(opts);
  });

// clean subcommand
program
  .command('clean')
  .description('Remove generated task package files from .spec-injector/out')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .option('--issue <number>', 'Only remove the generated task package for one issue')
  .action(async (opts: { repo?: string; issue?: string }) => {
    const { clean } = await import('./clean.js');
    await clean(opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
});
