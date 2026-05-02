import path from 'path';

const DEFAULT_PLAN_DISCOVERY_EXCLUDES = [
  'docs/superpowers',
];

function normalizeDiscoveryPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep).replace(/^\.\//, '');
}

export function getPlanDiscoveryExcludePaths(configuredPaths: string[] = []): string[] {
  return [...new Set(
    [...DEFAULT_PLAN_DISCOVERY_EXCLUDES, ...configuredPaths]
      .map((filePath) => normalizeDiscoveryPath(filePath))
      .filter((filePath) => filePath.length > 0)
  )];
}

export function isPlanDiscoveryExcluded(filePath: string, excludePaths: Iterable<string>): boolean {
  const normalizedPath = normalizeDiscoveryPath(filePath).toLowerCase();

  for (const excludedPath of excludePaths) {
    const normalizedExcludedPath = normalizeDiscoveryPath(excludedPath).toLowerCase();
    if (normalizedPath === normalizedExcludedPath || normalizedPath.startsWith(`${normalizedExcludedPath}/`)) {
      return true;
    }
  }

  return false;
}
