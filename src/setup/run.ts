import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { kilnConfigPath } from '../vault/config.js';
import { expandHome, type Where } from '../vault/paths.js';
import { findObsidianCli } from './checks.js';
import { applySetup, planSetup, type Fetch, type SetupOptions } from './setup.js';

export const USAGE = `Usage: node kiln-setup.mjs plan|apply --vault <folder> [options]
  plan                 show what setup would change, and what it would ask
  apply                make the changes
  --vault <folder>     the vault folder
  --take <id>          replace the owner's setting or file <id> with the blueprint's (repeatable)
  --sample             also load the Northwind Arena sample (a trial vault only)
  --name <name>        the vault's name in ~/.kiln/config.json
  --default            make it the default vault in ~/.kiln/config.json
  --confirm-closed     the owner says Obsidian is closed (when the check can't tell)
Prints JSON. Exit code: 0 done, 1 stopped (see "stop"), 2 bad arguments.`;

/** Everything setup would otherwise read from the running program. */
export type RunContext = Where & { pluginRoot: string; obsidianRunning: boolean | null; fetch: Fetch; now: Date };

/** Plans or applies setup and prints the report as JSON. `context` carries the environment. */
export async function runSetup(argv: string[], context: RunContext): Promise<{ output: string; exitCode: 0 | 1 | 2 }> {
  const usage = { output: USAGE, exitCode: 2 as const };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        vault: { type: 'string' },
        take: { type: 'string', multiple: true },
        name: { type: 'string' },
        sample: { type: 'boolean' },
        default: { type: 'boolean' },
        'confirm-closed': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch {
    return usage;
  }
  const { values, positionals } = parsed;
  const command = positionals[0];
  if (values.help || positionals.length !== 1 || (command !== 'plan' && command !== 'apply')) return usage;
  if (values.vault === undefined || values.vault.trim() === '') return usage;

  const options: SetupOptions = {
    vault: resolve(context.cwd, expandHome(values.vault, context.home)),
    pluginRoot: context.pluginRoot,
    platform: context.platform,
    home: context.home,
    obsidianRunning: context.obsidianRunning,
    confirmClosed: values['confirm-closed'],
    cliPath: findObsidianCli(context.env, context.platform),
    kilnConfig: kilnConfigPath(context),
    take: values.take ?? [],
    sample: values.sample,
    name: values.name,
    makeDefault: values.default,
    fetch: context.fetch,
    now: context.now,
  };
  try {
    const report = command === 'plan' ? planSetup(options) : await applySetup(options);
    return { output: JSON.stringify(report, null, 2), exitCode: report.stop.length > 0 ? 1 : 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { output: JSON.stringify({ error: message }, null, 2), exitCode: 1 };
  }
}
