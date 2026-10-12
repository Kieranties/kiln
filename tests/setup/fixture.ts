import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = fileURLToPath(new URL('../../claude-plugin/', import.meta.url));

const made: string[] = [];

/**
 * A temporary copy of the plugin's blueprint at `<temp>/<name>/blueprint`, changed by `change`.
 * The last folder name is the plugin version setup records, so two copies may share a name.
 */
export function pluginCopy(name: string, change?: (blueprint: string) => void): string {
  const base = mkdtempSync(join(tmpdir(), 'kiln-plugin-'));
  made.push(base);
  const plugin = join(base, name);
  const blueprint = join(plugin, 'blueprint');
  cpSync(join(PLUGIN_ROOT, 'blueprint'), blueprint, { recursive: true });
  change?.(blueprint);
  return plugin;
}

export function cleanupAll(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}
