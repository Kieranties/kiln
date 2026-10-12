import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allBases,
  columnLabel,
  BLUEPRINT,
  loadBase,
  loadDefinitions,
  sectionsOf,
  viewFile,
  viewFiles,
} from '../support/blueprint.js';

const defs = loadDefinitions();
const STANDALONE = ['inbox.base', 'needs-review.base', 'active-projects.base', 'today.base'];

/** Each related view: the page it sits on, its heading, its Base file and the filter it needs. */
const related = defs.flatMap((d) =>
  Object.entries(d.views).map(([heading, view]) => {
    let match = `list(${view.via}).contains(this)`;
    if (view.via === 'link') match = 'file.hasLink(this.file)';
    if (view.via === 'created') match = 'created == this.date';
    if (view.via === 'mtime') match = 'file.mtime.date() == this.date';
    return { page: d.name, heading, file: viewFile(d.name, heading), listed: view.type, match };
  }),
);

describe('related views', () => {
  it('every view in a definition has its Base file', () => {
    const files = viewFiles();
    for (const v of related) expect(files, `${v.page}: ${v.heading}`).toContain(v.file);
  });

  it('no Base file is unused', () => {
    const used = new Set([...related.map((v) => v.file), ...STANDALONE]);
    for (const f of viewFiles()) expect(used.has(f), f).toBe(true);
  });

  it('each Base filters on the listed type and its relationship', () => {
    for (const v of related) {
      expect(loadBase(`views/${v.file}`).filters?.and, v.file).toEqual([`type == "${v.listed}"`, v.match]);
    }
  });

  it('each Base has one view, named after its heading', () => {
    for (const v of related) {
      const base = loadBase(`views/${v.file}`);
      expect(
        base.views.map((view) => view.name),
        v.file,
      ).toEqual([v.heading]);
    }
  });

  it('table columns show what the listed type has', () => {
    for (const v of related) {
      const view = loadBase(`views/${v.file}`).views[0];
      if (view?.type !== 'table') continue;
      const listed = defs.find((d) => d.name === v.listed);
      const expected = ['file.name'];
      if (Object.keys(listed?.kinds ?? {}).length) expected.push('kind');
      if (listed?.statuses.length) expected.push('status');
      expected.push('summary');
      expect(view.order, v.file).toEqual(expected);
    }
  });

  it('the project board is a kanban grouped by status', () => {
    const view = loadBase('views/project-board.base').views[0];
    expect(view?.type).toBe('kanban');
    expect(view?.groupBy?.property).toBe('status');
  });

  it('every related view is a table except the project board', () => {
    for (const v of related.filter((r) => r.file !== 'project-board.base')) {
      expect(loadBase(`views/${v.file}`).views[0]?.type, v.file).toBe('table');
    }
  });
});

describe('readable views', () => {
  it('boards keep a column for every live status, in order, even when empty', () => {
    const live = (defs.find((d) => d.name === 'work')?.statuses ?? []).filter((s) => s !== 'abandoned');
    for (const path of ['root/Board.base', 'views/project-board.base']) {
      expect(loadBase(path).views[0]?.groupOrder, path).toEqual(live);
    }
  });

  it('every view column has a readable header', () => {
    for (const path of allBases()) {
      const base = loadBase(path);
      for (const column of base.views[0]?.order ?? []) {
        expect(base.properties?.[column]?.displayName, `${path}: ${column}`).toBe(columnLabel(column));
      }
    }
  });
});

describe('Home, Board and the standalone views', () => {
  it('board shows all live work as a kanban by status', () => {
    const board = loadBase('root/Board.base');
    expect(board.filters).toEqual({
      and: [
        'type == "work"',
        'status != "abandoned"',
        { or: ['status != "done"', 'file.mtime > now() - "14 days"'] },
        { not: ['file.inFolder("_kiln")'] },
      ],
    });
    const view = board.views[0];
    expect(view?.type).toBe('kanban');
    expect(view?.groupBy?.property).toBe('status');
    expect(view?.order).toContain('projects');
  });

  it('board does not need a project, so personal tasks show', () => {
    expect(JSON.stringify(loadBase('root/Board.base').filters)).not.toContain('projects');
  });

  it('inbox lists captures waiting for triage', () => {
    expect(loadBase('views/inbox.base').filters).toEqual({
      and: ['type == "capture"', 'status == "inbox"', { not: ['file.inFolder("_kiln")'] }],
    });
  });

  it('views that match on type alone leave out the blueprint templates', () => {
    // Templates in _kiln/templates carry type and status, so Bases would list them too.
    for (const path of ['views/inbox.base', 'root/Board.base']) {
      expect(JSON.stringify(loadBase(path).filters), path).toContain('{"not":["file.inFolder(\\"_kiln\\")"]}');
    }
  });

  it('needs review lists any note with a reason', () => {
    const base = loadBase('views/needs-review.base');
    expect(base.filters).toEqual({ not: ['review.isEmpty()'] });
    expect(base.views[0]?.order).toContain('review');
  });

  it('active projects', () => {
    expect(loadBase('views/active-projects.base').filters).toEqual({
      and: ['type == "project"', 'status == "active"'],
    });
  });

  it("today finds today's daily note", () => {
    expect(loadBase('views/today.base').filters).toEqual({ and: ['type == "daily"', 'date == today()'] });
  });

  it('home embeds today, inbox, active projects and needs review, and links the board', () => {
    const home = readFileSync(join(BLUEPRINT, 'root', 'Home.md'), 'utf8');
    const sections = sectionsOf(home);
    expect([...sections.keys()]).toEqual(['Today', 'Inbox', 'Active projects', 'Needs review']);
    expect(sections.get('Today')).toBe('![[today.base]]');
    expect(sections.get('Inbox')).toBe('![[inbox.base]]');
    expect(sections.get('Active projects')).toBe('![[active-projects.base]]');
    expect(sections.get('Needs review')).toBe('![[needs-review.base]]');
    expect(home).toContain('[[Board.base|Board]]');
    expect(home).not.toMatch(/^# /m);
  });
});
