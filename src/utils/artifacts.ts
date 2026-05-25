export function normalizeArtifactPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
}

export function isSpecArtifactPath(
  rawPath: string,
  options: { privateExcludes?: string[] } = {}
): boolean {
  const gitPath = normalizeArtifactPath(rawPath);
  if (!gitPath) return false;

  if (gitPath === '.spec-injector' || gitPath.startsWith('.spec-injector/')) return true;
  if (gitPath.startsWith('spec-output/') || gitPath.startsWith('spec-outputs/')) return true;
  if (/(^|\/)issue-\d+-task-package\.md$/i.test(gitPath)) return true;
  if (/(^|\/)(?:task-package|spec-output|spec-evidence)(?:[.-][^/]*)?\.(?:md|json|txt)$/i.test(gitPath)) return true;
  if (/(^|\/)(?:routing|readback|closeout|merge-closeout|awp-routing|awp-readback|local-routing|local-readback)(?:[-_.][^/]*)?\.(?:json|md|txt)$/i.test(gitPath)) return true;
  if (/(^|\/)\.?private[-_](?:context|ledger)(?:\/|\.md$|\.json$|\.txt$)/i.test(gitPath)) return true;

  return configuredPrivateArtifactPrefixes(options.privateExcludes ?? [])
    .some((prefix) => gitPath === prefix || gitPath.startsWith(`${prefix}/`));
}

export function configuredPrivateArtifactPrefixes(excludes: string[]): string[] {
  return excludes
    .map(normalizeArtifactPath)
    .filter((entry) => /private|secret|credential|context/i.test(entry));
}
