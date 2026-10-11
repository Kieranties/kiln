import { describe, expect, it } from 'vitest';
import { frontmatterLinkTarget, linkTargets, nearest } from '../../src/check/links.js';

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
    expect(nearest('Priya Rahman', ['Club Console', 'Priya Raman'])).toBe('Priya Raman');
    expect(nearest('Someone Else', ['Club Console', 'Priya Raman'])).toBeUndefined();
  });
});
