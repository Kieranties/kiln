import { describe, expect, it } from 'vitest';
import { frontmatterLinkTarget, linkTargets, nearestOf } from '../../src/check/links.js';

describe('links', () => {
  it('reads targets the way Obsidian links them, and skips what kiln does not check', () => {
    const body = [
      'See [[Club Console|the console]] and [[Renewal payments#Grace periods]].',
      '![[project-board.base]] `[[Not a link]]`',
      '```',
      '[[Also not a link]]',
      '```',
      '[[Daily/2026-10-07|tomorrow →]] [[#Context]]',
    ].join('\n');
    expect(linkTargets(body)).toEqual(['Club Console', 'Renewal payments']);
  });
  it('reads a relationship value', () => {
    expect(frontmatterLinkTarget('[[Season Ticket Renewals 2027|Renewals]]')).toBe('Season Ticket Renewals 2027');
  });
  it('suggests a near match within two edits', () => {
    const nearest = nearestOf(['Club Console', 'Priya Raman']);
    expect(nearest('Priya Rahman')).toBe('Priya Raman');
    expect(nearest('priya rahman')).toBe('Priya Raman');
    expect(nearest('Someone Else')).toBeUndefined();
  });
  it('gives the same hints as comparing every candidate in full', () => {
    // The plain version nearestOf replaced: sort every candidate, full edit distance against each.
    const full = (a: string, b: string): number => {
      const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
      for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
          const above = rows[i - 1] ?? [];
          row[j] = Math.min(
            (above[j] ?? 0) + 1,
            (row[j - 1] ?? 0) + 1,
            (above[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
          );
        }
        rows.push(row);
      }
      return rows[a.length]?.[b.length] ?? 0;
    };
    const plain = (name: string, candidates: string[]) => {
      let best: string | undefined;
      let bestDistance = 3;
      for (const c of [...candidates].sort()) {
        const d = full(name.toLowerCase(), c.toLowerCase());
        if (d < bestDistance) [best, bestDistance] = [c, d];
      }
      return best;
    };
    const candidates = [
      'Club Console',
      'Priya Raman',
      'Priya Ramen',
      'Vale Rovers',
      'Vale Rover',
      'Gate',
      'Gates',
      'Kiosk',
    ];
    const nearest = nearestOf(candidates);
    const names = [
      'Priya Rahman',
      'Priya Ram',
      'vale rovrs',
      'Gat',
      'Gatess',
      'Kosk',
      'Club Consoles!',
      'Somewhere',
      'G',
      '',
    ];
    for (const name of [...names, ...names]) expect(nearest(name), name).toBe(plain(name, candidates));
  });
});
