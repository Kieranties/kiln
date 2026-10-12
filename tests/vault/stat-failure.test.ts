import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sandbox, type Sandbox } from './fixture.js';

const real = await vi.importActual<typeof import('node:fs')>('node:fs');
let blocked = '';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const statSync = ((path: Parameters<typeof actual.statSync>[0], ...rest: unknown[]) => {
    if (blocked !== '' && String(path).startsWith(blocked)) {
      throw Object.assign(new Error(`EPERM: operation not permitted, stat '${String(path)}'`), { code: 'EPERM' });
    }
    return (actual.statSync as (...a: unknown[]) => unknown)(path, ...rest);
  }) as typeof actual.statSync;
  return { ...actual, statSync };
});

const { checkVault } = await import('../../src/vault/find.js');
const { resolveVault } = await import('../../src/vault/resolve.js');

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => {
  blocked = '';
  s.cleanup();
});

describe('stat failures', () => {
  it('make checkVault give a reason, not throw', () => {
    const vault = s.vault('work');
    blocked = vault;
    const check = checkVault(vault, { walkUp: false });
    expect(check).toMatchObject({ ok: false, reason: expect.stringContaining(`${vault} can't be read`) });
  });
  it('make resolveVault stop with a reason, not throw', () => {
    const vault = s.vault('work');
    blocked = vault;
    const result = resolveVault(s.where(), join(vault, 'Work'));
    expect(result).toMatchObject({ vault: null, reasons: [expect.stringContaining("can't be read")] });
    expect(real.existsSync(vault)).toBe(true);
  });
});
