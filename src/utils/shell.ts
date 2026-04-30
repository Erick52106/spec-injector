import { execSync } from 'child_process';

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function run(cmd: string, opts?: { cwd?: string }): ShellResult {
  try {
    const stdout = execSync(cmd, {
      cwd: opts?.cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}
