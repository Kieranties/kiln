import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../../src/check/run.js';
import { makeVault } from '../support/vault.js';

// A large vault: 2,000 topic notes, each with two links to notes that don't exist,
// one a near miss of another note's name. The check must stay well inside Claude's
// two-minute command limit. Before link hints were indexed this took over 20 seconds;
// now it takes about one.
const NOTES = 2000;
const WORDS = ['renewals', 'gate', 'card retries', 'pitch', 'season tickets', 'away fans', 'kiosk', 'refunds'];
const name = (i: number) => `Topic ${String(i).padStart(4, '0')} ${WORDS[i % WORDS.length]}`;

let root = '';
beforeAll(() => {
  root = makeVault();
  const sample = readFileSync(join(root, 'Topics', 'Renewal payments.md'), 'utf8');
  const front = sample.slice(0, sample.indexOf('\n---\n', 4) + 5);
  const sections = '## Overview\n\n## Durable facts\n\n## Notes\n\n## Sub-topics\n';
  for (let i = 0; i < NOTES; i++) {
    const near = name((i + 1) % NOTES).replace('Topic', 'Topik');
    const body = `${sections}\nSee [[${near}]] and [[Nothing like ${i} at all]].\n`;
    writeFileSync(join(root, 'Topics', `${name(i)}.md`), front + body);
  }
}, 120_000);
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('runCheck on a large vault', () => {
  it('checks 2,000 notes with 4,000 unresolved links in a few seconds, with the same hints', () => {
    const started = performance.now();
    const { output } = runCheck([join(root, 'Topics')]);
    const seconds = (performance.now() - started) / 1000;

    expect(output).toContain(
      [
        `Topics/${name(0)}.md`,
        `  warn   [[Topik 0001 gate]] doesn't exist yet; did you mean [[${name(1)}]]?`,
        "  warn   [[Nothing like 0 at all]] doesn't exist yet",
      ].join('\n'),
    );
    expect(output).toMatch(/Checked 2001 notes: 0 errors, 4000 warnings\.$/);
    // Generous, so a slow CI runner doesn't fail it.
    expect(seconds).toBeLessThan(10);
  }, 120_000);
});
