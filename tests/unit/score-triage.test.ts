import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatScore, isEntry, scoreTriage, type AnswerKey } from '../../scripts/score-triage.js';

let base: string;

function write(rel: string, text: string): void {
  const abs = join(base, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text, 'utf8');
}

function source(fields: string): string {
  return `---\ntype: source\ncaptured_at: 2026-10-10\n${fields}\n---\nBody.\n`;
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'kiln-score-'));
  // Targets: one resolvable by title, one only by its file stem (no title field).
  write('work/2026/Fix the turnstiles.md', '---\ntype: work\ntitle: Fix the turnstiles\n---\n');
  write('anchors/organisation/Kingsport FC.md', '---\ntype: anchor\nkind: organisation\n---\n');
  write('decisions/2026/2026-03-04 Card only.md', '---\ntype: decision\ntitle: Card only\ndecided_on: 2026-03-04\n---\n');

  // Correct, linked to the expected work note by title.
  write('sources/jira/a.md', source('triage: linked\ntriage_outcome: update-work-item\nlinked_to:\n  - "[[Fix the turnstiles]]"'));
  // Wrong outcome: expected supersede, recorded new-decision.
  write('sources/meeting/b.md', source('triage: linked\ntriage_outcome: new-decision\nlinked_to:\n  - "[[Something new]]"'));
  // Still pending: wrong even though an outcome is present.
  write('sources/email/c.md', source('triage: pending\ntriage_outcome: link-to-anchor'));
  // d.md is missing from the base entirely.
  // Correct, linked to the anchor by its file stem, plus one extra link that is not a target.
  write(
    'sources/slack/nested/e.md',
    source('triage: linked\ntriage_outcome: link-to-anchor\nlinked_to:\n  - "[[Kingsport FC]]"\n  - "[[Fix the turnstiles]]"'),
  );
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('score-triage', () => {
  it('score-triage computes accuracy and mismatches from a synthetic base', () => {
    const key: AnswerKey = {
      captures: [
        { file: 'a.md', expected_outcome: 'update-work-item', targets: ['work/2026/Fix the turnstiles.md'] },
        { file: 'b.md', expected_outcome: 'supersede', targets: ['decisions/2026/2026-03-04 Card only.md'] },
        { file: 'c.md', expected_outcome: 'link-to-anchor', targets: ['anchors/organisation/Kingsport FC.md'] },
        { file: 'd.md', expected_outcome: 'dismiss', targets: [] },
        { file: 'e.md', expected_outcome: 'link-to-anchor', targets: ['anchors/organisation/Kingsport FC.md'] },
      ],
    };

    const score = scoreTriage(base, key);

    expect(score.total).toBe(5);
    expect(score.correct).toBe(2);
    expect(score.accuracy).toBeCloseTo(0.4);
    expect(score.mismatches.map((m) => [m.file, m.expected, m.actual])).toEqual([
      ['b.md', 'supersede', 'new-decision'],
      ['c.md', 'link-to-anchor', 'pending'],
      ['d.md', 'dismiss', 'missing'],
    ]);
    expect(score.mismatches[0]!.linkedTo).toEqual(['[[Something new]]']);
    expect(score.mismatches[0]!.targets).toEqual(['decisions/2026/2026-03-04 Card only.md']);

    // Informational: linked_to entries that resolve to no existing-path target of their capture.
    expect(score.unmatchedLinks).toEqual([
      { file: 'b.md', link: '[[Something new]]', resolved: null },
      { file: 'e.md', link: '[[Fix the turnstiles]]', resolved: 'work/2026/Fix the turnstiles.md' },
    ]);

    const report = formatScore(score);
    expect(report).toContain('accuracy: 0.40 (2/5)');
    expect(report).toContain('b.md: expected supersede, got new-decision');
    expect(report).toContain('d.md: expected dismiss, got missing');
  });

  it('score-triage recognises its own entry path despite case, separator and extension differences', () => {
    const file = join(base, 'scripts', 'score-triage.ts');
    write('scripts/score-triage.ts', '');
    const url = pathToFileURL(file).href;
    expect(isEntry(file, url)).toBe(true);
    expect(isEntry(file.replaceAll('\\', '/'), url)).toBe(true);
    expect(isEntry(file.replace(/\.ts$/, ''), url)).toBe(true);
    if (process.platform === 'win32') {
      const flipped = file[0] === file[0]!.toUpperCase() ? file[0].toLowerCase() + file.slice(1) : file[0]!.toUpperCase() + file.slice(1);
      expect(isEntry(flipped, url)).toBe(true);
      expect(isEntry(file.toUpperCase(), url)).toBe(true);
    }
    expect(isEntry(join(base, 'scripts', 'scale.ts'), url)).toBe(false);
    expect(isEntry(undefined, url)).toBe(false);
  });
});
