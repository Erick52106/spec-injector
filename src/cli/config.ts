import path from 'path';
import fs from 'fs';
import { ensureRepoPath } from '../utils/fs.js';

type ConfigAction = 'list' | 'add' | 'remove' | 'suggest';

interface ConfigCommandOptions {
  repo?: string;
}

function failConfigCommand(message: string): never {
  throw new Error(message);
}

export async function config(
  action: string,
  section: string | undefined,
  filePath: string | undefined,
  opts: ConfigCommandOptions
): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  ensureRepoPath(repoPath);

  const normalizedAction = parseAction(action);

  if (normalizedAction === 'suggest') {
    await suggestConfig(repoPath, section, filePath);
    return;
  }

  const configPath = path.join(repoPath, '.spec-injector', 'config.json');

  if (!fs.existsSync(configPath)) {
    failConfigCommand(`No .spec-injector/config.json found at ${configPath}\n  Run "spec init --repo ${repoPath}" first.`);
  }

  if (normalizedAction === 'list') {
    validateListArgs(section, filePath);
    listAlwaysRead(configPath);
    return;
  }

  if (section !== 'always-read') {
    failConfigCommand('Unsupported config section. This command currently only supports always-read.');
  }

  if (!filePath) {
    failConfigCommand(`Missing path. Usage: spec config ${normalizedAction} always-read <path> --repo <repo>`);
  }

  if (normalizedAction === 'add') {
    addAlwaysRead(configPath, filePath);
    return;
  }

  removeAlwaysRead(configPath, filePath);
}

function parseAction(action: string): ConfigAction {
  if (action === 'list' || action === 'add' || action === 'remove' || action === 'suggest') {
    return action;
  }
  failConfigCommand('Unsupported config action. Use list, add, remove, or suggest.');
}

async function suggestConfig(
  repoPath: string,
  section: string | undefined,
  filePath: string | undefined
): Promise<void> {
  if (section !== 'always-read') {
    failConfigCommand('Unsupported suggest section. Usage: spec config suggest always-read --repo <repo>');
  }

  if (filePath !== undefined) {
    failConfigCommand('The suggest always-read command does not accept a path. Usage: spec config suggest always-read --repo <repo>');
  }

  const { suggestAlwaysRead } = await import('./config-suggest.js');
  suggestAlwaysRead(repoPath);
}

function validateListArgs(section: string | undefined, filePath: string | undefined): void {
  if (section !== undefined && section !== 'always-read') {
    failConfigCommand('Unsupported config section. This command currently only supports always-read.');
  }

  if (filePath !== undefined) {
    failConfigCommand('The list action does not accept a path. Usage: spec config list [always-read] --repo <repo>');
  }
}

function readConfig(configPath: string): Record<string, unknown> {
  const text = fs.readFileSync(configPath, 'utf8');
  try {
    const raw = JSON.parse(text) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('config.json must be a JSON object');
    }
    return raw as Record<string, unknown>;
  } catch (err) {
    failConfigCommand(`Invalid config.json: ${(err as Error).message}`);
  }
}

function readAlwaysRead(raw: Record<string, unknown>): string[] {
  const value = raw['always_read'];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    failConfigCommand('Invalid config.json: always_read must be an array of strings');
  }
  return value as string[];
}

function writeConfig(configPath: string, raw: Record<string, unknown>): void {
  fs.writeFileSync(configPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

function listAlwaysRead(configPath: string): void {
  const raw = readConfig(configPath);
  const alwaysRead = readAlwaysRead(raw);

  if (alwaysRead.length === 0) {
    console.log('No always_read files configured.');
    return;
  }

  console.log('always_read files:');
  for (const item of alwaysRead) {
    console.log(`  ${item}`);
  }
}

function addAlwaysRead(configPath: string, filePath: string): void {
  const raw = readConfig(configPath);
  const alwaysRead = readAlwaysRead(raw);

  if (alwaysRead.includes(filePath)) {
    console.log(`always_read already includes: ${filePath}`);
    return;
  }

  raw['always_read'] = [...alwaysRead, filePath];
  writeConfig(configPath, raw);
  console.log(`✓ Added always_read file: ${filePath}`);
}

function removeAlwaysRead(configPath: string, filePath: string): void {
  const raw = readConfig(configPath);
  const alwaysRead = readAlwaysRead(raw);

  if (!alwaysRead.includes(filePath)) {
    console.log(`always_read does not include: ${filePath}`);
    return;
  }

  raw['always_read'] = alwaysRead.filter((item) => item !== filePath);
  writeConfig(configPath, raw);
  console.log(`✓ Removed always_read file: ${filePath}`);
}
