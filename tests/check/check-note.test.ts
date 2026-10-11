import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkNote, type CheckOptions } from '../../src/check/check-note.js';
import { formatResult } from '../../src/check/format.js';
import { openVault } from '../../src/check/vault.js';
import { makeVault } from './fixture.js';

const dir = makeVault({ broken: true });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const vault = openVault(dir);
const TYPES =
  'capture, daily, decision, meeting, organisation, person, product, project, reference, research, topic, work';

const errors = (path: string, options?: CheckOptions) =>
  checkNote(vault, path, options)
    .findings.filter((f) => f.level === 'error')
    .map((f) => f.message);

describe('checkNote errors', () => {
  it('a work note left in Inbox: folder, section and property', () => {
    expect(errors('Inbox/Decide the grace period.md')).toEqual([
      'type is work but the note is in Inbox/; work notes live in Work/',
      'missing section: ## Outcome',
      'unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)',
    ]);
  });

  it('kind, status and relationship shapes', () => {
    expect(errors('Work/Chase renewal refunds.md')).toEqual([
      'unknown kind: bugg (work kinds are feature, bug, chore, incident, task)',
      'status is doing; work statuses are backlog, active, blocked, review, done, abandoned',
      'github must be a list',
      'projects must be a list of links, such as projects: ["[[Name]]"]',
    ]);
  });

  it('Log must stay last; <% is an error only in a new note', () => {
    expect(checkNote(vault, 'Daily/2026-10-07.md').findings).toEqual([
      { level: 'error', message: '## Log must be the last section' },
      {
        level: 'warn',
        message: 'contains <%; Templater only runs it in a new note, so take it out before this text is reused',
      },
    ]);
    expect(errors('Daily/2026-10-07.md', { isNew: true })).toEqual([
      '## Log must be the last section',
      'contains <%, which Templater would run; remove it',
    ]);
  });

  it('the last section is the final heading, whatever repeats', () => {
    const lf = readFileSync(join(dir, 'Daily', '2026-10-07.md'), 'utf8');
    const front = lf.slice(0, lf.indexOf('\n---\n', 4) + 5);
    const write = (name: string, headings: string[]) =>
      writeFileSync(join(dir, 'Daily', name), front + headings.map((h) => `## ${h}\n\n- 09:00 x\n`).join('\n'));
    write('2026-10-08.md', ['Log', 'Reflection', 'Log']);
    write('2026-10-09.md', ['Reflection', 'Log', 'Reflection']);
    write('2026-10-10.md', ['Reflection']);
    expect(errors('Daily/2026-10-08.md')).not.toContain('## Log must be the last section');
    expect(errors('Daily/2026-10-09.md')).toContain('## Log must be the last section');
    const missingLog = errors('Daily/2026-10-10.md');
    expect(missingLog).toContain('missing section: ## Log');
    expect(missingLog).not.toContain('## Log must be the last section');
  });

  it('a moment with a status and no date in its name', () => {
    expect(errors('Meetings/Renewals retro.md')).toEqual([
      'meeting has no status; leave status empty',
      'meeting notes are named date first: YYYY-MM-DD title',
    ]);
  });

  it('frontmatter and no body: missing sections, and an error of its own when new', () => {
    const missing = ['missing section: ## Context', 'missing section: ## Checkpoints', 'missing section: ## Outcome'];
    expect(errors('Work/Refund card retries.md')).toEqual(missing);
    expect(errors('Work/Refund card retries.md', { isNew: true })).toEqual([
      'new note has properties and no body; create it from its template through QuickAdd',
      ...missing,
    ]);
  });

  it('an unlinkable file name', () => {
    expect(errors('References/NWA-150 Retry #3 fails.md')).toEqual([
      'file name contains #; replace # ^ [ ] | with a space and : with -',
    ]);
  });

  it('unknown and missing types', () => {
    expect(errors('Inbox/2026-10-07 Memo from the club.md')).toEqual([`unknown type: memo (types are ${TYPES})`]);
    expect(errors('Topics/Loose thoughts.md')).toEqual([`no type; set type to one of: ${TYPES}`]);
  });

  it('broken YAML is one error', () => {
    const found = errors('Projects/Broken frontmatter.md');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^frontmatter is not valid YAML: /);
  });

  it('a converted capture keeps captured, from and url', () => {
    expect(checkNote(vault, 'Work/Ask about grace periods.md').findings).toEqual([]);
  });

  it('a note with Windows line endings and a byte-order mark checks the same', () => {
    const lf = readFileSync(join(dir, 'Work', 'Fix renewal date rollover.md'), 'utf8');
    writeFileSync(join(dir, 'Work', 'Crlf copy.md'), '\uFEFF' + lf.replace(/\n/g, '\r\n'));
    expect(checkNote(vault, 'Work/Crlf copy.md').findings).toEqual([]);
  });

  it('skips an untyped note outside the type folders only when asked', () => {
    writeFileSync(join(dir, 'Home.md'), 'Open the [[Board.base|Board]].\n');
    expect(checkNote(vault, 'Home.md', { skipUntyped: true })).toEqual({
      path: 'Home.md',
      findings: [],
      skipped: true,
    });
    expect(errors('Home.md')).toEqual([`no type; set type to one of: ${TYPES}`]);
  });
});

describe('checkNote warnings and output', () => {
  it("prints the spec's example", () => {
    expect(formatResult(checkNote(vault, 'Inbox/Decide the grace period.md'))).toBe(
      [
        'Inbox/Decide the grace period.md',
        '  error  type is work but the note is in Inbox/; work notes live in Work/',
        '  error  missing section: ## Outcome',
        '  error  unknown property: attendees (work has jira, github, priority, projects, products, and the shared properties)',
        "  warn   [[Priya Rahman]] doesn't exist yet; did you mean [[Priya Raman]]?",
      ].join('\n'),
    );
  });

  it('warns about a file name another note uses', () => {
    expect(checkNote(vault, 'Topics/Priya Raman.md').findings).toEqual([
      { level: 'warn', message: 'file name also used by People/Priya Raman.md' },
    ]);
  });

  it('links in any letter case, with aliases, headings, embeds and code, raise nothing', () => {
    const note = readFileSync(join(dir, 'Topics', 'Renewal payments.md'), 'utf8');
    const extra = '\nSee [[club console|the console]], [[Club Console#Facts]], ![[missing.base]] and `[[Nowhere]]`.\n';
    writeFileSync(join(dir, 'Topics', 'Renewal payments copy.md'), note + extra);
    expect(checkNote(vault, 'Topics/Renewal payments copy.md').findings).toEqual([]);
  });
});
