/** Splits a note into its frontmatter text and body. A leading byte-order mark is ignored. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const clean = text.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(clean);
  if (!match) return { frontmatter: '', body: clean };
  return { frontmatter: match[1] ?? '', body: match[2] ?? '' };
}

/** Splits a body into its `## ` sections, keyed by trimmed heading text. */
export function sectionsOf(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (current !== undefined) sections.set(current, lines.join('\n').trim());
  };
  for (const line of body.split(/\r?\n/)) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      flush();
      current = (heading[1] ?? '').trim();
      lines = [];
    } else lines.push(line);
  }
  flush();
  return sections;
}
