import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
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
  const markdownUnder = (dir: string): string[] =>
    readdirSync(join(REPO, dir), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => relative(REPO, join(e.parentPath, e.name)).split(sep).join('/'));
  const LIVING = [
    'README.md',
    'CLAUDE.md',
    'GLOSSARY.md',
    'tests/fixtures/README.md',
    ...markdownUnder('docs'),
    ...markdownUnder('claude-plugin/reference'),
    ...markdownUnder('claude-plugin/skills'),
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

  it('include only files that exist', () => {
    const broken: string[] = [];
    for (const doc of LIVING) {
      for (const [, target = ''] of text(doc).matchAll(/<!--\s*@include:\s*([^\s{]+)/g)) {
        if (!existsSync(join(REPO, doc, '..', target))) broken.push(`${doc}: ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('use the glossary: no kit, layer, kiln plugin or the plugin, except where an ADR or the glossary names them', () => {
    const quoting = (doc: string) => doc === 'GLOSSARY.md' || doc.startsWith('docs/adr/');
    const stale = LIVING.filter((doc) => !quoting(doc)).flatMap((doc) =>
      [...text(doc).matchAll(/\b(kit|layers?|layer\s?1|kiln plugin|the plugin)\b/gi)].map((m) => `${doc}: ${m[0]}`),
    );
    expect(stale).toEqual([]);
  });

  it('are only guides, reference, concepts, decisions and the agents notes', () => {
    const top = readdirSync(join(REPO, 'docs'), { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    const allowed = ['guides/', 'reference/', 'concepts/', 'adr/', 'agents/', 'index.md', 'glossary.md'];
    expect(top.filter((entry) => !allowed.includes(entry))).toEqual([]);
  });
});

describe('the README', () => {
  const readme = readFileSync(join(REPO, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const commands = [...readme.matchAll(/^claude plugin .+$/gm)].map((m) => m[0].trim());

  it('installs kiln by the names in the catalog, and links the docs site', () => {
    expect(commands).toEqual([
      'claude plugin marketplace add Kieranties/kiln',
      `claude plugin install ${catalog.plugins[0]?.name}@${catalog.name}`,
    ]);
    expect(readme).toContain('](https://kiln.kieranties.com/)');
  });
});

describe('the install guide', () => {
  const guide = readFileSync(join(REPO, 'docs', 'guides', 'install.md'), 'utf8').replace(/\r\n/g, '\n');
  const commands = [...guide.matchAll(/^claude plugin .+$/gm)].map((m) => m[0].trim());
  const id = `${catalog.plugins[0]?.name}@${catalog.name}`;

  it('installs, updates and turns off kiln by the names in the catalog', () => {
    for (const command of [
      'claude plugin marketplace add Kieranties/kiln',
      `claude plugin install ${id}`,
      `claude plugin marketplace update ${catalog.name}`,
      `claude plugin update ${id}`,
      `claude plugin disable ${id} --scope local`,
    ]) {
      expect(commands, command).toContain(command);
    }
  });

  it('turns kiln off only in one repo, never at user scope', () => {
    const off = commands.filter((c) => c.startsWith(`claude plugin disable ${id}`));
    expect(off).toEqual([`claude plugin disable ${id} --scope local`]);
  });

  it('gives commands that read the same in Bash and pwsh', () => {
    // No variables, quoting, pipes, separators or backslash paths that differ between the shells.
    for (const command of commands) expect(command, command).not.toMatch(/[$`'"|;&\\]/);
  });

  it('documents the companion Obsidian skills and Claudian', () => {
    expect(commands).toContain('claude plugin install obsidian@obsidian-skills');
    expect(guide).toContain('Load user Claude Code settings');
  });
});

describe('the docs and the skills', () => {
  it('name every skill, in the skills reference and the repo reference', () => {
    const skillsPage = readFileSync(join(REPO, 'docs', 'reference', 'skills.md'), 'utf8').replace(/\r\n/g, '\n');
    const repoPage = readFileSync(join(REPO, 'docs', 'reference', 'repo.md'), 'utf8').replace(/\r\n/g, '\n');
    const skills = readdirSync(join(PLUGIN, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const row = /^\| `claude-plugin\/skills\/` \|(.*)$/m.exec(repoPage)?.[1] ?? '';
    for (const skill of skills) {
      expect(skillsPage, skill).toMatch(new RegExp(`^## \`/kiln:${skill}\`$`, 'm'));
      expect(row, skill).toContain(`\`${skill}\``);
    }
  });
});

describe('the docs site', () => {
  type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
  type Job = { if?: string; needs?: string[]; steps: Step[] };
  const ci = parse(readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
    jobs: Record<string, Job>;
  };
  const config = readFileSync(join(REPO, 'docs', '.vitepress', 'config.mts'), 'utf8');

  it('is built by every check, so a broken page or link fails the PR', () => {
    expect(ci.jobs.check?.steps.map((s) => s.run)).toContain('npm run docs:build');
  });

  it('is deployed to GitHub Pages from main, after the check', () => {
    const docs = ci.jobs.docs;
    expect(docs?.if).toContain("github.ref == 'refs/heads/main'");
    expect(docs?.needs).toContain('check');
    const upload = docs?.steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact@'));
    expect(upload?.with?.path).toBe('docs/.vitepress/dist');
    expect(docs?.steps.some((s) => s.uses?.startsWith('actions/deploy-pages@'))).toBe(true);
  });

  it('is served from the root of kiln.kieranties.com, and leaves out the agents notes', () => {
    expect(config).toContain("base: '/'");
    expect(config).toContain("srcExclude: ['agents/**']");
  });

  it('has one copy of the glossary, the blueprint README and the vault rules', () => {
    for (const [page, source] of [
      ['docs/glossary.md', '../GLOSSARY.md'],
      ['docs/reference/blueprint.md', '../../claude-plugin/blueprint/README.md'],
      ['docs/reference/vault-rules.md', '../../claude-plugin/reference/vault-rules.md'],
    ] as const) {
      const text = readFileSync(join(REPO, page), 'utf8');
      // From line 2: the page has its own title.
      expect(text, page).toContain(`<!--@include: ${source}{2,}-->`);
      expect(readFileSync(join(REPO, page, '..', source), 'utf8'), source).toMatch(/^# /);
    }
  });
});

describe('the pre-push checks', () => {
  it("are the steps of CI's check job, in the repo reference, which CLAUDE.md points to", () => {
    type Step = { run?: string };
    const ci = parse(readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8')) as {
      jobs: { check: { steps: Step[] } };
    };
    const runs = ci.jobs.check.steps.flatMap((s) => (s.run && s.run !== 'npm ci' ? [s.run] : []));
    const reference = readFileSync(join(REPO, 'docs', 'reference', 'repo.md'), 'utf8');
    for (const run of runs) expect(reference, run).toContain('`' + run + '`');
    expect(readFileSync(join(REPO, 'CLAUDE.md'), 'utf8')).toContain('](docs/reference/repo.md)');
  });
});
