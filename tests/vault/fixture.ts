import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Env, Where } from '../../src/vault/paths.js';

export type Sandbox = {
  root: string;
  home: string;
  appData: string;
  cwd: string;
  configFile: string;
  obsidianFile: string;
  env: Env;
  where(overrides?: Partial<Where>): Where;
  vault(name: string, kind?: 'kiln' | 'obsidian'): string;
  record(config: unknown): void;
  obsidian(paths: string[]): void;
  cleanup(): void;
};

/** A throwaway home folder, app-data folder and working folder. Nothing here touches the real ones. */
export function sandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'kiln-vault-'));
  const home = join(root, 'home');
  const appData = join(root, 'appdata');
  const cwd = join(root, 'elsewhere');
  mkdirSync(home, { recursive: true });
  mkdirSync(appData, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const configFile = join(home, '.kiln', 'config.json');
  const obsidianFile = join(appData, 'obsidian', 'obsidian.json');
  const env: Env = { APPDATA: appData };
  const write = (file: string, text: string) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  return {
    root,
    home,
    appData,
    cwd,
    configFile,
    obsidianFile,
    env,
    where: (overrides = {}) => ({ cwd, env, home, platform: 'win32', ...overrides }),
    vault(name, kind = 'kiln') {
      const path = join(home, 'vaults', name);
      mkdirSync(join(path, '.obsidian'), { recursive: true });
      mkdirSync(join(path, 'Work'), { recursive: true });
      if (kind === 'kiln') mkdirSync(join(path, '_kiln', 'types'), { recursive: true });
      return path;
    },
    record: (config) => write(configFile, JSON.stringify(config, null, 2) + '\n'),
    obsidian(paths) {
      const vaults = Object.fromEntries(
        paths.map((path, i) => [i.toString(16).padStart(16, '0'), { path, ts: 1760000000000 }]),
      );
      write(obsidianFile, JSON.stringify({ vaults }));
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}
