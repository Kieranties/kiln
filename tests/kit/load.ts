import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const KIT = fileURLToPath(new URL('../../kit/', import.meta.url));

export type PropType = 'text' | 'date' | 'datetime' | 'number' | 'links' | 'list';
export const PROP_TYPES: readonly PropType[] = ['text', 'date', 'datetime', 'number', 'links', 'list'];

/** `via` is a relationship property on `type`, or 'link' for file.hasLink(this.file). */
export type ViewDef = { type: string; via: string };

export type Definition = {
  name: string;
  folder: string;
  template: string;
  icon: string;
  color: string;
  statuses: string[];
  properties: Record<string, PropType>;
  kinds: Record<string, { icon?: string; color?: string }>;
  sections: string[];
  views: Record<string, ViewDef>;
  body: string;
};

/** The properties every note carries, in template order. */
export const SHARED_PROPERTIES = [
  'type',
  'kind',
  'status',
  'created',
  'summary',
  'aliases',
  'keywords',
  'tags',
  'review',
] as const;

/** Splits a note into its frontmatter text and body. */
export function splitFrontmatter(text: string): { frontmatter: string; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { frontmatter: '', body: text };
  return { frontmatter: match[1] ?? '', body: match[2] ?? '' };
}

/** Every type definition in kit/types, parsed. */
export function loadDefinitions(): Definition[] {
  const dir = join(KIT, 'types');
  if (!existsSync(dir)) throw new Error(`kit/types is missing (${dir})`);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { frontmatter, body } = splitFrontmatter(readFileSync(join(dir, f), 'utf8'));
      const data = (parse(frontmatter) ?? {}) as Record<string, unknown>;
      return {
        name: data.name,
        folder: data.folder,
        template: data.template,
        icon: data.icon,
        color: data.color,
        statuses: data.statuses ?? [],
        properties: data.properties ?? {},
        kinds: data.kinds ?? {},
        sections: data.sections ?? [],
        views: data.views ?? {},
        body: body.trim(),
      } as Definition;
    });
}
