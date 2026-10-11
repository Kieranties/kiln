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

export type BaseView = { type: string; name: string; order?: string[]; groupBy?: { property: string } };
export type BaseFile = { filters?: { and?: unknown[] }; views: BaseView[] };

/** A Bases file, parsed. `path` is relative to kit/, e.g. 'views/inbox.base'. */
export function loadBase(path: string): BaseFile {
  return parse(readFileSync(join(KIT, path), 'utf8')) as BaseFile;
}

/** Every .base file in kit/views. */
export function viewFiles(): string[] {
  const dir = join(KIT, 'views');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.base')) : [];
}

export type Template = {
  frontmatterKeys: string[];
  frontmatterRaw: string;
  headings: string[];
  embeds: string[];
  /** Body content under each `## ` heading, trimmed. */
  sections: Map<string, string>;
  text: string;
};

/** The Base file a view heading embeds, e.g. viewFile('research', 'Work raised') === 'research-work-raised.base'. */
export function viewFile(type: string, heading: string): string {
  return `${type}-${heading.toLowerCase().replace(/ /g, '-')}.base`;
}

/** Splits a body into its `## ` sections. */
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
      current = heading[1] ?? '';
      lines = [];
    } else lines.push(line);
  }
  flush();
  return sections;
}

/**
 * Every template in kit/templates, keyed by file name. Templater tags are not valid YAML, so
 * frontmatter keys are read line by line, after any leading `<%* ... %>` script blocks.
 */
export function loadTemplates(): Map<string, Template> {
  const dir = join(KIT, 'templates');
  if (!existsSync(dir)) throw new Error(`kit/templates is missing (${dir})`);
  const templates = new Map<string, Template>();
  for (const f of readdirSync(dir).filter((name) => name.endsWith('.md'))) {
    const text = readFileSync(join(dir, f), 'utf8');
    const { frontmatter, body } = splitFrontmatter(text.replace(/^(<%\*[\s\S]*?%>\r?\n)+/, ''));
    templates.set(f, {
      frontmatterRaw: frontmatter,
      frontmatterKeys: frontmatter
        .split(/\r?\n/)
        .map((line) => /^([a-z_]+):/.exec(line)?.[1])
        .filter((key): key is string => key !== undefined),
      headings: [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? ''),
      embeds: [...body.matchAll(/^!\[\[(.+?)\]\]$/gm)].map((m) => m[1] ?? ''),
      sections: sectionsOf(body),
      text,
    });
  }
  return templates;
}
