import path from 'path';
import fs from 'fs';
import { ensureDir } from '../utils/fs.js';

export async function writePackage(
  content: string,
  outDir: string,
  issueNumber: number
): Promise<string> {
  ensureDir(outDir);

  const base = `issue-${issueNumber}-task-package.md`;
  const filePath = path.join(outDir, base);

  await fs.promises.writeFile(filePath, content, 'utf8');
  return filePath;
}
