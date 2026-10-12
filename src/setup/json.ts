import { readFileSync } from 'node:fs';

/** A JSON value: what `JSON.parse` gives, and what Obsidian and its plugins store. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export function isJson(v: unknown): v is Json {
  if (v === null || typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return true;
  if (Array.isArray(v)) return v.every(isJson);
  if (typeof v === 'object') return Object.values(v).every(isJson);
  return false;
}

/** A non-null, non-array object. */
export function isObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep equality: object key order is ignored, array order is kept. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
  }
  return a === b;
}

/** Reads a JSON file saved by any editor (byte-order mark, CRLF). `undefined` when it doesn't exist. */
export function readJson(file: string): Json | undefined {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
  if (text.startsWith('\uFEFF')) text = text.slice(1);
  try {
    const parsed: unknown = JSON.parse(text);
    if (isJson(parsed)) return parsed;
    throw new Error('not a JSON value');
  } catch (error) {
    throw new Error(`${file}: not valid JSON: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

/** JSON as Obsidian writes it: two spaces, LF, no final newline. */
export function obsidianJson(value: Json): string {
  return JSON.stringify(value, null, 2);
}
