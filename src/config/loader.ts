import path from 'path';
import fs from 'fs';
import { safeReadFile } from '../utils/fs.js';
import type { Config, RulesFile, Rule } from './types.js';

export async function loadConfig(repoPath: string): Promise<Config> {
  const resolved = path.resolve(repoPath);
  const specAgentDir = findSpecAgentDir(resolved);

  const rulesPath = path.join(specAgentDir, 'rules.json');
  const rulesText = await safeReadFile(rulesPath);
  if (rulesText === null) {
    throw new Error(
      `No .spec-injector/rules.json found in ${resolved}. Run "spec init" to create one.`
    );
  }

  let rulesFile: RulesFile;
  try {
    rulesFile = parseAndValidateRules(rulesText, rulesPath);
  } catch (err) {
    throw new Error(`Invalid rules.json: ${(err as Error).message}`);
  }

  return {
    repoPath: resolved,
    specAgentDir,
    rulesFile,
  };
}

function findSpecAgentDir(startPath: string): string {
  let current = startPath;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, '.spec-injector');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
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

function parseAndValidateRules(text: string, filePath: string): RulesFile {
  const raw = JSON.parse(text) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`${filePath} is empty or not a valid JSON object`);
  }

  const version = raw['version'];
  if (version !== 1) {
    throw new Error(`Expected version: 1, got: ${String(version)}`);
  }

  const rawRules = raw['rules'];
  if (!Array.isArray(rawRules)) {
    throw new Error('rules must be an array');
  }

  const rules: Rule[] = rawRules.map((r: unknown, i: number) => {
    const rule = r as Record<string, unknown>;
    if (typeof rule['id'] !== 'string') throw new Error(`rules[${i}].id must be a string`);
    if (typeof rule['description'] !== 'string') throw new Error(`rules[${i}].description must be a string`);

    const match = (rule['match'] ?? {}) as Record<string, unknown>;

    return {
      id: rule['id'],
      description: rule['description'],
      match: {
        title_contains: requireStringArray(match['title_contains'] ?? [], `rules[${i}].match.title_contains`),
        label_contains: requireStringArray(match['label_contains'] ?? [], `rules[${i}].match.label_contains`),
        body_contains: requireStringArray(match['body_contains'] ?? [], `rules[${i}].match.body_contains`),
      },
      docs: requireStringArray(rule['docs'] ?? [], `rules[${i}].docs`),
      hints: requireStringArray(rule['hints'] ?? [], `rules[${i}].hints`),
    };
  });

  const rawDefaults = raw['defaults'] as Record<string, unknown> | undefined;

  return {
    version: 1,
    rules,
    defaults: rawDefaults
      ? {
          docs: requireStringArray(rawDefaults['docs'] ?? [], 'defaults.docs'),
          hints: requireStringArray(rawDefaults['hints'] ?? [], 'defaults.hints'),
        }
      : undefined,
  };
}
