import path from 'path';
import { safeReadFile } from '../utils/fs.js';
import type { DocSection } from './types.js';

export async function findDocSections(
  docPaths: string[],
  repoPath: string
): Promise<DocSection[]> {
  // Deduplicate paths
  const unique = [...new Set(docPaths)];

  const sections = await Promise.all(
    unique.map(async (docPath): Promise<DocSection> => {
      // Path validation
      if (path.isAbsolute(docPath)) {
        throw new Error(`Doc path is outside target repo: ${docPath}`);
      }
      const absolute = path.resolve(repoPath, docPath);
      if (!absolute.startsWith(path.resolve(repoPath) + path.sep)) {
        throw new Error(`Doc path is outside target repo: ${docPath}`);
      }

      const content = await safeReadFile(absolute);
      if (content === null) {
        console.warn(`⚠  Doc not found: ${docPath}`);
        return { filePath: docPath, content: '', found: false };
      }
      return { filePath: docPath, content, found: true };
    })
  );

  return sections;
}
