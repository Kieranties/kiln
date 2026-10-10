import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import picomatch from 'picomatch';
import { parse, stringify } from 'yaml';
import { KilnError, type Base } from './types.js';

export type KilnConfig = {
  bases: Base[];
  rules: { path: string; base: string }[];
  default_base?: string;
};

const isWin = process.platform === 'win32';

export function configPath(): string {
  return process.env.KILN_CONFIG ?? join(homedir(), '.kiln', 'config.yaml');
}

export function loadConfig(path: string = configPath()): KilnConfig {
  if (!existsSync(path)) return { bases: [], rules: [] };
  const raw = (parse(readFileSync(path, 'utf8')) ?? {}) as Partial<KilnConfig>;
  const cfg: KilnConfig = { bases: raw.bases ?? [], rules: raw.rules ?? [] };
  if (raw.default_base) cfg.default_base = raw.default_base;
  return cfg;
}

export function saveConfig(cfg: KilnConfig, path: string = configPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(cfg), 'utf8');
}

/** Absolute, forward-slash path; lowercased on win32 so comparisons are case-insensitive. */
function normalise(p: string): string {
  const s = resolve(p).replaceAll('\\', '/');
  return isWin ? s.toLowerCase() : s;
}

function findBase(cfg: KilnConfig, name: string): Base {
  const base = cfg.bases.find((b) => b.name === name);
  if (!base) throw new KilnError('no_base', `Unknown base "${name}"`, { known: cfg.bases.map((b) => b.name) });
  return base;
}

export function resolveBase(cfg: KilnConfig, opts: { explicit?: string; cwd: string }): Base {
  if (opts.explicit) return findBase(cfg, opts.explicit);
  const cwd = normalise(opts.cwd);
  for (const rule of cfg.rules) {
    if (picomatch(normalise(rule.path), { nocase: isWin })(cwd)) return findBase(cfg, rule.base);
  }
  if (cfg.default_base) return findBase(cfg, cfg.default_base);
  throw new KilnError('no_base', `No base matches "${opts.cwd}" and no default_base is configured`);
}

/** The base whose directory contains `filePath` (the deepest one if bases nest), or null. */
export function baseContaining(cfg: KilnConfig, filePath: string): Base | null {
  const file = normalise(filePath);
  let best: { base: Base; length: number } | null = null;
  for (const base of cfg.bases) {
    const root = normalise(base.path).replace(/\/$/, '');
    if ((file === root || file.startsWith(`${root}/`)) && (!best || root.length > best.length)) {
      best = { base, length: root.length };
    }
  }
  return best?.base ?? null;
}
