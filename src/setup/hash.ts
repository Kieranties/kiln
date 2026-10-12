import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** `sha256:<hex>`. A string is hashed as UTF-8. */
export function hash(data: string | Uint8Array): string {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

/** One hash for a whole blueprint folder: every file, by its `/` path, in order. */
export function blueprintHash(dir: string): string {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => {
      const path = join(e.parentPath, e.name);
      return { name: path.slice(dir.length).split(/[\\/]/).filter(Boolean).join('/'), path };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const all = createHash('sha256');
  for (const e of entries) all.update(`${e.name}\0${hash(readFileSync(e.path))}\n`);
  return `sha256:${all.digest('hex')}`;
}
