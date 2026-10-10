import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Index } from '../../src/index/db.js';
import { jaccard, titleTokens } from '../../src/similarity.js';
import type { Base } from '../../src/types.js';
import { validateBase, type Finding } from '../../src/validate.js';

let base: Base;
let ix: Index | undefined;

function write(rel: string, text: string): void {
  const abs = join(base.path, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

/** A note whose frontmatter is the given raw YAML lines. */
const note = (fm: string[], body = '\n## Summary\nText.\n'): string => `---\n${fm.join('\n')}\n---\n${body}`;

/** A well-formed knowledge note: valid schema, summary and aliases present. */
function good(type: string, title: string, extra: string[] = [], body?: string): string {
  return note([`type: ${type}`, `title: ${JSON.stringify(title)}`, `summary: About ${title}.`, 'aliases: ["alt"]', ...extra], body);
}

/** Open the index (reconciling the files written so far) and validate. */
function run(): Finding[] {
  ix = Index.open(base);
  return validateBase(ix);
}

const of = (findings: Finding[], kind: Finding['kind']): Finding[] => findings.filter((f) => f.kind === kind);

beforeEach(() => {
  base = { name: 'northwind', path: mkdtempSync(join(tmpdir(), 'kiln-validate-')) };
});

afterEach(() => {
  ix?.close();
  ix = undefined;
  rmSync(base.path, { recursive: true, force: true });
});

describe('validateBase', () => {
  it('a clean base has no findings', () => {
    write('anchors/organisation/Northwind Arena.md', good('anchor', 'Northwind Arena', ['kind: organisation', 'status: active']));
    write('anchors/service/Turnstile Network.md', good('anchor', 'Turnstile Network', ['kind: service'], '\nRuns at [[Northwind Arena]].\n'));
    write('notes/Gate chat.md', '# Hand written, no frontmatter\nSee [[Turnstile Network]].\n');
    expect(run()).toEqual([]);
  });

  it('schema: reports each issue with its field and fix, only for notes with a type', () => {
    write('work/2026/Fix gate lamp.md', good('work', 'Fix gate lamp', ['kind: wobble', 'status: active', 'created: 10/10/2026']));
    write('notes/Typeless.md', note(['title: Typeless', 'status: whatever']));
    const schema = of(run(), 'schema');
    expect(schema.map((f) => f.path)).toEqual(['work/2026/Fix gate lamp.md', 'work/2026/Fix gate lamp.md']);
    const messages = schema.map((f) => f.message);
    expect(messages.find((m) => m.startsWith('kind:'))).toContain('use one of: feature, bug, chore, incident, research');
    expect(messages.find((m) => m.startsWith('created:'))).toContain('use YYYY-MM-DD');
  });

  it('schema: reports frontmatter that is not valid YAML, but not typeless notes or notes without frontmatter', () => {
    write('anchors/person/Emmanuel Park.md', '---\ntype: anchor\ntitle: [unclosed\n  - nope: : :\n---\nBody.\n');
    write('notes/Typeless.md', note(['title: Typeless']));
    write('notes/Plain.md', 'No frontmatter here.\n');
    const schema = of(run(), 'schema');
    expect(schema).toHaveLength(1);
    expect(schema[0]).toMatchObject({ path: 'anchors/person/Emmanuel Park.md', kind: 'schema' });
    expect(schema[0]!.message).toMatch(/^frontmatter: Invalid frontmatter YAML/);
  });

  it('broken_link: reports unresolved targets once per source, and resolves titles, aliases, stems and attachments', () => {
    write('anchors/organisation/Northwind Arena.md', good('anchor', 'Northwind Arena', ['kind: organisation']));
    write('anchors/person/Emmanuel Park.md', good('anchor', 'Emmanuel Park', ['kind: person']).replace('["alt"]', '["Manny"]'));
    write('attachments/gate-plan.png', 'png');
    write(
      'projects/Gate Upgrade.md',
      good('project', 'Gate Upgrade', [], '\n[[Northwind Arena]] [[Manny]] [[Ghost Stand]] [[ghost stand]] [[Missing Doc]]\n![[gate-plan.png]] ![[no-such.png]]\n'),
    );
    const broken = of(run(), 'broken_link');
    expect(broken.map((f) => f.path)).toEqual(Array(3).fill('projects/Gate Upgrade.md'));
    const messages = broken.map((f) => f.message).sort();
    expect(messages).toEqual([
      '[[Ghost Stand]] does not match any note title, alias or file name',
      '[[Missing Doc]] does not match any note title, alias or file name',
      '[[no-such.png]] does not match any note title, alias or file name',
    ]);
  });

  it('broken_link: resolution is case-insensitive, by file stem and by base-relative path', () => {
    // The title differs from the file stem, so these links can only resolve through the stem or the path.
    write('decisions/2026/2026-10-01 Mobile tickets.md', good('decision', 'Mobile ticket policy', ['decided_on: 2026-10-01']));
    write('attachments/Gate Plan.PNG', 'png');
    write(
      'notes/Links.md',
      '\n[[2026-10-01 MOBILE TICKETS]] [[Decisions/2026/2026-10-01 mobile tickets]] [[decisions/2026/2026-10-01 Mobile tickets.md]] ![[gate plan.png]]\n',
    );
    expect(of(run(), 'broken_link')).toEqual([]);
  });

  it('missing_enrichment: flags non-source notes without a summary or aliases; sources and typeless notes are exempt', () => {
    write('anchors/topic/Parking.md', note(['type: anchor', 'kind: topic', 'title: Parking', 'summary: Where cars go.']));
    write('anchors/topic/Catering.md', note(['type: anchor', 'kind: topic', 'title: Catering', 'aliases: ["Food"]', 'summary: "  "']));
    write('anchors/topic/Ticketing.md', good('anchor', 'Ticketing', ['kind: topic']));
    write('anchors/topic/Safety.md', note(['type: anchor', 'kind: topic', 'title: Safety']));
    write('sources/web/2026-09-30 Stadium news.md', note(['type: source', 'kind: web', 'title: Stadium news', 'triage: pending', 'captured_at: 2026-09-30']));
    write('notes/Typeless.md', note(['title: Typeless']));
    expect(of(run(), 'missing_enrichment').map((f) => [f.path, f.message])).toEqual([
      ['anchors/topic/Catering.md', 'missing summary'],
      ['anchors/topic/Parking.md', 'missing aliases'],
      ['anchors/topic/Safety.md', 'missing summary and aliases'],
    ]);
  });

  it('possible_duplicate: same type and title similarity at least 0.85, reported once on the smaller path', () => {
    write('work/2026/B.md', good('work', 'Replace turnstile controller firmware at north stand gates'));
    write('work/2026/A.md', good('work', 'Replace turnstile controller firmware at north stand gates'));
    write('work/2026/C.md', good('work', 'Replace turnstile controller firmware north stand gates'));
    write('work/2026/D.md', good('work', 'Replace turnstile controller firmware'));
    // Same title but a different type is not a duplicate.
    write('decisions/2026/E.md', good('decision', 'Replace turnstile controller firmware at north stand gates', ['decided_on: 2026-10-01']));
    const dups = of(run(), 'possible_duplicate');
    expect(dups.map((f) => f.path)).toEqual(['work/2026/A.md', 'work/2026/A.md', 'work/2026/B.md']);
    expect(dups[0]!.message).toContain('work/2026/B.md');
    expect(dups[1]!.message).toContain('work/2026/C.md');
    expect(dups[2]!.message).toContain('work/2026/C.md');
    expect(dups.some((f) => f.message.includes('work/2026/D.md') || f.message.includes('decisions/2026/E.md'))).toBe(false);
  });

  it('possible_duplicate: equal titles ignoring case and spacing match even when they have no word tokens', () => {
    write('notes/One.md', good('note', 'The And'));
    write('notes/Two.md', good('note', '  the and '));
    const dups = of(run(), 'possible_duplicate');
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ path: 'notes/One.md' });
    expect(dups[0]!.message).toContain('notes/Two.md');
  });

  it('possible_duplicate: agrees with a brute-force comparison over many generated titles', () => {
    const words = ['gate', 'queue', 'ticket', 'stand', 'north', 'south', 'turnstile', 'radio', 'rota', 'audit', 'lamp', 'meeting'];
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const titles: string[] = [];
    for (let i = 0; i < 60; i++) {
      const count = 3 + next(6);
      titles.push(Array.from({ length: count }, () => words[next(words.length)]!).join(' ') + ` ${i % 3 === 0 ? '' : 'x' + i}`);
    }
    titles.forEach((t, i) => write(`notes/n${String(i).padStart(3, '0')}.md`, good('note', t)));

    const expected: string[] = [];
    for (let i = 0; i < titles.length; i++) {
      for (let j = i + 1; j < titles.length; j++) {
        const a = titles[i]!;
        const b = titles[j]!;
        const same = a.trim().toLowerCase() === b.trim().toLowerCase();
        if (same || jaccard(titleTokens(a), titleTokens(b)) >= 0.85) {
          expected.push(`notes/n${String(i).padStart(3, '0')}.md|notes/n${String(j).padStart(3, '0')}.md`);
        }
      }
    }
    const actual = of(run(), 'possible_duplicate').map((f) => `${f.path}|${/duplicate of (\S+) /.exec(f.message)![1]}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(actual.sort()).toEqual(expected.sort());
  });

  it('sorts findings by path, then kind, then message', () => {
    write('work/2026/Zed.md', note(['type: work', 'title: Zed', 'status: nope']));
    write('anchors/topic/Alpha.md', note(['type: anchor', 'kind: topic', 'title: Alpha'], '\n[[Nowhere]]\n'));
    const found = run();
    expect(found.map((f) => [f.path, f.kind])).toEqual([
      ['anchors/topic/Alpha.md', 'broken_link'],
      ['anchors/topic/Alpha.md', 'missing_enrichment'],
      ['work/2026/Zed.md', 'missing_enrichment'],
      ['work/2026/Zed.md', 'schema'],
    ]);
  });

  it('validate never modifies files', () => {
    write('anchors/person/Emmanuel Park.md', '---\ntype: anchor\ntitle: [unclosed\n---\nBody [[Nowhere]].\n');
    write('work/2026/Fix gate lamp.md', note(['type: work', 'title: Fix gate lamp', 'status: nope']));
    write('notes/Typeless.md', note(['title: Typeless']));
    write('attachments/gate-plan.png', 'png');
    ix = Index.open(base);

    const snapshot = (): Record<string, string> => {
      const out: Record<string, string> = {};
      const walk = (dir: string, rel: string): void => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const abs = join(dir, e.name);
          const r = rel === '' ? e.name : `${rel}/${e.name}`;
          if (e.isDirectory()) {
            if (e.name !== '.kiln') walk(abs, r);
          } else {
            out[r] = `${createHash('sha256').update(readFileSync(abs)).digest('hex')} ${statSync(abs).mtimeMs}`;
          }
        }
      };
      walk(base.path, '');
      return out;
    };

    const before = snapshot();
    const findings = validateBase(ix);
    expect(findings.length).toBeGreaterThan(0);
    expect(snapshot()).toEqual(before);
    // Nor does it touch the index: a second run gives the same answer.
    expect(validateBase(ix)).toEqual(findings);
  });
});
