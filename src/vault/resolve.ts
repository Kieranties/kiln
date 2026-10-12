import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { checkVault, findVault } from './find.js';
import { kilnConfigPath, readKilnConfig, type KilnConfig } from './config.js';
import { obsidianListPath, readObsidianVaults } from './obsidian.js';
import { envValue, expandHome, pathKey, type Where } from './paths.js';

export type Source = 'explicit' | 'current-folder' | 'KILN_VAULT' | 'default' | 'obsidian';
export type Candidate = { path: string; name?: string; from: 'kiln' | 'obsidian' };
export type Found = { vault: string; source: Source; name?: string };
export type NotFound = { vault: null; candidates: Candidate[]; reasons: string[] };
export type Resolution = Found | NotFound;

/** What reading the kiln file gave: nothing there, a reason it can't be read, or its contents. */
type Kiln = { kind: 'missing' } | { kind: 'unreadable'; message: string } | { kind: 'ok'; config: KilnConfig };

/** A step either ends resolution (found, or stop with a reason) or goes on, perhaps with a reason. */
type Outcome = { found: Found } | { stop: string; named?: string } | { reasons: string[] };

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Reads files only; never writes and only uses what `where` gives it. */
export function resolveVault(where: Where, explicit?: string): Resolution {
  const { cwd, home, platform } = where;
  const kilnFile = kilnConfigPath(where);
  const obsidianFile = obsidianListPath(where);
  const absolute = (path: string): string => resolve(cwd, expandHome(path, home));
  const key = (path: string): string => pathKey(path, platform);

  let kilnRead: Kiln | undefined;
  const kiln = (): Kiln => {
    if (kilnRead !== undefined) return kilnRead;
    try {
      const config = readKilnConfig(kilnFile);
      kilnRead = config === undefined ? { kind: 'missing' } : { kind: 'ok', config };
    } catch (error) {
      kilnRead = { kind: 'unreadable', message: message(error) };
    }
    return kilnRead;
  };
  const recorded = (): [string, string][] => {
    const k = kiln();
    return k.kind === 'ok' ? Object.entries(k.config.vaults) : [];
  };
  /** A recorded path is used only when it is absolute, since a session's folder says nothing about it. */
  const recordedAbsolute = (path: string): string | undefined => {
    const expanded = expandHome(path, home);
    return isAbsolute(expanded) ? resolve(expanded) : undefined;
  };
  const notAbsolute = (name: string, path: string): string => `vault "${name}": ${path} isn't an absolute path`;
  /** The folder the kiln file records for `name` (or why it can't be used), if it records one. */
  const recordedPath = (name: string): { path: string } | { bad: string } | undefined => {
    const path = recorded().find(([n]) => n === name)?.[1];
    if (path === undefined) return undefined;
    const abs = recordedAbsolute(path);
    return abs === undefined ? { bad: notAbsolute(name, path) } : { path: abs };
  };
  const unreadable = (): string | undefined => {
    const k = kiln();
    return k.kind === 'unreadable' ? `${kilnFile} can't be read: ${k.message}` : undefined;
  };

  const found = (vault: string, source: Source, name?: string): Outcome => {
    const named = name ?? recorded().find(([, path]) => key(recordedAbsolute(path) ?? '') === key(vault))?.[0];
    return { found: { vault, source, ...(named === undefined ? {} : { name: named }) } };
  };

  let obsidianRead: { paths: string[] } | { problem: string } | undefined;
  const obsidian = (): { paths: string[] } | { problem: string } => {
    if (obsidianRead !== undefined) return obsidianRead;
    try {
      const paths = readObsidianVaults(obsidianFile);
      obsidianRead = paths === undefined ? { problem: `no Obsidian vault list at ${obsidianFile}` } : { paths };
    } catch (error) {
      obsidianRead = { problem: `Obsidian's vault list can't be read: ${message(error)}` };
    }
    return obsidianRead;
  };
  /** Obsidian's kiln vaults (roots), merged by folder. */
  let obsidianRoots: string[] | undefined;
  const obsidianKilnVaults = (): string[] => {
    if (obsidianRoots !== undefined) return obsidianRoots;
    const read = obsidian();
    const roots = new Map<string, string>();
    if ('paths' in read) {
      for (const path of read.paths) {
        const check = checkVault(absolute(path), { walkUp: false });
        if (check.ok && !roots.has(key(check.root))) roots.set(key(check.root), check.root);
      }
    }
    obsidianRoots = [...roots.values()];
    return obsidianRoots;
  };

  const explicitStep = (path: string): Outcome => {
    const check = checkVault(absolute(path), { walkUp: true });
    return check.ok ? found(check.root, 'explicit') : { stop: check.reason };
  };

  const currentFolderStep = (): Outcome => {
    const vault = findVault(cwd);
    if (vault !== undefined) return found(vault, 'current-folder');
    // A plain Obsidian vault is the owner's vault, just not set up: stop, don't pick another.
    const check = checkVault(cwd, { walkUp: true });
    if (!check.ok && check.plain) return { stop: check.reason };
    return { reasons: [`the current folder (${cwd}) isn't in a kiln vault`] };
  };

  const envStep = (): Outcome => {
    const v = envValue(where.env, 'KILN_VAULT');
    if (v === undefined) return { reasons: ["KILN_VAULT isn't set"] };
    const recordedAt = recordedPath(v);
    if (recordedAt !== undefined && 'bad' in recordedAt)
      return { stop: `KILN_VAULT is "${v}": ${recordedAt.bad}`, named: v };
    const byName = recordedAt !== undefined;
    const path = recordedAt?.path ?? absolute(v);
    const check = checkVault(path, { walkUp: !byName });
    if (check.ok) return found(check.root, 'KILN_VAULT', byName ? v : undefined);
    let reason = check.reason;
    if (!byName && !existsSync(path) && !/[\\/]/.test(v)) {
      reason = unreadable() ?? `no vault of that name in ${kilnFile}, and no folder of that name`;
    }
    return { stop: `KILN_VAULT is "${v}": ${reason}`, named: byName ? v : undefined };
  };

  const defaultStep = (): Outcome => {
    const k = kiln();
    if (k.kind === 'unreadable') return { stop: `${kilnFile} can't be read: ${k.message}` };
    if (k.kind === 'missing') return { reasons: [`no kiln file at ${kilnFile}`] };
    const d = k.config.default;
    if (d === undefined) return { reasons: [`${kilnFile} has no default`] };
    const recordedAt = recordedPath(d);
    if (recordedAt === undefined) return { stop: `${kilnFile}'s default is "${d}", which isn't one of its vaults` };
    if ('bad' in recordedAt) return { stop: `${kilnFile}'s default "${d}": ${recordedAt.bad}`, named: d };
    const check = checkVault(recordedAt.path, { walkUp: false });
    return check.ok
      ? found(check.root, 'default', d)
      : { stop: `${kilnFile}'s default "${d}": ${check.reason}`, named: d };
  };

  const obsidianStep = (): Outcome => {
    const read = obsidian();
    if (!('paths' in read)) return { reasons: [read.problem] };
    const roots = obsidianKilnVaults();
    if (roots.length === 1 && roots[0] !== undefined) return found(roots[0], 'obsidian');
    return {
      reasons: [
        roots.length === 0
          ? 'Obsidian lists no kiln vault'
          : `Obsidian lists ${roots.length} kiln vaults, so it can't choose`,
      ],
    };
  };

  const reasons: string[] = [];
  let named: string | undefined;
  const steps: (() => Outcome)[] = [
    ...(explicit === undefined ? [] : [() => explicitStep(explicit)]),
    currentFolderStep,
    envStep,
    defaultStep,
    obsidianStep,
  ];
  for (const step of steps) {
    const outcome = step();
    if ('found' in outcome) return outcome.found;
    if ('stop' in outcome) {
      reasons.push(outcome.stop);
      named = outcome.named;
      break;
    }
    reasons.push(...outcome.reasons);
  }

  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const [name, path] of recorded()) {
    const abs = recordedAbsolute(path);
    if (abs === undefined) {
      if (name !== named) reasons.push(`${kilnFile}'s ${notAbsolute(name, path)}`);
      continue;
    }
    const check = checkVault(abs, { walkUp: false });
    if (check.ok) {
      candidates.push({ path: check.root, name, from: 'kiln' });
      seen.add(key(check.root));
    } else if (name !== named) {
      reasons.push(`${kilnFile}'s vault "${name}": ${check.reason}`);
    }
  }
  for (const root of obsidianKilnVaults()) {
    if (!seen.has(key(root))) candidates.push({ path: root, from: 'obsidian' });
  }
  return { vault: null, candidates, reasons };
}
