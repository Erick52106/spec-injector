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
  .action(async (issue: string, opts: { repo?: string; dryRun?: boolean; verbose?: boolean }) => {
    const { plan } = await import('./plan.js');
    await plan(issue, opts);
  });

// init subcommand
program
  .command('init')
  .description('Scaffold .spec-agent/ config in target repo')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .action(async (opts: { repo?: string }) => {
    const { init } = await import('./init.js');
    await init(opts);
  });

// validate subcommand
program
  .command('validate')
  .description('Validate .spec-agent/rules.yaml syntax')
  .option('--repo <path>', 'Path to target repo (default: CWD)')
  .action(async (opts: { repo?: string }) => {
    const { validate } = await import('./validate.js');
    await validate(opts);
  });

program.parseAsync(process.argv);
