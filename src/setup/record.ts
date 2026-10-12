import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isObject, readJson, sameJson, type Json, type JsonObject } from './json.js';

/**
 * The version record: the plugin version (the last folder name of the plugin root), a hash of the whole
 * blueprint, a hash of each file setup installed, and the overrides the owner kept (decision 7).
 */
export type SetupRecord = {
  plugin: string;
  blueprint: string;
  files: Record<string, string>;
  kept: Record<string, Json>;
};

/** Where the record lives, relative to the vault. Obsidian doesn't index dot-folders. */
export const RECORD = '.kiln/blueprint.json';

function problem(text: string): Error {
  return new Error(`${RECORD}: ${text}`);
}

/** Reads the vault's record: `undefined` when there is none; a malformed one throws, naming the file. */
export function readRecord(vault: string): SetupRecord | undefined {
  const value = readJson(join(vault, RECORD));
  if (value === undefined) return undefined;
  if (!isObject(value)) throw problem('not an object');
  const { plugin, blueprint, files, kept } = value;
  if (typeof plugin !== 'string') throw problem('"plugin" is not text');
  if (typeof blueprint !== 'string') throw problem('"blueprint" is not text');
  if (!isObject(files)) throw problem('"files" is not an object');
  const hashes: Record<string, string> = {};
  for (const [path, hash] of Object.entries(files)) {
    if (typeof hash !== 'string') throw problem(`"files" has a value for ${path} that is not text`);
    hashes[path] = hash;
  }
  if (kept !== undefined && !isObject(kept)) throw problem('"kept" is not an object');
  return { plugin, blueprint, files: hashes, kept: kept ?? {} };
}

/**
 * Writes the record (two spaces, LF, a final newline; `files` sorted; `kept` only when it has entries),
 * creating `.kiln/`. Returns false, without writing, when the file already holds the same value.
 */
export function writeRecord(vault: string, record: SetupRecord): boolean {
  const value: JsonObject = {
    plugin: record.plugin,
    blueprint: record.blueprint,
    files: Object.fromEntries(Object.entries(record.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
  if (Object.keys(record.kept).length > 0) value.kept = record.kept;
  const file = join(vault, RECORD);
  if (sameJson(readJson(file), value)) return false;
  mkdirSync(join(vault, '.kiln'), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return true;
}
