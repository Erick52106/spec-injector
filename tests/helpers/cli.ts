import { spawn, execFile } from 'node:child_process';
import path from 'node:path';

export const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, 'bin', 'spec.js');

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type SpecRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

type RunSpecOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} ${args.join(' ')} failed\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export function runSpec(args: string[], options: RunSpecOptions = {}): Promise<SpecRunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) {
        reject(new Error(`spec exited via signal ${signal}`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}
