import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runCheck } from '../../src/check/run.js';
import { makeVault } from '../support/vault.js';

const sample = makeVault();
const broken = makeVault({ broken: true });
const outside = mkdtempSync(join(tmpdir(), 'kiln-outside-'));
afterAll(() => {
  for (const d of [sample, broken, outside]) rmSync(d, { recursive: true, force: true });
});

function fingerprint(dir: string): string {
  const hash = createHash('sha256');
  for (const e of readdirSync(dir, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
    const file = join(e.parentPath, e.name);
    hash
      .update(file)
      .update(readFileSync(file))
      .update(String(statSync(file).mtimeMs));
  }
  return hash.digest('hex');
}

describe('runCheck', () => {
  it('passes the whole sample vault', () => {
    expect(runCheck([sample])).toEqual({ output: 'Checked 16 notes: no problems.', exitCode: 0 });
  });

  it('checks only notes changed since midnight with --today', () => {
    const yesterday = new Date(2026, 9, 10, 12, 0);
    for (const e of readdirSync(sample, { recursive: true, withFileTypes: true }).filter((x) => x.isFile())) {
      utimesSync(join(e.parentPath, e.name), yesterday, yesterday);
    }
    const morning = new Date(2026, 9, 11, 8, 0);
    utimesSync(join(sample, 'Work', 'Fix renewal date rollover.md'), morning, morning);
    expect(runCheck(['--today', sample], { now: new Date(2026, 9, 11, 12, 0) }).output).toBe(
      'Checked 1 note: no problems.',
    );
  });

  it('reports errors with exit 1, and carries on past broken YAML', () => {
    const { output, exitCode } = runCheck([broken]);
    expect(exitCode).toBe(1);
    expect(output).toContain('Projects/Broken frontmatter.md\n  error  frontmatter is not valid YAML: ');
    expect(output).toContain('Inbox/Decide the grace period.md\n  error  type is work but the note is in Inbox/');
    expect(output).toMatch(/\n\nChecked 2\d notes: \d+ errors, \d+ warnings\.$/);
  });

  it('warnings alone exit 0', () => {
    expect(runCheck([join(broken, 'Topics', 'Priya Raman.md')]).exitCode).toBe(0);
  });

  it('takes a relative path with spaces and prints it vault-relative with /', () => {
    const { output } = runCheck(['Inbox/Decide the grace period.md'], { cwd: broken });
    expect(output.startsWith('Inbox/Decide the grace period.md\n  error  type is work')).toBe(true);
  });

  it('names paths it cannot check, without throwing', () => {
    writeFileSync(join(outside, 'stray.md'), 'x');
    writeFileSync(join(broken, 'Work', 'notes.txt'), 'x');
    const missing = join(broken, 'Nope.md');
    const stray = join(outside, 'stray.md');
    const txt = join(broken, 'Work', 'notes.txt');
    const { output, exitCode } = runCheck([missing, stray, txt]);
    expect(exitCode).toBe(1);
    expect(output).toContain(`${missing}\n  error  no such note or folder`);
    expect(output).toContain(`${stray}\n  error  not in a kiln vault: no _kiln/types/ folder here or above`);
    expect(output).toContain(`${txt}\n  error  not a note: kiln checks .md files`);
  });

  it('reports a malformed vault definition as an error, not a crash', () => {
    const bad = makeVault();
    writeFileSync(join(bad, '_kiln', 'types', 'work.md'), '---\nname: work\nfolder: Work\nnaming: sideways\n---\nx\n');
    const { output, exitCode } = runCheck([bad]);
    rmSync(bad, { recursive: true, force: true });
    expect(exitCode).toBe(1);
    expect(output).toContain("error  can't read the vault's definitions: types/work.md: naming must be one of");
  });

  it('says how to fix a vault set up from an older blueprint', () => {
    const old = makeVault();
    for (const file of readdirSync(join(old, '_kiln', 'types'))) {
      const path = join(old, '_kiln', 'types', file);
      writeFileSync(path, readFileSync(path, 'utf8').replace(/^naming: .*\n/m, ''));
    }
    const { output, exitCode } = runCheck([join(old, 'Work')]);
    rmSync(old, { recursive: true, force: true });
    expect(exitCode).toBe(1);
    expect(output).toContain(
      "  error  can't read the vault's definitions: types/capture.md: naming must be one of title, date, date-title, source-title" +
        "; if the vault was set up from an older blueprint, copy the current blueprint's types/ and properties.md into its _kiln/",
    );
  });

  it('exits 2 with usage for bad arguments', () => {
    expect(runCheck([]).exitCode).toBe(2);
    expect(runCheck(['--frobnicate', sample])).toMatchObject({
      exitCode: 2,
      output: expect.stringMatching(/^Usage: /),
    });
  });

  it('checks only the notes under a sub-folder argument', () => {
    const count = readdirSync(join(sample, 'Work')).filter((f) => f.endsWith('.md')).length;
    expect(runCheck([join(sample, 'Work')]).output).toBe(`Checked ${count} notes: no problems.`);
  });

  it('checks a note named twice (as a file and via its folder) once', () => {
    const count = readdirSync(join(sample, 'Work')).filter((f) => f.endsWith('.md')).length;
    const note = join(sample, 'Work', 'Fix renewal date rollover.md');
    expect(runCheck([note, join(sample, 'Work')]).output).toBe(`Checked ${count} notes: no problems.`);
  });

  // Windows and macOS file systems ignore letter case, so a path can be typed in any case.
  const ignoresCase = existsSync(join(sample, 'WORK'));
  it.skipIf(!ignoresCase)('takes a path typed in a different letter case as the note or folder it names', () => {
    const count = readdirSync(join(sample, 'Work')).filter((f) => f.endsWith('.md')).length;
    expect(runCheck([join(sample, 'work')]).output).toBe(`Checked ${count} notes: no problems.`);
    expect(runCheck([join(sample, 'work', 'fix renewal date rollover.md')])).toEqual({
      output: 'Checked 1 note: no problems.',
      exitCode: 0,
    });
  });

  it('follows a link to a folder in the vault to the folder itself', () => {
    const count = readdirSync(join(sample, 'Work')).filter((f) => f.endsWith('.md')).length;
    const link = join(outside, 'linked-work');
    symlinkSync(join(sample, 'Work'), link, 'junction');
    expect(runCheck([link]).output).toBe(`Checked ${count} notes: no problems.`);
  });

  it('never writes to the vault', () => {
    const before = fingerprint(broken);
    runCheck(['--new', broken]);
    expect(fingerprint(broken)).toBe(before);
  });
});
