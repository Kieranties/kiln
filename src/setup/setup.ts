import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { readDefinitions } from '../blueprint/load.js';
import { openVault } from '../check/vault.js';
import { readKilnConfig, recordVault, type KilnConfig } from '../vault/config.js';
import { expandHome, isFolder, pathKey } from '../vault/paths.js';
import { installedFiles, isLive, readRequires, SETTINGS } from './blueprint.js';
import { checkPlugins, type PluginCheck } from './checks.js';
import { sortFile, usersOf } from './files.js';
import { blueprintHash, filesUnder, hash } from './hash.js';
import { isObject, obsidianJson, readJson, sameJson, type Json } from './json.js';
import { Merger, mergeFragment } from './merge.js';
import { isChoice, kindChoices } from './quickadd.js';
import { readRecord, RECORD, writeRecord } from './record.js';
import { loadSample } from './sample.js';

export type FetchResponse = { ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> };
export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type SetupOptions = {
  /** The vault folder, absolute. */
  vault: string;
  /** The folder holding `blueprint/`. */
  pluginRoot: string;
  platform: NodeJS.Platform;
  /** Expands a recorded `~/…` path, as the resolver does. */
  home: string;
  obsidianRunning: boolean | null;
  confirmClosed?: boolean;
  cliPath: string | null;
  /** The kiln file to record the vault in. */
  kilnConfig: string;
  take?: readonly string[];
  sample?: boolean;
  name?: string;
  makeDefault?: boolean;
  /** Used only for the sample. */
  fetch: Fetch;
  /** Names the backup folder. */
  now: Date;
};

export type FileStep = {
  path: string;
  action: 'add' | 'update' | 'replace' | 'keep' | 'ask' | 'dropped' | 'wait';
  backup?: string;
  usedBy?: string[];
};
export type SettingStep = {
  file: string;
  key: string;
  action: 'set' | 'keep' | 'ask' | 'wait';
  from?: Json;
  to?: Json;
};
/** Something to ask the owner about. A file's `current` and `blueprint` are its two texts. */
export type Ask = { id: string; current: Json; blueprint: Json };
export type SetupReport = {
  vault: string;
  mode: 'setup' | 'reapply';
  plugin: string;
  blueprint: string;
  applied: boolean;
  stop: string[];
  warnings: string[];
  plugins: PluginCheck[];
  obsidian: { running: boolean | null; minimum: string };
  cli: string | null;
  folders: { path: string; action: 'add' | 'wait' }[];
  /** Every action but unchanged. */
  files: FileStep[];
  unchanged: number;
  settings: SettingStep[];
  asks: Ask[];
  vaultOnlyTypes: string[];
  sample: { source: string; files: string[]; skipped: string[] } | { notes: number } | null;
  kiln: { name: string; config: string; recorded: 'new' | 'already' | 'skipped'; default: string | null };
  permissions: { additionalDirectories: string[]; ask: string[] };
};

const SETUP_NEEDS_CLOSED =
  "Obsidian is running. Setup needs it closed, because QuickAdd and Homepage read their settings only when Obsidian starts. Quit Obsidian (with Run in Background installed, use the tray's Close Vault), then run setup again.";
const SETUP_UNSURE =
  "Couldn't tell whether Obsidian is running. Ask the owner, and pass --confirm-closed once it is closed.";
const NO_CLI =
  "The Obsidian CLI isn't on PATH. kiln's other skills need it: in Obsidian, turn on Settings → General → Command line interface, then restart the terminal and Claude.";
const OPEN =
  'Obsidian is running, so only _kiln/, Iconic and Templater are changed. The rest waits: close Obsidian and run setup again.';
const SAMPLE_NEEDS_CLOSED =
  'The sample is written as plain files, which needs Obsidian closed (Templater would run on new notes). Close Obsidian, then run setup again.';
const NO_WORKSPACE =
  ".obsidian/workspace.json doesn't exist yet, so File properties isn't opened in the right sidebar. Getting started, section 4, says how.";

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));
const fix = (error: unknown): string => `${message(error)}; fix or remove it, then run setup again`;
const byPath = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** A `/` vault path as a path on disk. */
const onDisk = (vault: string, path: string): string => join(vault, ...path.split('/'));

/** The file's text, or `undefined` when there is no file. */
function readText(file: string): string | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** The owner's notes: `.md` files outside dot-folders and `_kiln/`, other than `Home.md`. */
function ownNotes(vault: string): string[] {
  return filesUnder(vault).filter(
    (path) =>
      path.endsWith('.md') &&
      path !== 'Home.md' &&
      !path.startsWith('_kiln/') &&
      !path.split('/').some((segment) => segment.startsWith('.')),
  );
}

/** `from` and `to` for a step, only when both are scalars (as `Change` has them). */
function scalars(from: Json, to: Json): { from?: Json; to?: Json } {
  return (from === null || typeof from !== 'object') && (to === null || typeof to !== 'object') ? { from, to } : {};
}

/** The rules for the owner's Claude Code settings: the vault as a working folder, and edits to its setup asked first. */
export function permissionRules(vault: string, platform: NodeJS.Platform): SetupReport['permissions'] {
  let posix = vault.replaceAll('\\', '/');
  if (platform === 'win32') posix = posix.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`);
  posix = posix.replace(/\/+$/, '');
  return {
    additionalDirectories: [vault],
    ask: [`Edit(/${posix}/.obsidian/**)`, `Edit(/${posix}/_kiln/**)`],
  };
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Decision 12's name from the folder name: `Trial Vault` → `Trial-Vault`, `.notes` → `notes`, nothing left → `vault`. */
function folderName(vault: string): string {
  const name = basename(vault)
    .replaceAll(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/-+$/, '');
  return name === '' ? 'vault' : name;
}

/**
 * The vault's name in the kiln file: the name already recorded for this folder, else `wanted`, else one
 * made from the folder name that no other entry has. `recorded` says the folder already has the name.
 */
export function vaultName(
  vault: string,
  config: KilnConfig | undefined,
  where: { platform: NodeJS.Platform; home: string },
  wanted?: string,
): { name: string; recorded: boolean } | { error: string } {
  const vaults = config?.vaults ?? {};
  const key = pathKey(vault, where.platform);
  for (const [name, path] of Object.entries(vaults)) {
    const expanded = expandHome(path, where.home);
    // A path that isn't absolute matches nothing, as in the resolver.
    if (isAbsolute(expanded) && pathKey(expanded, where.platform) === key) return { name, recorded: true };
  }
  if (wanted !== undefined) {
    if (!NAME.test(wanted)) return { error: `vault names use letters, digits, ".", "-" and "_": "${wanted}"` };
    const other = vaults[wanted];
    if (other !== undefined) {
      return { error: `vault name "${wanted}" is already ${other} in the kiln file; choose another with --name` };
    }
    return { name: wanted, recorded: false };
  }
  const base = folderName(vault);
  let name = base;
  for (let n = 2; Object.hasOwn(vaults, name); n++) name = `${base}-${n}`;
  return { name, recorded: false };
}

/** The report, and the writes `applySetup` makes, in order. */
type Prepared = { report: SetupReport; writes: (() => void)[] };

function prepare(o: SetupOptions): Prepared {
  const vault = o.vault;
  const bp = join(o.pluginRoot, 'blueprint');
  const requires = readRequires(bp);
  const report: SetupReport = {
    vault,
    mode: 'setup',
    plugin: basename(resolve(o.pluginRoot)),
    blueprint: blueprintHash(bp),
    applied: false,
    stop: [],
    warnings: [],
    plugins: [],
    obsidian: { running: o.obsidianRunning, minimum: requires.obsidian },
    cli: o.cliPath,
    folders: [],
    files: [],
    unchanged: 0,
    settings: [],
    asks: [],
    vaultOnlyTypes: [],
    sample: null,
    kiln: { name: '', config: o.kilnConfig, recorded: 'skipped', default: null },
    permissions: permissionRules(vault, o.platform),
  };

  // The kiln file and the name, worked out first so even a report that stops early names the vault.
  let config: KilnConfig | undefined;
  let unreadable: string | undefined;
  try {
    config = readKilnConfig(o.kilnConfig);
  } catch (error) {
    unreadable = `can't record the vault: ${o.kilnConfig} ${message(error)}`;
  }
  const named = vaultName(vault, config, { platform: o.platform, home: o.home }, o.name);
  if (!('error' in named)) {
    if (unreadable === undefined) {
      const current = config?.default;
      const after = o.makeDefault === true || current === undefined ? named.name : current;
      const already = named.recorded && after === current;
      report.kiln = { name: named.name, config: o.kilnConfig, recorded: already ? 'already' : 'new', default: after };
    } else {
      report.kiln = { name: named.name, config: o.kilnConfig, recorded: 'skipped', default: null };
    }
  }

  const early = !existsSync(vault)
    ? `${vault} doesn't exist`
    : !isFolder(vault)
      ? `${vault} isn't a folder`
      : !isFolder(join(vault, '.obsidian'))
        ? `${vault} isn't an Obsidian vault yet: open it in Obsidian first (Getting started, section 2)`
        : undefined;
  if (early !== undefined) {
    report.stop.push(early);
    return { report, writes: [] };
  }

  const missing: string[] = [];
  const problems: string[] = [];
  const warnings = { old: [] as string[], other: [] as string[] };

  report.mode = existsSync(join(vault, RECORD)) || isFolder(join(vault, '_kiln', 'types')) ? 'reapply' : 'setup';
  report.plugins = checkPlugins(vault, requires);
  for (const p of report.plugins) {
    if (p.status === 'missing') {
      missing.push(
        `${p.id} isn't installed: .obsidian/plugins/${p.id}/ needs manifest.json and main.js. Install it and turn it on in Obsidian (Getting started, section 2)`,
      );
    } else if (p.status === 'old') {
      warnings.old.push(
        `${p.id} ${p.version ?? ''} is older than ${p.minimum}, the oldest the blueprint is written for. Update it in Obsidian.`,
      );
    }
  }

  let record: ReturnType<typeof readRecord>;
  try {
    record = readRecord(vault);
  } catch (error) {
    problems.push(fix(error));
  }
  const hasRecord = existsSync(join(vault, RECORD));
  const recorded = record?.files ?? {};
  const kept = record?.kept ?? {};
  const take = new Set(o.take ?? []);
  const matched = new Set<string>();

  // Obsidian: first setup stops while it is (or may be) running; re-apply changes only what reloads live.
  const unsure = o.obsidianRunning === null && o.confirmClosed !== true;
  let obsidianStop: string | undefined;
  if (report.mode === 'setup') {
    if (o.obsidianRunning === true) obsidianStop = SETUP_NEEDS_CLOSED;
    else if (unsure) obsidianStop = SETUP_UNSURE;
  }
  const open = report.mode === 'reapply' && (o.obsidianRunning === true || unsure);
  const sampleStop = o.sample === true && (o.obsidianRunning === true || unsure) ? SAMPLE_NEEDS_CLOSED : undefined;
  if (o.sample === true) report.sample = { notes: ownNotes(vault).length };
  const waits = (path: string): boolean => open && !isLive(path);

  const writes = { folders: [] as (() => void)[], backups: [] as (() => void)[], files: [] as (() => void)[] };
  const settingWrites: (() => void)[] = [];
  const nextKept: Record<string, Json> = {};
  const nextFiles: Record<string, string> = {};

  // Folders: each type's folder that isn't there yet.
  const definitions = readDefinitions(bp);
  for (const folder of new Set(definitions.map((d) => d.folder))) {
    if (isFolder(onDisk(vault, folder))) continue;
    const action = waits(folder) ? 'wait' : 'add';
    report.folders.push({ path: folder, action });
    if (action === 'add') writes.folders.push(() => mkdirSync(onDisk(vault, folder), { recursive: true }));
  }

  // Files: the three-way sort over everything the blueprint installs and everything the record names.
  const installed = installedFiles(bp);
  const stamp = o.now.toISOString().slice(0, 19).replaceAll(':', '-');
  let notes: { path: string; text: string }[] | null | undefined;
  const vaultNotes = () => {
    if (notes === undefined) {
      try {
        notes = openVault(vault).notes.map((path) => ({ path, text: readFileSync(onDisk(vault, path), 'utf8') }));
      } catch {
        notes = null; // the vault's _kiln/ isn't a readable blueprint: no users to report
      }
    }
    return notes;
  };
  const fileAsks: Ask[] = [];
  for (const path of [...new Set([...installed.keys(), ...Object.keys(recorded)])].sort(byPath)) {
    const text = installed.get(path);
    const blueprint = text === undefined ? undefined : hash(text);
    const current = readText(onDisk(vault, path));
    const was = recorded[path];
    const sorted = sortFile(path, was, current === undefined ? undefined : hash(current), blueprint, hasRecord);
    if (sorted === 'skip' || sorted === 'forget') continue; // `forget` leaves the record
    if (sorted === 'unchanged') {
      report.unchanged++;
      if (blueprint !== undefined) nextFiles[path] = blueprint;
      continue;
    }
    let action: FileStep['action'] = sorted;
    const taken = sorted === 'ask' && take.has(path);
    if (taken) {
      matched.add(path);
      action = 'replace';
    } else if (sorted === 'ask' && blueprint !== undefined && kept[path] === blueprint) {
      action = 'keep';
    }
    if (waits(path) && (action === 'add' || action === 'update' || action === 'replace' || action === 'ask')) {
      action = 'wait';
    }

    const step: FileStep = { path, action };
    if (action === 'add' || action === 'update' || action === 'replace') {
      if (blueprint !== undefined) nextFiles[path] = blueprint;
      const target = onDisk(vault, path);
      if (action === 'replace') {
        step.backup = `.kiln/backup/${stamp}/${path}`;
        const backup = onDisk(vault, step.backup);
        writes.backups.push(() => {
          mkdirSync(dirname(backup), { recursive: true });
          copyFileSync(target, backup);
        });
      }
      writes.files.push(() => {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text ?? '');
      });
    } else if (action !== 'dropped' && was !== undefined) {
      nextFiles[path] = was; // keep, wait and ask: what setup installed stays the base
    }
    if (sorted === 'ask' && !taken) {
      if (action === 'wait') {
        if (kept[path] !== undefined) nextKept[path] = kept[path];
      } else if (blueprint !== undefined) {
        nextKept[path] = blueprint;
      }
    }
    if (action === 'ask') fileAsks.push({ id: path, current: current ?? '', blueprint: text ?? '' });
    if (action === 'dropped') {
      const users = vaultNotes();
      if (users !== null) step.usedBy = usersOf(path, users);
    }
    report.files.push(step);
  }

  // Types defined only in the vault: listed, not set up.
  const types = join(vault, '_kiln', 'types');
  if (isFolder(types)) {
    report.vaultOnlyTypes = readdirSync(types)
      .filter((f) => f.endsWith('.md'))
      .filter((f) => !installed.has(`_kiln/types/${f}`) && !Object.hasOwn(recorded, `_kiln/types/${f}`))
      .map((f) => f.slice(0, -'.md'.length))
      .sort(byPath);
  }

  // Settings: each fragment merged over the vault's file.
  const settingAsks: Ask[] = [];
  for (const s of SETTINGS) {
    const fragment = readJson(join(bp, ...s.fragment.split('/')));
    if (fragment === undefined) throw new Error(`the blueprint has no ${s.fragment}`);
    const file = onDisk(vault, s.target);
    // Generated from the blueprint alone, so a problem here is the plugin's, and throws.
    const choices =
      s.fragment === 'settings/plugins/quickadd.json'
        ? kindChoices(
            definitions,
            isObject(fragment) && Array.isArray(fragment.choices) ? fragment.choices.filter(isChoice) : [],
          )
        : [];
    let current: Json | undefined;
    let next: Json | undefined;
    const m = new Merger(s.target, { take, kept });
    try {
      // The owner's file: unreadable JSON, or a shape the merge can't use, stops setup.
      current = readJson(file);
      next = mergeFragment(s.fragment, current, fragment, m, { choices });
    } catch (error) {
      problems.push(fix(error));
      continue;
    }
    if (next === undefined) continue;
    const wait = waits(s.target);
    for (const change of m.changes) report.settings.push({ ...change, action: wait ? 'wait' : 'set' });
    for (const override of m.overrides) {
      if (override.taken) {
        matched.add(override.id); // its change is a `set` step above
        continue;
      }
      const action = wait ? 'wait' : override.asked ? 'ask' : 'keep';
      report.settings.push({
        file: override.file,
        key: override.key,
        action,
        ...scalars(override.current, override.blueprint),
      });
      if (action === 'ask') {
        settingAsks.push({ id: override.id, current: override.current, blueprint: override.blueprint });
      }
      if (!wait) nextKept[override.id] = override.blueprint;
    }
    if (wait) {
      // Not looked at this time: what the owner kept here stays kept.
      for (const [id, value] of Object.entries(kept)) if (id.startsWith(`${s.target}#`)) nextKept[id] = value;
    } else if (!sameJson(next, current)) {
      const value = next;
      settingWrites.push(() => {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, obsidianJson(value));
      });
    }
  }
  report.asks = [...fileAsks, ...settingAsks];

  const recordWrite = () => {
    writeRecord(vault, { plugin: report.plugin, blueprint: report.blueprint, files: nextFiles, kept: nextKept });
  };

  if (o.cliPath === null) warnings.other.push(NO_CLI);
  if (open) warnings.other.push(OPEN);
  if (!existsSync(join(vault, '.obsidian', 'workspace.json'))) warnings.other.push(NO_WORKSPACE);
  for (const id of take) if (!matched.has(id)) warnings.other.push(`--take ${id} matched nothing`);
  if (unreadable !== undefined) warnings.other.push(unreadable);
  report.warnings = [...warnings.old, ...warnings.other];

  report.stop = [
    ...missing,
    ...problems,
    ...(obsidianStop === undefined ? [] : [obsidianStop]),
    ...(sampleStop === undefined ? [] : [sampleStop]),
    ...('error' in named ? [named.error] : []),
  ];
  return {
    report,
    writes: [...writes.folders, ...writes.backups, ...writes.files, ...settingWrites, recordWrite],
  };
}

/** What setup would do, writing nothing. */
export function planSetup(options: SetupOptions): SetupReport {
  return prepare(options).report;
}

/**
 * Plans again and, unless something stops it, writes: folders, backups, files, settings, the record, then
 * the sample when asked for, and then the vault in the kiln file. The sample is loaded before anything is
 * written, so a failed fetch writes nothing. Overrides nobody took are kept, so an `ask` is reported as `keep`.
 */
export async function applySetup(options: SetupOptions): Promise<SetupReport> {
  const { report, writes } = prepare(options);
  if (report.stop.length > 0) return report;
  let sample: Awaited<ReturnType<typeof loadSample>> | undefined;
  if (options.sample === true) {
    try {
      sample = await loadSample(options.pluginRoot, options.fetch);
    } catch (error) {
      report.stop.push(message(error));
      return report;
    }
  }
  for (const write of writes) write();
  if (sample !== undefined) {
    // The owner's notes from now on: never over an existing file, and not in the record.
    const written: string[] = [];
    const skipped: string[] = [];
    for (const file of sample.files) {
      const target = onDisk(options.vault, file.path);
      if (existsSync(target)) {
        skipped.push(file.path);
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.text, { flag: 'wx' });
      written.push(file.path);
    }
    report.sample = { source: sample.source, files: written, skipped };
  }
  if (report.kiln.recorded === 'new') {
    try {
      recordVault(options.kilnConfig, report.kiln.name, options.vault, { makeDefault: options.makeDefault === true });
    } catch (error) {
      report.kiln = { ...report.kiln, recorded: 'skipped', default: null };
      report.warnings.push(`can't record the vault: ${message(error)}`);
    }
  }
  report.applied = true;
  for (const step of report.files) if (step.action === 'ask') step.action = 'keep';
  for (const step of report.settings) if (step.action === 'ask') step.action = 'keep';
  return report;
}
