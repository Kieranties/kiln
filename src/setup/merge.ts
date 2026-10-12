import { isObject, sameJson } from './json.js';
import type { Json, JsonObject } from './json.js';

/** What the owner has answered: ids to take the blueprint's value for, and ids already kept (with the blueprint value then). */
export type Answers = { take: ReadonlySet<string>; kept: Readonly<Record<string, Json>> };
/** `from` and `to` only when both are scalars. */
export type Change = { file: string; key: string; from?: Json; to?: Json };
export type Override = {
  id: string;
  file: string;
  key: string;
  current: Json;
  blueprint: Json;
  asked: boolean;
  taken: boolean;
};
export type MergeExtra = { choices: Json[] };

const scalar = (v: Json | undefined) => v === undefined || v === null || typeof v !== 'object';
const blank = (v: Json | undefined) => v === undefined || v === null || v === '';

export class Merger {
  readonly changes: Change[] = [];
  readonly overrides: Override[] = [];
  constructor(
    readonly file: string,
    private readonly answers: Answers,
  ) {}

  /** Sets obj[key] = to, recording a change when the value differs. */
  set(obj: JsonObject, key: string, to: Json, path: string = key): void {
    const from = obj[key];
    if (sameJson(from, to)) return;
    obj[key] = to;
    this.changes.push(
      scalar(from) && scalar(to)
        ? { file: this.file, key: path, ...(from === undefined ? {} : { from }), to }
        : { file: this.file, key: path },
    );
  }

  /** Records a change to a value replaced wholesale (core-plugins.json as a list). */
  changed(path: string): void {
    this.changes.push({ file: this.file, key: path });
  }

  /**
   * Whether the blueprint's value goes in over the owner's. A set value that differs is an override:
   * recorded, and replaced only when the owner took the blueprint's value.
   */
  decide(path: string, current: Json | undefined, to: Json, same: (a: Json, b: Json) => boolean = sameJson): boolean {
    if (blank(current) || current === undefined || same(current, to)) return true;
    const id = `${this.file}#${path}`;
    const taken = this.answers.take.has(id);
    const before = this.answers.kept[id];
    const asked = before === undefined || !sameJson(before, to);
    this.overrides.push({ id, file: this.file, key: path, current, blueprint: to, asked, taken });
    return taken;
  }

  setOwned(obj: JsonObject, key: string, to: Json, path: string = key, same?: (a: Json, b: Json) => boolean): void {
    if (this.decide(path, obj[key], to, same)) this.set(obj, key, to, path);
  }

  /** obj[key] as an object, made when it is missing or isn't one. */
  object(obj: JsonObject, key: string): JsonObject {
    const value = obj[key];
    if (isObject(value)) return value;
    const made: JsonObject = {};
    obj[key] = made;
    return made;
  }
}

type Rule = (current: Json, blueprint: Json, m: Merger, extra: MergeExtra) => Json;

function asObject(v: Json, m: Merger): JsonObject {
  if (!isObject(v)) throw new Error(`${m.file}: expected a JSON object`);
  return v;
}

function asArray(v: Json, m: Merger): Json[] {
  if (!Array.isArray(v)) throw new Error(`${m.file}: expected a JSON list`);
  return v;
}

/** The current list, then each added entry it lacks; a non-list counts as empty. */
function union(current: Json | undefined, add: Json | undefined): Json[] {
  const out = Array.isArray(current) ? [...current] : [];
  for (const entry of Array.isArray(add) ? add : []) if (!out.some((v) => sameJson(v, entry))) out.push(entry);
  return out;
}

const OWNED: Record<string, readonly string[]> = {
  'settings/app.json': ['newFileLocation', 'newFileFolderPath'],
  'settings/daily-notes.json': ['folder', 'format', 'template'],
};

function setKeys(fragment: string): Rule {
  return (current, blueprint, m) => {
    const o = asObject(current, m);
    for (const [key, value] of Object.entries(asObject(blueprint, m))) {
      if (key === 'userIgnoreFilters') m.set(o, key, union(o[key], value));
      else if (OWNED[fragment]?.includes(key)) m.setOwned(o, key, value);
      else m.set(o, key, value);
    }
    return o;
  };
}

const types: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const t = m.object(o, 'types');
  for (const [prop, value] of Object.entries(asObject(asObject(blueprint, m)['types'] ?? {}, m))) {
    m.setOwned(t, prop, value, `types/${prop}`);
  }
  return o;
};

const corePlugins: Rule = (current, blueprint, m) => {
  const b = asObject(blueprint, m);
  if (Array.isArray(current)) {
    const on = current.filter((id) => typeof id !== 'string' || b[id] !== false);
    for (const [id, enabled] of Object.entries(b)) if (enabled === true && !on.includes(id)) on.push(id);
    if (!sameJson(on, current)) m.changed('(enabled plugins)');
    return on;
  }
  const o = asObject(current, m);
  for (const [id, enabled] of Object.entries(b)) m.set(o, id, enabled);
  return o;
};

const communityPlugins: Rule = (current, blueprint, m) => {
  const list = asArray(current, m);
  const out = union(list, asArray(blueprint, m));
  if (!sameJson(out, list)) m.changed('(enabled plugins)');
  return out;
};

const appearance: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  m.set(o, 'enabledCssSnippets', union(o['enabledCssSnippets'], asObject(blueprint, m)['enabledCssSnippets']));
  return o;
};

/** The same homepage: the same note (`value`) of the same `kind`. */
const sameHomepage = (a: Json, b: Json): boolean =>
  isObject(a) && isObject(b) && a['value'] === b['value'] && a['kind'] === b['kind'];

const homepage: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const b = asObject(blueprint, m);
  // Homepage migrates its settings by `version`: set it only when it is missing or lower, never lower it.
  const version = b['version'];
  const own = o['version'];
  if (
    typeof version === 'number' &&
    (own === undefined || own === null || (typeof own === 'number' && own < version))
  ) {
    m.set(o, 'version', version);
  }
  const main = asObject(b['homepages'] ?? {}, m)['Main Homepage'];
  if (main !== undefined) {
    const homepages = m.object(o, 'homepages');
    const mine = homepages['Main Homepage'];
    if (isObject(mine) && isObject(main) && sameHomepage(mine, main)) {
      // kiln's homepage already: add kiln's keys the owner lacks, and keep theirs (commands, view, openOnStartup…).
      for (const [key, value] of Object.entries(main)) {
        if (!Object.hasOwn(mine, key)) m.set(mine, key, value, `homepages/Main Homepage/${key}`);
      }
    } else {
      m.setOwned(homepages, 'Main Homepage', main, 'homepages/Main Homepage', sameHomepage);
    }
  }
  return o;
};

export const isKiln = (v: Json): boolean => isObject(v) && typeof v.id === 'string' && v.id.startsWith('kiln-');

/** The choices without any kiln one, at any depth (a kiln choice inside a Multi goes too). */
function withoutKiln(choices: Json[]): Json[] {
  return choices
    .filter((c) => !isKiln(c))
    .map((c) => (isObject(c) && Array.isArray(c.choices) ? { ...c, choices: withoutKiln(c.choices) } : c));
}

const iconic: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const b = asObject(blueprint, m);
  for (const key of ['showAllFileIcons', 'showAllFolderIcons', 'minimalFolderIcons']) m.set(o, key, b[key] ?? null);
  for (const group of ['fileIcons', 'propertyIcons']) {
    const icons = m.object(o, group);
    for (const [name, value] of Object.entries(asObject(b[group] ?? {}, m)))
      m.set(icons, name, value, `${group}/${name}`);
  }
  m.set(o, 'fileRules', [
    ...asArray(b['fileRules'] ?? [], m),
    ...asArray(o['fileRules'] ?? [], m).filter((r) => !isKiln(r)),
  ]);
  return o;
};

const templater: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const b = asObject(blueprint, m);
  m.setOwned(o, 'templates_folder', b['templates_folder'] ?? null);
  m.set(o, 'trigger_on_file_creation_mode', b['trigger_on_file_creation_mode'] ?? null);
  const ours = asArray(b['folder_templates'] ?? [], m).filter(isObject);
  const folders = new Set(ours.map((e) => e['folder']));
  const theirs = asArray(o['folder_templates'] ?? [], m);
  const next = theirs.filter((e) => !(isObject(e) && folders.has(e['folder'] ?? null)));
  for (const entry of ours) {
    const own = theirs.find((e): e is JsonObject => isObject(e) && e['folder'] === entry['folder']);
    // Not String(entry.folder): typescript/no-base-to-string rejects it for a Json value.
    const folder = typeof entry['folder'] === 'string' ? entry['folder'] : '';
    const useOurs = !own || m.decide(`folder_templates/${folder}`, own['template'], entry['template'] ?? null);
    next.push(useOurs ? entry : own);
  }
  m.set(o, 'folder_templates', next);
  return o;
};

const quickadd: Rule = (current, blueprint, m, extra) => {
  const o = asObject(current, m);
  const b = asObject(blueprint, m);
  m.set(o, 'choices', [
    ...withoutKiln(asArray(o['choices'] ?? [], m)),
    ...asArray(b['choices'] ?? [], m),
    ...extra.choices,
  ]);
  return o;
};

/** Every `tabs` group under `node`, depth first. */
function tabGroups(node: Json, out: JsonObject[] = []): JsonObject[] {
  if (!isObject(node)) return out;
  if (node['type'] === 'tabs') out.push(node);
  if (Array.isArray(node['children'])) for (const child of node['children']) tabGroups(child, out);
  return out;
}

const isFileProperties = (v: Json): boolean =>
  isObject(v) && isObject(v['state']) && v['state']['type'] === 'file-properties';

const workspace: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const right = o['right'];
  if (!isObject(right)) return o;
  const groups = tabGroups(right);
  const holder = groups.find((g) => Array.isArray(g['children']) && g['children'].some(isFileProperties));
  if (holder !== undefined && Array.isArray(holder['children'])) {
    m.set(holder, 'currentTab', holder['children'].findIndex(isFileProperties), 'right/currentTab');
  } else {
    const leaf = structuredClone(blueprint);
    const first = groups[0];
    if (first !== undefined) {
      const children = [...(Array.isArray(first['children']) ? first['children'] : []), leaf];
      m.set(first, 'children', children, 'right/children');
      m.set(first, 'currentTab', children.length - 1, 'right/currentTab');
    } else {
      const children = [...(Array.isArray(right['children']) ? right['children'] : [])];
      children.push({ id: '6b696c6e74616273', type: 'tabs', children: [leaf], currentTab: 0 });
      m.set(right, 'children', children, 'right/children');
    }
  }
  if (right['collapsed'] === true) m.set(right, 'collapsed', false, 'right/collapsed');
  return o;
};

const RULES: Record<string, Rule> = {
  'settings/app.json': setKeys('settings/app.json'),
  'settings/types.json': types,
  'settings/daily-notes.json': setKeys('settings/daily-notes.json'),
  'settings/core-plugins.json': corePlugins,
  'settings/community-plugins.json': communityPlugins,
  'settings/appearance.json': appearance,
  'settings/plugins/homepage.json': homepage,
  'settings/plugins/iconic.json': iconic,
  'settings/plugins/templater.json': templater,
  'settings/plugins/quickadd.json': quickadd,
  'settings/workspace-file-properties.json': workspace,
};

/** The new value for the target; `undefined` means leave the target alone. Never mutates `current`. */
export function mergeFragment(
  fragment: string,
  current: Json | undefined,
  blueprint: Json,
  m: Merger,
  extra: MergeExtra,
): Json | undefined {
  if (fragment === 'settings/workspace-file-properties.json' && current === undefined) return undefined;
  const rule = RULES[fragment];
  if (rule === undefined) throw new Error(`no merge rule for ${fragment}`);
  const start =
    current === undefined ? (fragment === 'settings/community-plugins.json' ? [] : {}) : structuredClone(current);
  return rule(start, blueprint, m, extra);
}
