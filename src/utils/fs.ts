import fs from 'fs';
import path from 'path';

export type SafeReadFileStatus = 'ok' | 'missing' | 'unreadable' | 'read-error';

export type SafeReadFileResult =
  | { status: 'ok'; content: string }
  | { status: Exclude<SafeReadFileStatus, 'ok'>; content: null; code?: string };

export async function safeReadFile(filePath: string): Promise<SafeReadFileResult> {
  try {
    return { status: 'ok', content: await fs.promises.readFile(filePath, 'utf8') };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { status: 'missing', content: null, code };
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return { status: 'unreadable', content: null, code };
    }
    return { status: 'read-error', content: null, code: code ?? 'UNKNOWN' };
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
