import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { applySetup, planSetup } from '../../src/setup/setup.js';
import { cleanupAll, pluginCopy, testVault } from './fixture.js';

afterAll(cleanupAll);

describe('re-applying a changed blueprint', () => {
  it('sorts every case three ways', async () => {
    const t = testVault();
    await applySetup(t.options({ pluginRoot: pluginCopy('a1b2c3d4e5f6') }));
    t.write('_kiln/templates/Topic.md', 'my topic template\n');
    t.write('_kiln/views/today.base', 'my today\n');
    t.write(
      '_kiln/types/runbook.md',
      '---\ntype: kiln-type\nname: runbook\nfolder: Runbooks\nnaming: title\n---\nA how-to.\n',
    );
    // Project has no kinds, so its template has no picker to keep.
    const next = pluginCopy('0f9e8d7c6b5a', (bp) => {
      writeFileSync(join(bp, 'templates', 'Project.md'), 'new project template\n');
      writeFileSync(join(bp, 'views', 'today.base'), 'new today\n');
      writeFileSync(join(bp, 'views', 'new-view.base'), 'filters: {}\n');
      rmSync(join(bp, 'views', 'inbox.base'));
    });
    const plan = planSetup(t.options({ pluginRoot: next }));
    const action = (path: string) => plan.files.find((f) => f.path === path);
    expect(action('_kiln/templates/Project.md')).toEqual({ path: '_kiln/templates/Project.md', action: 'update' });
    expect(action('_kiln/templates/Topic.md')).toEqual({ path: '_kiln/templates/Topic.md', action: 'keep' });
    expect(action('_kiln/views/today.base')).toEqual({ path: '_kiln/views/today.base', action: 'ask' });
    expect(action('_kiln/views/new-view.base')).toEqual({ path: '_kiln/views/new-view.base', action: 'add' });
    expect(action('_kiln/views/inbox.base')).toEqual({
      path: '_kiln/views/inbox.base',
      action: 'dropped',
      usedBy: ['Home.md'],
    });
    expect(plan.asks).toEqual([{ id: '_kiln/views/today.base', current: 'my today\n', blueprint: 'new today\n' }]);
    expect(plan.vaultOnlyTypes).toEqual(['runbook']);

    await applySetup(t.options({ pluginRoot: next }));
    expect(t.read('_kiln/views/today.base')).toBe('my today\n');
    expect(t.read('_kiln/views/inbox.base')).not.toBe('');
    expect(t.json('.kiln/blueprint.json')).toMatchObject({ plugin: '0f9e8d7c6b5a' });
    // The owner's two edits stay theirs, and nothing is asked again; the dropped view is reported once.
    expect(planSetup(t.options({ pluginRoot: next }))).toMatchObject({
      asks: [],
      files: [
        { path: '_kiln/templates/Topic.md', action: 'keep' },
        { path: '_kiln/views/today.base', action: 'keep' },
      ],
    });
  });

  it('with Obsidian open, changes only _kiln/, Iconic and Templater, and the rest waits', async () => {
    const t = testVault();
    await applySetup(t.options({ pluginRoot: pluginCopy('a1b2c3d4e5f6') }));
    const next = pluginCopy('0f9e8d7c6b5a', (bp) => {
      writeFileSync(join(bp, 'templates', 'Project.md'), 'new project template\n');
      writeFileSync(join(bp, 'root', 'Home.md'), 'new home\n');
    });
    t.write('.obsidian/app.json', '{}');
    const open = await applySetup(t.options({ pluginRoot: next, obsidianRunning: true }));
    expect(open.stop).toEqual([]);
    expect(open.files).toEqual([
      { path: 'Home.md', action: 'wait' },
      { path: '_kiln/templates/Project.md', action: 'update' },
    ]);
    const app = open.settings.filter((s) => s.file === '.obsidian/app.json');
    expect(app.length).toBeGreaterThan(0);
    expect(app.every((s) => s.action === 'wait')).toBe(true);
    expect(t.read('_kiln/templates/Project.md')).toBe('new project template\n');
    expect(t.read('Home.md')).not.toBe('new home\n');

    const closed = await applySetup(t.options({ pluginRoot: next }));
    expect(closed.files).toEqual([{ path: 'Home.md', action: 'update' }]);
    expect(t.read('Home.md')).toBe('new home\n');
  });

  it('a vault set up by hand, with no record: _kiln/ is the blueprint’s, Home.md is asked about', async () => {
    const t = testVault();
    await applySetup(t.options());
    rmSync(join(t.vault, '.kiln'), { recursive: true });
    t.write('_kiln/types/work.md', 'an older definition\n');
    t.write('Home.md', 'edited home\n');
    const plan = planSetup(t.options());
    expect(plan.files).toEqual(
      expect.arrayContaining([
        {
          path: '_kiln/types/work.md',
          action: 'replace',
          backup: '.kiln/backup/2026-10-12T09-30-00/_kiln/types/work.md',
        },
        { path: 'Home.md', action: 'ask' },
      ]),
    );
    const before = readFileSync(join(t.vault, '_kiln', 'types', 'work.md'));
    const applied = await applySetup(t.options());
    expect(applied.backups).toContain('.kiln/backup/2026-10-12T09-30-00/_kiln/types/work.md');
    expect(readFileSync(join(t.vault, '.kiln', 'backup', '2026-10-12T09-30-00', '_kiln', 'types', 'work.md'))).toEqual(
      before,
    );
  });

  it('a file kept earlier, then taken while it waits, stays kept until Obsidian closes', async () => {
    const t = testVault();
    t.write('Home.md', 'My own home.\n');
    await applySetup(t.options());
    const open = await applySetup(t.options({ obsidianRunning: true, take: ['Home.md'] }));
    expect(open.files).toEqual([{ path: 'Home.md', action: 'wait' }]);
    expect(open.warnings).not.toContain('--take Home.md matched nothing');
    expect(t.read('Home.md')).toBe('My own home.\n');
    expect(planSetup(t.options())).toMatchObject({ asks: [], files: [{ path: 'Home.md', action: 'keep' }] });
  });

  it("with Obsidian maybe running, a re-apply waits as if it's open, and says so", async () => {
    const t = testVault();
    await applySetup(t.options({ pluginRoot: pluginCopy('a1b2c3d4e5f6') }));
    const next = pluginCopy('0f9e8d7c6b5a', (bp) => {
      writeFileSync(join(bp, 'root', 'Home.md'), 'new home\n');
    });
    const plan = planSetup(t.options({ pluginRoot: next, obsidianRunning: null }));
    expect(plan.stop).toEqual([]);
    expect(plan.files).toEqual([{ path: 'Home.md', action: 'wait' }]);
    expect(plan.warnings).toContain(
      'Obsidian may be running, so only _kiln/, Iconic and Templater are changed. The rest waits: close Obsidian and run setup again.',
    );
    expect(plan.warnings.some((w) => w.startsWith('Obsidian is running'))).toBe(false);
  });

  it('keeps the kiln choices and icon rules of a vault-only type, and names other kiln ones it removes', async () => {
    const t = testVault();
    await applySetup(t.options());
    t.write(
      '_kiln/types/runbook.md',
      '---\ntype: kiln-type\nname: runbook\nfolder: Runbooks\nnaming: title\n---\nA how-to.\n',
    );
    const quickadd = t.json('.obsidian/plugins/quickadd/data.json') as { choices: unknown[] };
    const runbook = { id: 'kiln-runbook', name: 'New runbook', type: 'Template' };
    quickadd.choices.push(runbook, { id: 'kiln-retired', name: 'Retired', type: 'Template' });
    t.write('.obsidian/plugins/quickadd/data.json', JSON.stringify(quickadd));
    const iconic = t.json('.obsidian/plugins/iconic/data.json') as { fileRules: unknown[] };
    iconic.fileRules.push({ id: 'kiln-runbook', name: 'Runbook' });
    t.write('.obsidian/plugins/iconic/data.json', JSON.stringify(iconic));

    const report = await applySetup(t.options());
    expect(report.vaultOnlyTypes).toEqual(['runbook']);
    expect(report.warnings).toContain(
      '.obsidian/plugins/quickadd/data.json: kiln choices the blueprint no longer makes are removed: kiln-retired',
    );
    expect((t.json('.obsidian/plugins/quickadd/data.json') as { choices: unknown[] }).choices).toContainEqual(runbook);
    expect((t.json('.obsidian/plugins/iconic/data.json') as { fileRules: unknown[] }).fileRules).toContainEqual({
      id: 'kiln-runbook',
      name: 'Runbook',
    });
  });

  it("a vault-only type named like a blueprint choice doesn't make it multiply", async () => {
    const t = testVault();
    await applySetup(t.options());
    t.write('_kiln/types/log.md', '---\ntype: kiln-type\nname: log\nfolder: Logs\nnaming: date\n---\nA log.\n');
    for (let run = 0; run < 3; run++) await applySetup(t.options());
    const ids = (t.json('.obsidian/plugins/quickadd/data.json') as { choices: { id: string }[] }).choices.map(
      (c) => c.id,
    );
    expect(ids.filter((id) => id === 'kiln-log')).toHaveLength(1);
    expect(planSetup(t.options()).settings).toEqual([]);
  });

  it('with Obsidian open, what the owner kept in a waiting file stays kept', async () => {
    const t = testVault();
    t.write('.obsidian/app.json', '{\n  "newFileFolderPath": "Notes"\n}');
    await applySetup(t.options());
    await applySetup(t.options({ obsidianRunning: true }));
    expect(planSetup(t.options()).asks).toEqual([]);
    expect(t.json('.obsidian/app.json')).toMatchObject({ newFileFolderPath: 'Notes' });
  });

  it('leaves a file the owner deleted deleted, and puts it back only when taken', async () => {
    const t = testVault();
    await applySetup(t.options());
    rmSync(join(t.vault, '_kiln', 'views', 'today.base'));
    const report = await applySetup(t.options());
    expect(report.files).toEqual([{ path: '_kiln/views/today.base', action: 'deleted' }]);
    expect(existsSync(join(t.vault, '_kiln', 'views', 'today.base'))).toBe(false);
    // Still recorded, so the next run doesn't take it for a new file.
    expect(planSetup(t.options()).files).toEqual([{ path: '_kiln/views/today.base', action: 'deleted' }]);

    const taken = await applySetup(t.options({ take: ['_kiln/views/today.base'] }));
    expect(taken.files).toEqual([{ path: '_kiln/views/today.base', action: 'add' }]);
    expect(taken.warnings).toEqual([]);
    expect(existsSync(join(t.vault, '_kiln', 'views', 'today.base'))).toBe(true);
    expect(planSetup(t.options()).files).toEqual([]);
  });

  it("leaves the owner's right sidebar as they left it", async () => {
    const t = testVault();
    await applySetup(t.options());
    const workspace = t.json('.obsidian/workspace.json') as {
      right: { collapsed: boolean; children: { currentTab: number }[] };
    };
    expect(workspace.right).toMatchObject({ collapsed: false, children: [{ currentTab: 1 }] });
    workspace.right.collapsed = true;
    const group = workspace.right.children[0];
    if (group !== undefined) group.currentTab = 0;
    const text = JSON.stringify(workspace, null, 2);
    t.write('.obsidian/workspace.json', text);
    const again = await applySetup(t.options());
    expect(again.settings).toEqual([]);
    expect(t.read('.obsidian/workspace.json')).toBe(text);
  });

  it('reads a copy saved with CRLF endings as unchanged', async () => {
    const t = testVault();
    await applySetup(t.options());
    const lf = t.read('_kiln/types/work.md').replaceAll('\r\n', '\n');
    t.write('_kiln/types/work.md', lf.replaceAll('\n', '\r\n'));
    expect(planSetup(t.options()).files).toEqual([]);
  });
});
