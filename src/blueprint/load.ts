import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { splitFrontmatter } from './markdown.js';

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

/** A property's icon: its own, or (for a relationship) the type it links to. */
export type PropertyEntry = { icon?: string; color?: string; links?: string };

export type PropertyCatalogue = { entries: Record<string, PropertyEntry> };

/** Everything a blueprint folder defines. */
export type Blueprint = { definitions: Definition[]; properties: PropertyCatalogue };

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseYaml(text: string, where: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    throw new Error(
      `${where}: frontmatter is not valid YAML (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (data === null || data === undefined) return {};
  if (!isMap(data)) throw new Error(`${where}: frontmatter must be a map`);
  return data;
}

function text(data: Record<string, unknown>, field: string, where: string, required: boolean): string {
  const value = data[field];
  if (value === undefined || value === null) {
    if (required) throw new Error(`${where}: ${field} must be text`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${where}: ${field} must be text`);
  return value;
}

function textList(data: Record<string, unknown>, field: string, where: string): string[] {
  const value = data[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === 'string')) {
    throw new Error(`${where}: ${field} must be a list`);
  }
  return value;
}

function map(data: Record<string, unknown>, field: string, where: string): Record<string, unknown> {
  const value = data[field];
  if (value === undefined || value === null) return {};
  if (!isMap(value)) throw new Error(`${where}: ${field} must be a map`);
  return value;
}

function mapOf<T>(
  data: Record<string, unknown>,
  field: string,
  where: string,
  accept: (value: unknown) => value is T,
): Record<string, T> {
  const entries = map(data, field, where);
  for (const [key, value] of Object.entries(entries)) {
    if (!accept(value)) throw new Error(`${where}: ${field}.${key} is not valid`);
  }
  return entries as Record<string, T>;
}

const isPropType = (value: unknown): value is PropType => PROP_TYPES.some((t) => t === value);
const isOptionalText = (value: unknown): boolean => value === undefined || typeof value === 'string';
const isKind = (value: unknown): value is { icon?: string; color?: string } =>
  value === null || (isMap(value) && isOptionalText(value.icon) && isOptionalText(value.color));
const isView = (value: unknown): value is ViewDef =>
  isMap(value) && typeof value.type === 'string' && typeof value.via === 'string';
const isEntry = (value: unknown): value is PropertyEntry =>
  isMap(value) && isOptionalText(value.icon) && isOptionalText(value.color) && isOptionalText(value.links);

/** Every `dir/types/*.md`, parsed, sorted by file name. */
export function readDefinitions(dir: string): Definition[] {
  const typesDir = join(dir, 'types');
  if (!existsSync(typesDir)) throw new Error(`types/ is missing (${typesDir})`);
  return readdirSync(typesDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const where = `types/${f}`;
      const { frontmatter, body } = splitFrontmatter(readFileSync(join(typesDir, f), 'utf8'));
      const data = parseYaml(frontmatter, where);
      const kinds = mapOf(data, 'kinds', where, isKind);
      return {
        name: text(data, 'name', where, true),
        folder: text(data, 'folder', where, true),
        template: text(data, 'template', where, false),
        icon: text(data, 'icon', where, false),
        color: text(data, 'color', where, false),
        statuses: textList(data, 'statuses', where),
        properties: mapOf(data, 'properties', where, isPropType),
        kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v ?? {}])),
        sections: textList(data, 'sections', where),
        views: mapOf(data, 'views', where, isView),
        body: body.trim(),
      };
    });
}

/** `dir/properties.md`: every property, with its icon or the type it links to. */
export function readPropertyCatalogue(dir: string): PropertyCatalogue {
  const where = 'properties.md';
  const file = join(dir, where);
  if (!existsSync(file)) throw new Error(`${where} is missing (${file})`);
  const { frontmatter } = splitFrontmatter(readFileSync(file, 'utf8'));
  const data = parseYaml(frontmatter, where);
  return { entries: mapOf(data, 'properties', where, isEntry) };
}

/** A blueprint folder: `claude-plugin/blueprint/` in the repo, `<vault>/_kiln/` in a vault. */
export function readBlueprint(dir: string): Blueprint {
  return { definitions: readDefinitions(dir), properties: readPropertyCatalogue(dir) };
}
