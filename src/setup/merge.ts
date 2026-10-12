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

const homepage: Rule = (current, blueprint, m) => {
  const o = asObject(current, m);
  const b = asObject(blueprint, m);
  m.set(o, 'version', b['version'] ?? null);
  const main = asObject(b['homepages'] ?? {}, m)['Main Homepage'];
  if (main !== undefined) {
    m.setOwned(
      m.object(o, 'homepages'),
      'Main Homepage',
      main,
      'homepages/Main Homepage',
      (a, c) => isObject(a) && isObject(c) && a['value'] === c['value'] && a['kind'] === c['kind'],
    );
  }
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
