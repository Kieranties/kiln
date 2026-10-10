import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configPath, loadConfig, saveConfig } from './config.js';
import { KilnError, type Base } from './types.js';

const FOLDERS = [
  'anchors/organisation',
  'anchors/product',
  'anchors/service',
  'anchors/person',
  'anchors/topic',
  'projects',
  'work',
  'decisions',
  'references',
  'notes',
  'attachments',
  'sources/jira',
  'sources/github',
  'sources/slack',
  'sources/email',
  'sources/meeting',
  'sources/web',
  'sources/note',
  'views',
  '.kiln/index',
];

const VIEWS: Record<string, string> = {
  'Inbox.base': `filters:
  and:
    - 'type == "source"'
    - 'triage == "pending"'
views:
  - type: table
    name: Inbox
    order: [file.name, kind, captured_at, why]
`,
  'Needs review.base': `filters:
  and:
    - 'review == "needed"'
views:
  - type: table
    name: Needs review
    order: [file.name, type, review_reason, updated]
`,
  'Active work.base': `filters:
  and:
    - 'type == "work"'
views:
  - type: table
    name: Active work
    filters:
      or:
        - 'status == "active"'
        - 'status == "blocked"'
    order: [file.name, kind, status, ticket, last_checkpoint, updated]
`,
  'Decisions.base': `filters:
  and:
    - 'type == "decision"'
views:
  - type: table
    name: Decisions
    order: [file.name, status, decided_on, anchors, superseded_by]
`,
};

const NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Forward-slash path; lowercased on win32 so comparisons are case-insensitive. */
function comparable(p: string): string {
  const s = resolve(p).replaceAll('\\', '/');
  return process.platform === 'win32' ? s.toLowerCase() : s;
}

/** Appends `line` unless an existing line equals it (trimmed). Creates the file if missing; keeps its EOL style. */
function ensureLine(file: string, line: string): void {
  if (!existsSync(file)) {
    writeFileSync(file, `${line}\n`, 'utf8');
    return;
  }
  const text = readFileSync(file, 'utf8');
  if (text.split(/\r?\n/).some((l) => l.trim() === line)) return;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lead = text === '' || text.endsWith('\n') ? '' : eol;
  writeFileSync(file, `${text}${lead}${line}${eol}`, 'utf8');
}

/** Creates the base layout, ignore entries and Obsidian views, and registers the base in the config. */
export function initBase(path: string, name: string, cfgPath: string = configPath()): Base {
  if (!NAME_PATTERN.test(name)) {
    throw new KilnError('validation', `Invalid base name "${name}": use letters, digits, "_" and "-"`);
  }
  const abs = resolve(path);

  // Check the config first so a conflict changes nothing on disk.
  const cfg = loadConfig(cfgPath);
  const sameName = cfg.bases.find((b) => b.name === name);
  const samePath = cfg.bases.find((b) => comparable(b.path) === comparable(abs));
  if (sameName && comparable(sameName.path) !== comparable(abs)) {
    throw new KilnError('validation', `Base "${name}" is already registered at ${sameName.path}`, {
      name,
      registered: sameName.path,
      requested: abs,
    });
  }
  if (samePath && samePath.name !== name) {
    throw new KilnError('validation', `${abs} is already registered as base "${samePath.name}"`, {
      name: samePath.name,
      path: abs,
    });
  }

  mkdirSync(abs, { recursive: true });
  for (const folder of FOLDERS) mkdirSync(join(abs, folder), { recursive: true });

  ensureLine(join(abs, '.gitignore'), '.kiln/');
  ensureLine(join(abs, '.stignore'), '.kiln');

  for (const [file, content] of Object.entries(VIEWS)) {
    const target = join(abs, 'views', file);
    if (!existsSync(target)) writeFileSync(target, content, 'utf8');
  }

  const base: Base = { name, path: abs };
  if (!sameName) {
    cfg.bases.push(base);
    if (!cfg.default_base) cfg.default_base = name;
    saveConfig(cfg, cfgPath);
  }
  return base;
}
