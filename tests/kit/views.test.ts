import { describe, expect, it } from 'vitest';
import { loadBase, loadDefinitions, viewFile, viewFiles } from './load.js';

const defs = loadDefinitions();
const STANDALONE = ['inbox.base', 'needs-review.base', 'active-projects.base', 'today.base'];

/** Each related view: the page it sits on, its heading, its Base file and the filter it needs. */
const related = defs.flatMap((d) =>
  Object.entries(d.views).map(([heading, view]) => {
    let match = `${view.via}.contains(this)`;
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
      expect(base.views.map((view) => view.name), v.file).toEqual([v.heading]);
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

  it('every other related view is a table', () => {
    for (const v of related.filter((r) => r.file !== 'project-board.base')) {
      expect(loadBase(`views/${v.file}`).views[0]?.type, v.file).toBe('table');
    }
  });
});
