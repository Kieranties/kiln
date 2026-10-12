import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runVault } from '../../src/vault/run.js';
import { sandbox, type Sandbox } from './fixture.js';

let s: Sandbox;
beforeEach(() => {
  s = sandbox();
});
afterEach(() => s.cleanup());

describe('runVault', () => {
  it('prints the vault as JSON and exits 0', () => {
    const work = s.vault('work');
    const { output, exitCode } = runVault([join(work, 'Work')], s.where());
    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({ vault: work, source: 'explicit' });
  });
  it('prints the candidates and reasons and exits 1 when there is no vault', () => {
    const { output, exitCode } = runVault([], s.where());
    expect(exitCode).toBe(1);
    expect(JSON.parse(output)).toMatchObject({ vault: null, candidates: [], reasons: expect.any(Array) });
  });
  it('exits 2 with usage for bad arguments', () => {
    for (const argv of [['--help'], ['--frobnicate'], ['a', 'b'], ['  ']]) {
      expect(runVault(argv, s.where()), argv.join(' ')).toMatchObject({
        exitCode: 2,
        output: expect.stringMatching(/^Usage: /),
      });
    }
  });
});
