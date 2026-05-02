import fs from 'fs';
import path from 'path';

export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function ensureRepoPath(repoPath: string): void {
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repo path does not exist: ${repoPath}`);
  }

  const stat = fs.statSync(repoPath);
  if (!stat.isDirectory()) {
    throw new Error(`Repo path is not a directory: ${repoPath}`);
  }
}
