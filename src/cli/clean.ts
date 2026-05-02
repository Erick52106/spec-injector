import path from 'path';
import fs from 'fs';

const TASK_PACKAGE_PATTERN = /^issue-\d+-task-package\.md$/;

export async function clean(opts: { repo?: string; issue?: string }): Promise<void> {
  const repoPath = path.resolve(opts.repo ?? process.cwd());
  const outDir = path.join(repoPath, '.spec-injector', 'out');

  if (opts.issue !== undefined) {
    await cleanIssue(outDir, opts.issue);
    return;
  }

  await cleanAll(outDir);
}

async function cleanIssue(outDir: string, issue: string): Promise<void> {
  if (!/^\d+$/.test(issue)) {
    throw new Error('--issue must be an issue number.');
  }

  const fileName = `issue-${issue}-task-package.md`;
  const filePath = path.join(outDir, fileName);

  if (!(await isRegularFile(filePath))) {
    console.log(`No generated task package found for issue ${issue}.`);
    return;
  }

  await fs.promises.unlink(filePath);
  console.log(`Removed generated task package: ${displayPath(fileName)}`);
}

async function cleanAll(outDir: string): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(outDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No generated task packages found.');
      return;
    }
    throw err;
  }

  const packageFiles = entries
    .filter((entry) => entry.isFile() && TASK_PACKAGE_PATTERN.test(entry.name))
    .map((entry) => path.join(outDir, entry.name));

  if (packageFiles.length === 0) {
    console.log('No generated task packages found.');
    return;
  }

  for (const filePath of packageFiles) {
    await fs.promises.unlink(filePath);
  }

  console.log(`Removed ${packageFiles.length} generated task package(s):`);
  for (const filePath of packageFiles) {
    console.log(`  ${displayPath(path.basename(filePath))}`);
  }
}

function displayPath(fileName: string): string {
  return path.join('.spec-injector', 'out', fileName);
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.lstat(filePath);
    return stat.isFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}
