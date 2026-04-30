import path from 'path';
import fs from 'fs';
import { safeReadFile } from '../utils/fs.js';
import { parseYaml } from './yaml-parser.js';
import type { Config, RulesFile, Rule } from './types.js';

export async function loadConfig(repoPath: string): Promise<Config> {
  const resolved = path.resolve(repoPath);
  const specAgentDir = findSpecAgentDir(resolved);

  const rulesPath = path.join(specAgentDir, 'rules.yaml');
  const rulesText = await safeReadFile(rulesPath);
  if (rulesText === null) {
    throw new Error(
      `No .spec-agent/rules.yaml found in ${resolved}. Run "spec init" to create one.`
    );
  }

  let rulesFile: RulesFile;
  try {
    rulesFile = parseAndValidateRules(rulesText, rulesPath);
  } catch (err) {
    throw new Error(`Invalid rules.yaml: ${(err as Error).message}`);
  }

  const templatePath = path.join(specAgentDir, 'prompt-template.md');
  const promptTemplate = await safeReadFile(templatePath);

  return {
    repoPath: resolved,
    specAgentDir,
    rulesFile,
    promptTemplate,
  };
}

function findSpecAgentDir(startPath: string): string {
  let current = startPath;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(current, '.spec-agent');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // reached filesystem root
    current = parent;
  }
  throw new Error(
    `No .spec-agent/ directory found in or above ${startPath}. Run "spec init" to create one.`
  );
}

function parseAndValidateRules(text: string, filePath: string): RulesFile {
  const raw = parseYaml(text) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`${filePath} is empty or not a valid YAML mapping`);
  }

  const version = raw['version'];
  if (version !== 1) {
    throw new Error(`Expected version: 1, got: ${String(version)}`);
  }

  const rawRules = raw['rules'];
  if (!Array.isArray(rawRules)) {
    throw new Error('rules must be a sequence');
  }

  const rules: Rule[] = rawRules.map((r: unknown, i: number) => {
    const rule = r as Record<string, unknown>;
    if (typeof rule['id'] !== 'string') throw new Error(`rules[${i}].id must be a string`);
    if (typeof rule['description'] !== 'string') throw new Error(`rules[${i}].description must be a string`);

    const match = (rule['match'] ?? {}) as Record<string, unknown>;
    const docs = Array.isArray(rule['docs']) ? (rule['docs'] as string[]) : [];
    const hints = Array.isArray(rule['hints']) ? (rule['hints'] as string[]) : [];

    return {
      id: rule['id'],
      description: rule['description'],
      match: {
        title_contains: toStringArray(match['title_contains']),
        label_contains: toStringArray(match['label_contains']),
        body_contains: toStringArray(match['body_contains']),
      },
      docs,
      hints,
    };
  });

  const rawDefaults = raw['defaults'] as Record<string, unknown> | undefined;

  return {
    version: 1,
    rules,
    defaults: rawDefaults
      ? {
          docs: toStringArray(rawDefaults['docs']),
          hints: toStringArray(rawDefaults['hints']),
        }
      : undefined,
  };
}

function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string');
}
