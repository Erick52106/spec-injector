import type { TemplateVars } from './types.js';

const UNREPLACED_PLACEHOLDER_PATTERNS = [
  /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}/g,
  /__[A-Z][A-Z0-9_]*__/g,
];

export function renderTemplate(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  assertNoUnreplacedPlaceholders(result);
  return result;
}

function assertNoUnreplacedPlaceholders(rendered: string): void {
  const placeholders = new Set<string>();

  for (const pattern of UNREPLACED_PLACEHOLDER_PATTERNS) {
    for (const match of rendered.matchAll(pattern)) {
      placeholders.add(normalizePlaceholder(match[0]));
    }
  }

  if (placeholders.size === 0) return;

  throw new Error(`Template rendering issue: unreplaced placeholder(s): ${[...placeholders].sort().join(', ')}`);
}

function normalizePlaceholder(value: string): string {
  if (!value.startsWith('{{')) return value;
  return value.replace(/\{\{\s*/, '{{').replace(/\s*\}\}/, '}}');
}
