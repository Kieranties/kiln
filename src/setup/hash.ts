import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * `sha256:<hex>` of the text, with CRLF read as LF so a file saved either way hashes the same.
 * Bytes are read as UTF-8 text (kiln's files are all text).
 */
export function hash(data: string | Uint8Array): string {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return `sha256:${createHash('sha256').update(text.replaceAll('\r\n', '\n'), 'utf8').digest('hex')}`;
}

/** Every file under `dir`, as `/` paths relative to it, sorted. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join('/'))
    .sort();
}

/** One hash for a whole blueprint folder: every file, by its `/` path, in order. */
export function blueprintHash(dir: string): string {
  const all = createHash('sha256');
  for (const name of filesUnder(dir)) all.update(`${name}\0${hash(readFileSync(join(dir, name), 'utf8'))}\n`);
  return `sha256:${all.digest('hex')}`;
}
