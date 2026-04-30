import path from 'path';
import fs from 'fs';
import { ensureDir } from '../utils/fs.js';

export async function writePackage(
  content: string,
  outDir: string,
  issueNumber: number
): Promise<string> {
  ensureDir(outDir);

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const base = `${date}-${issueNumber}-task-package.md`;
  let filePath = path.join(outDir, base);

  // Collision-safe: append -v2, -v3, etc.
  let version = 2;
  while (fs.existsSync(filePath)) {
    filePath = path.join(outDir, `${date}-${issueNumber}-task-package-v${version}.md`);
    version++;
  }

  await fs.promises.writeFile(filePath, content, 'utf8');
  return filePath;
}
