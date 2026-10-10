import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
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

/** On win32, an MSYS/Git Bash path `/x/...` as the drive path `X:/...`; any other path unchanged. */
export function fromMsys(p: string): string {
  if (!isWin) return p;
  const m = /^\/([a-zA-Z])(?=\/|$)/.exec(p);
  return m ? `${m[1]!.toUpperCase()}:${p.slice(2) || '/'}` : p;
}

/**
 * Absolute, forward-slash path, with an MSYS `/x/...` path read as `X:/...` on win32. Lowercased on win32 so comparisons
 * are case-insensitive.
 */
export function normalise(p: string): string {
  const s = resolve(fromMsys(p)).replaceAll('\\', '/');
  return isWin ? s.toLowerCase() : s;
}

/**
 * The real path of `p`: `realpathSync.native` of its nearest existing ancestor, with the rest of the path appended, so
 * junctions, symlinks, `subst` drives and 8.3 short names resolve to one spelling. Falls back to `p` when no ancestor
 * resolves.
 */
function realPath(p: string): string {
  let current = resolve(fromMsys(p));
  const rest: string[] = [];
  for (;;) {
    try {
      return join(realpathSync.native(current), ...rest);
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolve(fromMsys(p));
      rest.unshift(basename(current));
      current = parent;
    }
  }
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
    if (picomatch(normalise(rule.path), { nocase: isWin, dot: true })(cwd)) return findBase(cfg, rule.base);
  }
  if (cfg.default_base) return findBase(cfg, cfg.default_base);
  throw new KilnError('no_base', `No base matches "${opts.cwd}" and no default_base is configured`);
}

/**
 * The base whose directory contains `filePath` (the deepest one if bases nest), or null. Both sides are compared as
 * real paths (see `realPath`), so a junction or other alias of a base cannot get round the write guard.
 */
export function baseContaining(cfg: KilnConfig, filePath: string): Base | null {
  const file = normalise(realPath(filePath));
  let best: { base: Base; length: number } | null = null;
  for (const base of cfg.bases) {
    const root = normalise(realPath(base.path)).replace(/\/$/, '');
    if ((file === root || file.startsWith(`${root}/`)) && (!best || root.length > best.length)) {
      best = { base, length: root.length };
    }
  }
  return best?.base ?? null;
}
