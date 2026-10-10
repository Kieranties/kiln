import type { Fields } from './types.js';

/** `[[target]]`, `[[target|alias]]`, `[[target#heading]]`, and embeds `![[target]]` (the `!` is not part of the match). */
const WIKILINK = /\[\[([^\[\]]+)\]\]/g;

function targetsIn(text: string, into: Map<string, string>): void {
  for (const m of text.matchAll(WIKILINK)) {
    // Drop the alias, then the heading; a backslash may escape the pipe inside Markdown tables.
    const target = m[1]!.split('|')[0]!.split('#')[0]!.replace(/\\$/, '').trim();
    if (target === '') continue;
    const key = target.toLowerCase();
    if (!into.has(key)) into.set(key, target);
  }
}

/**
 * The wikilink targets referenced by a note's frontmatter (string values and string arrays) and body,
 * de-duplicated case-insensitively, frontmatter first, in first-seen order and casing.
 */
export function extractLinks(fields: Fields, body: string): string[] {
  const found = new Map<string, string>();
  for (const value of Object.values(fields)) {
    if (typeof value === 'string') targetsIn(value, found);
    else if (Array.isArray(value)) for (const item of value) if (typeof item === 'string') targetsIn(item, found);
  }
  targetsIn(body, found);
  return [...found.values()];
}

/**
 * The link kiln writes to the note at base-relative `rel`: `[[<file stem>|<title>]]`, which Obsidian resolves by file
 * name, or plain `[[<title>]]` when the stem already is the title.
 */
export function linkTo(rel: string, title: string): string {
  const path = rel.replace(/\\/g, '/');
  const stem = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
  return stem === title ? `[[${title}]]` : `[[${stem}|${title}]]`;
}
