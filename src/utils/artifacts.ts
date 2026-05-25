export function normalizeArtifactPath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
}

export type SpecArtifactKind =
  | 'spec-agent-dir'
  | 'spec-output-dir'
  | 'issue-task-package'
  | 'generated-spec-artifact'
  | 'routing-readback-artifact'
  | 'private-context'
  | 'configured-private-exclude';

export type SpecArtifactMatch = {
  path: string;
  kind: SpecArtifactKind;
  reason: string;
};

export function isSpecArtifactPath(
  rawPath: string,
  options: { privateExcludes?: string[] } = {}
): boolean {
  return classifySpecArtifactPath(rawPath, options) !== null;
}

export function classifySpecArtifactPath(
  rawPath: string,
  options: { privateExcludes?: string[] } = {}
): SpecArtifactMatch | null {
  const gitPath = normalizeArtifactPath(rawPath);
  if (!gitPath) return null;

  if (gitPath === '.spec-injector' || gitPath.startsWith('.spec-injector/')) {
    return artifactMatch(gitPath, 'spec-agent-dir', 'spec-injector workspace artifact');
  }
  if (gitPath.startsWith('spec-output/') || gitPath.startsWith('spec-outputs/')) {
    return artifactMatch(gitPath, 'spec-output-dir', 'spec output directory');
  }
  if (/(^|\/)issue-\d+-task-package\.md$/i.test(gitPath)) {
    return artifactMatch(gitPath, 'issue-task-package', 'generated issue task package');
  }
  if (/(^|\/)(?:task-package|spec-output|spec-evidence)(?:[.-][^/]*)?\.(?:md|json|txt)$/i.test(gitPath)) {
    return artifactMatch(gitPath, 'generated-spec-artifact', 'generated spec artifact');
  }
  if (/(^|\/)(?:routing|readback|closeout|merge-closeout|awp-routing|awp-readback|local-routing|local-readback)(?:[-_.][^/]*)?\.(?:json|md|txt)$/i.test(gitPath)) {
    return artifactMatch(gitPath, 'routing-readback-artifact', 'routing/readback evidence artifact');
  }
  if (/(^|\/)\.?private[-_](?:context|ledger)(?:\/|\.md$|\.json$|\.txt$)/i.test(gitPath)) {
    return artifactMatch(gitPath, 'private-context', 'private context or ledger artifact');
  }

  const configuredPrivatePrefix = configuredPrivateArtifactPrefixes(options.privateExcludes ?? [])
    .find((prefix) => gitPath === prefix || gitPath.startsWith(`${prefix}/`));
  if (configuredPrivatePrefix) {
    return artifactMatch(gitPath, 'configured-private-exclude', 'configured private exclude');
  }

  return null;
}

export function configuredPrivateArtifactPrefixes(excludes: string[]): string[] {
  return excludes
    .map(normalizeArtifactPath)
    .filter((entry) => /private|secret|credential|context/i.test(entry));
}

function artifactMatch(path: string, kind: SpecArtifactKind, reason: string): SpecArtifactMatch {
  return { path, kind, reason };
}
