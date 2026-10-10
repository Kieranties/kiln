import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Builds dist/ once before any test file runs, so the CLI and MCP integration tests spawn current, complete output. */
export default function setup(): void {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  // A shell is needed to run npm (npm.cmd) on Windows.
  execFileSync('npm run build', { cwd: repo, shell: true, stdio: 'inherit' });
  const cli = join(repo, 'dist', 'cli.js');
  if (!existsSync(cli)) throw new Error(`${cli} is missing after "npm run build"`);
}
