import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const BLUEPRINT = fileURLToPath(new URL('../../claude-plugin/blueprint/', import.meta.url));

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

/** Every type definition in blueprint/types, parsed. */
export function loadDefinitions(): Definition[] {
  const dir = join(BLUEPRINT, 'types');
  if (!existsSync(dir)) throw new Error(`blueprint/types is missing (${dir})`);
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

/** A property's icon: its own, or (for a relationship) the type it links to. */
export type PropertyEntry = { icon?: string; color?: string; links?: string };

/** blueprint/properties.md: every property, with its icon or the type it links to. */
export function loadProperties(): Record<string, PropertyEntry> {
  const { frontmatter } = splitFrontmatter(readFileSync(join(BLUEPRINT, 'properties.md'), 'utf8'));
  return ((parse(frontmatter) ?? {}) as { properties?: Record<string, PropertyEntry> }).properties ?? {};
}

/** A JSON file in the blueprint, parsed. `path` is relative to blueprint/, e.g. 'settings/app.json'. */
export function loadJson<T = Record<string, unknown>>(path: string): T {
  return JSON.parse(readFileSync(join(BLUEPRINT, path), 'utf8')) as T;
}

export type BaseView = {
  type: string;
  name: string;
  order?: string[];
  groupBy?: { property: string };
  groupOrder?: string[];
};
export type BaseFile = {
  filters?: { and?: unknown[] };
  properties?: Record<string, { displayName?: string }>;
  views: BaseView[];
};

/** Every Base in the blueprint, as paths relative to blueprint/. */
export function allBases(): string[] {
  return [...viewFiles().map((f) => `views/${f}`), 'root/Board.base'];
}

/** The header a view column shows: 'file.name' reads 'Name', 'summary' reads 'Summary'. */
export function columnLabel(property: string): string {
  const name = property === 'file.name' ? 'name' : property;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** A Bases file, parsed. `path` is relative to blueprint/, e.g. 'views/inbox.base'. */
export function loadBase(path: string): BaseFile {
  return parse(readFileSync(join(BLUEPRINT, path), 'utf8')) as BaseFile;
}

/** Every .base file in blueprint/views. */
export function viewFiles(): string[] {
  const dir = join(BLUEPRINT, 'views');
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
 * Every template in blueprint/templates, keyed by file name. Templater tags are not valid YAML, so
 * frontmatter keys are read line by line, after any leading `<%* ... %>` script blocks.
 */
export function loadTemplates(): Map<string, Template> {
  const dir = join(BLUEPRINT, 'templates');
  if (!existsSync(dir)) throw new Error(`blueprint/templates is missing (${dir})`);
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
