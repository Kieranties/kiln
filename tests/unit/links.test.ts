import { describe, it, expect } from 'vitest';
import { extractLinks, linkTo } from '../../src/links.js';

describe('extractLinks', () => {
  it('handles alias and heading forms and frontmatter arrays', () => {
    const fields = {
      project: '[[Gate Modernisation]]',
      related: ['[[Ada Reyes|Ada]]', '[[Scanner#Firmware]]'],
      priority: 3,
    };
    const body = 'See [[Runbook#Restart|the runbook]] and [[ Plain ]].';
    expect(extractLinks(fields, body)).toEqual(['Gate Modernisation', 'Ada Reyes', 'Scanner', 'Runbook', 'Plain']);
  });

  it('handles heading plus alias together and escaped pipes', () => {
    expect(extractLinks({}, '[[A#h|alias]] [[B\\|alias]]')).toEqual(['A', 'B']);
  });

  it('treats embeds as links to their target', () => {
    expect(extractLinks({}, '![[diagram.png]] and ![[Note#Part|x]]')).toEqual(['diagram.png', 'Note']);
  });

  it('de-duplicates case-insensitively, keeping the first-seen casing', () => {
    const fields = { related: ['[[Gate Scanner]]'] };
    expect(extractLinks(fields, '[[gate scanner]] [[GATE SCANNER#x]] [[Other]]')).toEqual(['Gate Scanner', 'Other']);
  });

  it('reads frontmatter before the body, in field order', () => {
    expect(extractLinks({ a: '[[One]]', b: ['[[Two]]'] }, '[[Three]]')).toEqual(['One', 'Two', 'Three']);
  });

  it('finds several links in one frontmatter string', () => {
    expect(extractLinks({ summary: 'Blocked by [[A]] and [[B]]' }, '')).toEqual(['A', 'B']);
  });

  it('ignores non-string frontmatter values and non-string array members', () => {
    expect(extractLinks({ n: 1, flag: true, none: null, mixed: ['[[Ok]]', 2, null] }, '')).toEqual(['Ok']);
  });

  it('skips empty targets and malformed brackets', () => {
    expect(extractLinks({}, '[[]] [[#only-heading]] [[|alias]] [single] [[unclosed')).toEqual([]);
  });

  it('returns an empty list when there are no links', () => {
    expect(extractLinks({}, 'plain text')).toEqual([]);
  });
});

describe('linkTo', () => {
  it('links by file stem with the title as label, or plainly when the stem is the title', () => {
    expect(linkTo('decisions/2026/2026-10-01 Mobile tickets.md', 'Mobile tickets')).toBe(
      '[[2026-10-01 Mobile tickets|Mobile tickets]]',
    );
    expect(linkTo('projects/Gate Upgrade Phase 2.md', 'Gate Upgrade: Phase 2')).toBe(
      '[[Gate Upgrade Phase 2|Gate Upgrade: Phase 2]]',
    );
    expect(linkTo('anchors/service/Turnstile Network.md', 'Turnstile Network')).toBe('[[Turnstile Network]]');
  });

  it('round-trips through extractLinks to the stem', () => {
    expect(
      extractLinks({ supersedes: [linkTo('decisions/2026/2026-10-01 Mobile tickets.md', 'Mobile tickets')] }, ''),
    ).toEqual(['2026-10-01 Mobile tickets']);
  });
});
