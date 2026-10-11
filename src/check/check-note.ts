import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import type { Definition } from '../blueprint/load.js';
import { sectionsOf, splitFrontmatter } from '../blueprint/markdown.js';
import { frontmatterLinkTarget, linkTargets, nearest } from './links.js';
import type { Vault } from './vault.js';

export type Level = 'error' | 'warn';
export type Finding = { level: Level; message: string };
export type NoteResult = { path: string; findings: Finding[]; skipped?: boolean };
/** Thrown by checkNote when the note's file can't be read. */
export class NoteReadError extends Error {}

export type CheckOptions = { isNew?: boolean; skipUntyped?: boolean };

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isEmpty = (value: unknown): boolean => value === null || value === undefined || value === '';
const isLink = (value: unknown): boolean => typeof value === 'string' && /^\[\[.+\]\]$/.test(value.trim());

function namingError(definition: Definition, name: string): string | undefined {
  const t = definition.name;
  switch (definition.naming) {
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(name) ? undefined : `${t} notes are named by date: YYYY-MM-DD`;
    case 'date-title':
      return /^\d{4}-\d{2}-\d{2} .+/.test(name) ? undefined : `${t} notes are named date first: YYYY-MM-DD title`;
    case 'title':
      return /^\d{4}-\d{2}-\d{2}( |$)/.test(name) ? `${t} notes are named by title, without a date first` : undefined;
    case 'source-title':
      return undefined;
  }
}

/** Checks one note against the vault's blueprint. `path` is vault-relative with `/`. Never writes. Throws NoteReadError when the file can't be read. */
export function checkNote(vault: Vault, path: string, options: CheckOptions = {}): NoteResult {
  let text: string;
  try {
    text = readFileSync(join(vault.root, path), 'utf8');
  } catch (e) {
    throw new NoteReadError(e instanceof Error ? e.message : String(e));
  }
  const result = (findings: Finding[]): NoteResult => ({ path, findings });
  const error = (message: string): Finding => ({ level: 'error', message });
  const { definitions, properties } = vault.blueprint;
  const typeNames = definitions.map((d) => d.name).sort();
  const isNew = options.isNew === true;

  const { frontmatter, body } = splitFrontmatter(text);
  let data: unknown;
  try {
    data = parse(frontmatter);
  } catch (e) {
    const reason = (e instanceof Error ? e.message : String(e)).split('\n')[0];
    return result([error(`frontmatter is not valid YAML: ${reason}`)]);
  }
  if (isEmpty(data)) data = {};
  if (!isMap(data)) return result([error('frontmatter is not a set of properties')]);

  const slash = path.indexOf('/');
  const folder = slash === -1 ? undefined : path.slice(0, slash);

  if (isEmpty(data.type)) {
    if (options.skipUntyped && !definitions.some((d) => d.folder === folder)) {
      return { path, findings: [], skipped: true };
    }
    return result([error(`no type; set type to one of: ${typeNames.join(', ')}`)]);
  }
  const t = String(data.type);
  const definition = definitions.find((d) => d.name === t);
  if (!definition) return result([error(`unknown type: ${t} (types are ${typeNames.join(', ')})`)]);

  const findings: Finding[] = [];
  const add = (message: string) => findings.push(error(message));

  if (folder !== definition.folder) {
    const where = folder === undefined ? 'the vault root' : `${folder}/`;
    add(`type is ${t} but the note is in ${where}; ${t} notes live in ${definition.folder}/`);
  }

  const kinds = Object.keys(definition.kinds);
  if (!isEmpty(data.kind)) {
    const kind = String(data.kind);
    if (kinds.length === 0) add(`${t} has no kinds; leave kind empty`);
    else if (!kinds.includes(kind)) add(`unknown kind: ${kind} (${t} kinds are ${kinds.join(', ')})`);
  }

  if (definition.statuses.length > 0) {
    const status = isEmpty(data.status) ? undefined : String(data.status);
    if (status === undefined || !definition.statuses.includes(status)) {
      add(`status is ${status ?? 'empty'}; ${t} statuses are ${definition.statuses.join(', ')}`);
    }
  } else if (!isEmpty(data.status)) {
    add(`${t} has no status; leave status empty`);
  }

  const name = basename(path).replace(/\.md$/, '');
  const naming = namingError(definition, name);
  if (naming) add(naming);

  const bad = [...new Set(name.match(/[#^[\]|:]/g) ?? [])];
  if (bad.length > 0) add(`file name contains ${bad.join(', ')}; replace # ^ [ ] | with a space and : with -`);

  if (isNew && body.trim() === '') {
    add('new note has properties and no body; create it from its template through QuickAdd');
  }

  const headings = [...sectionsOf(body).keys()];
  for (const section of definition.sections) {
    if (!headings.includes(section)) add(`missing section: ## ${section}`);
  }
  const lastHeading = body
    .split(/\r?\n/)
    .map((line) => /^## (.+)$/.exec(line)?.[1]?.trim())
    .filter((heading) => heading !== undefined)
    .at(-1);
  if (definition.last && headings.includes(definition.last) && lastHeading !== definition.last) {
    add(`## ${definition.last} must be the last section`);
  }

  const own = Object.keys(definition.properties);
  const allowed = new Set([...properties.shared, ...properties.optional, ...own]);
  for (const [key, value] of Object.entries(data)) {
    if (!allowed.has(key)) {
      const has =
        own.length > 0
          ? `${t} has ${own.join(', ')}, and the shared properties`
          : `${t} has only the shared properties`;
      add(`unknown property: ${key} (${has})`);
      continue;
    }
    if (isEmpty(value)) continue;
    const type = definition.properties[key];
    if (type === 'links' && !(Array.isArray(value) && value.every(isLink))) {
      add(`${key} must be a list of links, such as ${key}: ["[[Name]]"]`);
    } else if (type === 'list' && !Array.isArray(value)) {
      add(`${key} must be a list`);
    }
  }

  if (text.includes('<%')) {
    if (isNew) add('contains <%, which Templater would run; remove it');
    else {
      findings.push({
        level: 'warn',
        message: 'contains <%; Templater only runs it in a new note, so take it out before this text is reused',
      });
    }
  }

  const targets = new Set<string>();
  for (const [key, type] of Object.entries(definition.properties)) {
    const value = data[key];
    if (type !== 'links' || !Array.isArray(value)) continue;
    for (const item of value) {
      const target = typeof item === 'string' ? frontmatterLinkTarget(item) : undefined;
      if (target !== undefined) targets.add(target);
    }
  }
  for (const target of linkTargets(body)) targets.add(target);
  const candidates = [...new Set(vault.notes.map((note) => basename(note).replace(/\.md$/, '')))];
  for (const target of targets) {
    if (vault.names.has(target.toLowerCase())) continue;
    const near = nearest(target, candidates);
    const hint = near === undefined ? '' : `; did you mean [[${near}]]?`;
    findings.push({ level: 'warn', message: `[[${target}]] doesn't exist yet${hint}` });
  }

  const sameName = vault.notes.filter(
    (other) => other !== path && basename(other).replace(/\.md$/, '').toLowerCase() === name.toLowerCase(),
  );
  if (sameName.length > 0) findings.push({ level: 'warn', message: `file name also used by ${sameName.join(', ')}` });

  return result(findings.sort((a, b) => Number(b.level === 'error') - Number(a.level === 'error')));
}
