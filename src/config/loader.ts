import path from 'path';
import fs from 'fs';
import { safeReadFile } from '../utils/fs.js';
import type { Config, SpecConfig, Guardrail } from './types.js';

interface LoadConfigOptions {
  configPath?: string;
}

export async function loadConfig(repoPath: string, opts: LoadConfigOptions = {}): Promise<Config> {
  const resolved = path.resolve(repoPath);
  if (opts.configPath) {
    return loadExternalConfig(resolved, opts.configPath);
  }

  const specAgentDir = findSpecAgentDir(resolved);

  const configPath = path.join(specAgentDir, 'config.json');
  const configText = await safeReadFile(configPath);
  if (configText === null) {
    return { repoPath: resolved, specAgentDir, specConfig: { version: 2, guardrails: [] } };
  }

  let specConfig: SpecConfig;
  try {
    specConfig = parseAndValidateConfig(configText, configPath);
  } catch (err) {
    throw new Error(`Invalid config.json: ${(err as Error).message}`);
  }

  return { repoPath: resolved, specAgentDir, specConfig };
}

async function loadExternalConfig(repoPath: string, configPath: string): Promise<Config> {
  const resolvedConfigPath = path.resolve(configPath);
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolvedConfigPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`External config file not found: ${resolvedConfigPath}`);
    }
    throw new Error(`External config file is not readable: ${resolvedConfigPath}: ${(err as Error).message}`);
  }

  if (!stat.isFile()) {
    throw new Error(`External config path is not a file: ${resolvedConfigPath}`);
  }

  let configText: string;
  try {
    configText = await fs.promises.readFile(resolvedConfigPath, 'utf8');
  } catch (err) {
    throw new Error(`External config file is not readable: ${resolvedConfigPath}: ${(err as Error).message}`);
  }

  let specConfig: SpecConfig;
  try {
    specConfig = parseAndValidateConfig(configText, resolvedConfigPath);
  } catch (err) {
    throw new Error(`Invalid config.json at ${resolvedConfigPath}: ${(err as Error).message}`);
  }

  return { repoPath, specAgentDir: path.dirname(resolvedConfigPath), specConfig };
}

function findSpecAgentDir(startPath: string): string {
  let current = startPath;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, '.spec-injector');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(
    `No .spec-injector/ directory found in or above ${startPath}. Run "spec init" to create one.`
  );
}

function requireStringArray(val: unknown, field: string): string[] {
  if (!Array.isArray(val)) throw new Error(`${field} must be an array, got ${typeof val}`);
  for (let i = 0; i < val.length; i++) {
    if (typeof val[i] !== 'string') throw new Error(`${field}[${i}] must be a string, got ${typeof val[i]}`);
  }
  return val as string[];
}

function parseAndValidateConfig(text: string, filePath: string): SpecConfig {
  const raw = JSON.parse(text) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`${filePath} is empty or not a valid JSON object`);
  }

  const version = raw['version'];
  if (version !== 2) {
    throw new Error(`Expected version: 2, got: ${String(version)}`);
  }

  // project (optional)
  let project: SpecConfig['project'];
  if (raw['project'] !== undefined) {
    const p = raw['project'] as Record<string, unknown>;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) {
      throw new Error('project must be an object');
    }
    if (p['name'] !== undefined && typeof p['name'] !== 'string') {
      throw new Error('project.name must be a string');
    }
    if (p['type'] !== undefined && typeof p['type'] !== 'string') {
      throw new Error('project.type must be a string');
    }
    project = {
      name: p['name'] as string | undefined,
      type: p['type'] as string | undefined,
    };
  }

  // always_read (optional)
  const alwaysRead = raw['always_read'] !== undefined
    ? requireStringArray(raw['always_read'], 'always_read')
    : undefined;

  // discovery (optional)
  let discovery: SpecConfig['discovery'];
  if (raw['discovery'] !== undefined) {
    const d = raw['discovery'] as Record<string, unknown>;
    if (typeof d !== 'object' || d === null || Array.isArray(d)) {
      throw new Error('discovery must be an object');
    }
    discovery = {
      docs: d['docs'] !== undefined ? requireStringArray(d['docs'], 'discovery.docs') : undefined,
      source: d['source'] !== undefined ? requireStringArray(d['source'], 'discovery.source') : undefined,
      exclude: d['exclude'] !== undefined ? requireStringArray(d['exclude'], 'discovery.exclude') : undefined,
      max_docs: typeof d['max_docs'] === 'number' ? d['max_docs'] : undefined,
      max_source_files: typeof d['max_source_files'] === 'number' ? d['max_source_files'] : undefined,
    };
  }

  // guardrails (optional)
  let guardrails: Guardrail[] | undefined;
  if (raw['guardrails'] !== undefined) {
    if (!Array.isArray(raw['guardrails'])) {
      throw new Error('guardrails must be an array');
    }
    guardrails = (raw['guardrails'] as unknown[]).map((g: unknown, i: number) => {
      const item = g as Record<string, unknown>;
      if (typeof item['id'] !== 'string') throw new Error(`guardrails[${i}].id must be a string`);
      if (typeof item['risk'] !== 'string') throw new Error(`guardrails[${i}].risk must be a string`);
      const whenDetected = requireStringArray(item['when_detected'] ?? [], `guardrails[${i}].when_detected`);
      return { id: item['id'] as string, when_detected: whenDetected, risk: item['risk'] as string };
    });
  }

  return { version: 2, project, always_read: alwaysRead, discovery, guardrails };
}
