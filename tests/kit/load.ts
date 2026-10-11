import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  readDefinitions,
  readPropertyCatalogue,
  type Definition,
  type PropertyEntry,
} from '../../src/blueprint/load.js';
import { sectionsOf, splitFrontmatter } from '../../src/blueprint/markdown.js';

export const BLUEPRINT = fileURLToPath(new URL('../../claude-plugin/blueprint/', import.meta.url));

export {
  PROP_TYPES,
  type Definition,
  type PropertyEntry,
  type PropType,
  type ViewDef,
} from '../../src/blueprint/load.js';
export { sectionsOf, splitFrontmatter } from '../../src/blueprint/markdown.js';

/** The properties every note carries, in template order (properties.md `shared`). */
export const SHARED_PROPERTIES: readonly string[] = readPropertyCatalogue(BLUEPRINT).shared;

/** The properties any note may carry (properties.md `optional`). */
export const OPTIONAL_PROPERTIES: readonly string[] = readPropertyCatalogue(BLUEPRINT).optional;

/** Every type definition in blueprint/types, parsed. */
export const loadDefinitions = (): Definition[] => readDefinitions(BLUEPRINT);

/** blueprint/properties.md: every property, with its icon or the type it links to. */
export const loadProperties = (): Record<string, PropertyEntry> => readPropertyCatalogue(BLUEPRINT).entries;

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
