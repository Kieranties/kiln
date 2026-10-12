import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isObsidianRunning, type Exec } from '../setup/checks.js';
import { runSetup } from '../setup/run.js';
import { envValue } from '../vault/paths.js';

// The bundle lives in <plugin>/scripts/, so the plugin root is one folder up.
const pluginRoot = fileURLToPath(new URL('..', import.meta.url));

const exec: Exec = (command, args) => spawnSync(command, args, { encoding: 'utf8', windowsHide: true });

/** KILN_OBSIDIAN_RUNNING=0|1 stands in for the process check. It is a test hook, not for owners. */
function obsidianRunning(): boolean | null {
  const override = envValue(process.env, 'KILN_OBSIDIAN_RUNNING');
  if (override === '0') return false;
  if (override === '1') return true;
  return isObsidianRunning(process.platform, exec);
}

const { output, exitCode } = await runSetup(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  home: homedir(),
  platform: process.platform,
  pluginRoot,
  obsidianRunning: obsidianRunning(),
  fetch: (url, init) => fetch(url, init),
  now: new Date(),
});
process.stdout.write(output + '\n');
process.exitCode = exitCode;
