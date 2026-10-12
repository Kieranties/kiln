import { splitFrontmatter } from '../blueprint/markdown.js';

/**
 * What re-apply does with one file. `replace` means replace, backing up the vault's copy first;
 * `forget` drop it from the record; `skip` it isn't the blueprint's.
 */
export type FileAction = 'add' | 'update' | 'replace' | 'unchanged' | 'keep' | 'ask' | 'dropped' | 'forget' | 'skip';

/**
 * The three-way sort. `recorded` is what setup installed last time (from the record), `vault` what is
 * in the vault now, `blueprint` what the blueprint has now; each is a hash, or undefined when absent.
 * `hasRecord` is false for a vault set up by hand, which has no record at all.
 */
export function sortFile(
  path: string,
  recorded?: string,
  vault?: string,
  blueprint?: string,
  hasRecord = true,
): FileAction {
  if (blueprint === undefined) {
    if (recorded === undefined) return 'skip'; // never the blueprint's: the owner's own file
    return vault === undefined ? 'forget' : 'dropped';
  }
  if (vault === undefined) return 'add';
  if (vault === blueprint) return 'unchanged';
  if (recorded === undefined) {
    // No hash to compare with. A vault set up by hand (no record) only ever had the blueprint in _kiln/.
    return !hasRecord && path.startsWith('_kiln/') ? 'replace' : 'ask';
  }
  if (vault === recorded) return 'update';
  if (blueprint === recorded) return 'keep';
  return 'ask';
}

const escape = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The notes that still use a dropped file, in the order given: those whose text links to it
 * (`[[<name>`, case-insensitive), and for a type definition (`_kiln/types/<name>.md`) those of that type.
 * A link names a note without `.md`, and any other file with its extension.
 */
export function usersOf(path: string, notes: { path: string; text: string }[]): string[] {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const name = file.endsWith('.md') ? file.slice(0, -'.md'.length) : file;
  const link = new RegExp(`\\[\\[${escape(name)}`, 'i');
  const type = /^_kiln\/types\/[^/]+\.md$/.test(path) ? new RegExp(`^type:\\s*${escape(name)}\\s*$`, 'm') : undefined;
  return notes
    .filter((note) => link.test(note.text) || (type?.test(splitFrontmatter(note.text).frontmatter) ?? false))
    .map((note) => note.path);
}
