import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLUEPRINT } from './blueprint.js';

export const SAMPLE = fileURLToPath(new URL('../fixtures/sample/', import.meta.url));
export const BROKEN = fileURLToPath(new URL('../fixtures/check/', import.meta.url));

/** A new temporary vault: the sample with the blueprint in `_kiln/`, and with `broken` the broken notes laid over it. Callers remove it. */
export function makeVault(options: { broken?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'kiln-vault-'));
  cpSync(SAMPLE, root, { recursive: true });
  cpSync(join(BLUEPRINT, 'types'), join(root, '_kiln', 'types'), { recursive: true });
  cpSync(join(BLUEPRINT, 'properties.md'), join(root, '_kiln', 'properties.md'));
  if (options.broken) cpSync(BROKEN, root, { recursive: true });
  return root;
}
