import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const PLUGIN = join(REPO, 'claude-plugin');

type Entry = { name: string; source: string; version?: string };
type Catalog = { name: string; owner: { name: string }; plugins: Entry[] };
type Manifest = { name: string; version?: string };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const catalog = readJson<Catalog>(join(REPO, '.claude-plugin', 'marketplace.json'));
const manifest = readJson<Manifest>(join(PLUGIN, '.claude-plugin', 'plugin.json'));

describe('the catalog', () => {
  it('is the kiln marketplace, listing one plugin, kiln, from ./claude-plugin', () => {
    expect(catalog.name).toBe('kiln');
    expect(catalog.owner.name).not.toBe('');
    expect(catalog.plugins.map((p) => [p.name, p.source])).toEqual([['kiln', './claude-plugin']]);
  });

  it('points at a folder with a plugin manifest', () => {
    for (const entry of catalog.plugins) {
      expect(entry.source, entry.name).toMatch(/^\.\/[^.]/);
      expect(existsSync(join(REPO, entry.source, '.claude-plugin', 'plugin.json')), entry.source).toBe(true);
    }
  });
});

describe('the plugin manifest', () => {
  it('has the same name as its catalog entry', () => {
    expect(manifest.name).toBe(catalog.plugins[0]?.name);
  });

  it('has no version, here or in the catalog, so the commit SHA is the version', () => {
    expect(manifest).not.toHaveProperty('version');
    for (const entry of catalog.plugins) expect(entry, entry.name).not.toHaveProperty('version');
  });
});

describe('the plugin folder', () => {
  it('holds the only copy of the blueprint', () => {
    expect(existsSync(join(PLUGIN, 'blueprint', 'types'))).toBe(true);
    expect(existsSync(join(REPO, 'kit'))).toBe(false);
  });

  it('has no package manifest or lockfile, so installing it never runs npm', () => {
    // Claude Code runs npm install for a plugin with a package.json and a lockfile.
    for (const file of ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      expect(existsSync(join(PLUGIN, file)), file).toBe(false);
    }
  });

  it('has no symlinks', () => {
    // Git for Windows checks a symlink out as a text file holding its target.
    const links = readdirSync(PLUGIN, { recursive: true, withFileTypes: true })
      .filter((e) => e.isSymbolicLink())
      .map((e) => join(e.parentPath, e.name));
    expect(links).toEqual([]);
  });
});

describe('the release', () => {
  it('zips the blueprint from where it lives', () => {
    type Step = { name?: string; run?: string };
    const ci = parse(readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
      jobs: { release: { steps: Step[] } };
    };
    const steps = ci.jobs.release.steps;
    const zip = steps.find((s) => s.name === 'Zip the blueprint')?.run ?? '';
    const dir = /\(cd (\S+) && zip -r "[./]*dist\/kiln-blueprint-\$VERSION\.zip" \.\)/.exec(zip)?.[1];
    expect(dir).toBe('claude-plugin/blueprint');
    expect(steps.some((s) => s.run?.includes('"dist/kiln-blueprint-$VERSION.zip"'))).toBe(true);
  });
});

describe('the living docs', () => {
  // The dated plans and the design notes are records, and keep the paths they were written with.
  const LIVING = [
    'README.md',
    'CLAUDE.md',
    'docs/vision.md',
    'docs/specs/2026-10-11-layer-1-structure-design.md',
    'tests/fixtures/README.md',
    'claude-plugin/reference/vault-rules.md',
    ...readdirSync(join(PLUGIN, 'blueprint'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => `claude-plugin/blueprint/${f}`),
  ];
  const text = (doc: string) => readFileSync(join(REPO, doc), 'utf8');

  it('link only to files that exist', () => {
    const broken: string[] = [];
    for (const doc of LIVING) {
      for (const [, target = ''] of text(doc).matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const path = join(REPO, doc, '..', decodeURI(target.split('#')[0] ?? ''));
        if (!existsSync(path)) broken.push(`${doc}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('name no kit/ path, since the kit is now the blueprint', () => {
    const stale = LIVING.filter((doc) => /(?<![\w/])kit\//.test(text(doc)));
    expect(stale).toEqual([]);
  });
});
