import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkVault } from './find.js';
import { envValue, expandHome, type Env } from './paths.js';

export type KilnConfig = { default?: string; vaults: Record<string, string>; [key: string]: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `~/.kiln/config.json`, or `config.json` in the folder `KILN_HOME` names. */
export function kilnConfigPath(where: { env: Env; home: string }): string {
  const kilnHome = envValue(where.env, 'KILN_HOME');
  return kilnHome === undefined
    ? join(where.home, '.kiln', 'config.json')
    : join(expandHome(kilnHome, where.home), 'config.json');
}

/** `undefined` when there is no file. Throws an `Error` that says what is wrong with a file that is there. */
export function readKilnConfig(file: string): KilnConfig | undefined {
  if (!existsSync(file)) return undefined;
  const source = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (error) {
    throw new Error(`not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  if (!isObject(data)) throw new Error('not a JSON object');
  const listed = data.vaults ?? {};
  if (!isObject(listed)) throw new Error('vaults must be a map of names to folders');
  const vaults: Record<string, string> = {};
  for (const [key, path] of Object.entries(listed)) {
    if (typeof path !== 'string') throw new Error('vaults must be a map of names to folders');
    vaults[key] = path;
  }
  if (data.default !== undefined && typeof data.default !== 'string') {
    throw new Error('default must be a vault name');
  }
  return { ...data, vaults };
}

/** Records `name` as the vault at `path` (its root) and returns what it wrote. The first vault becomes the default. */
export function recordVault(
  file: string,
  name: string,
  path: string,
  options: { makeDefault?: boolean; home?: string } = {},
): KilnConfig {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`vault names use letters, digits, ".", "-" and "_": "${name}"`);
  }
  const root = resolve(options.home === undefined ? path : expandHome(path, options.home));
  const check = checkVault(root, { walkUp: false });
  if (!check.ok) throw new Error(check.reason);

  let existing: KilnConfig | undefined;
  try {
    existing = readKilnConfig(file);
  } catch (error) {
    throw new Error(
      `${file} can't be read, so it was left as it is: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }

  const { default: currentDefault, vaults, ...rest } = existing ?? { vaults: {} };
  const config: KilnConfig = {
    default: options.makeDefault === true || currentDefault === undefined ? name : currentDefault,
    vaults: { ...vaults, [name]: check.root },
    ...rest,
  };
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n');
  renameSync(temporary, file);
  return config;
}
