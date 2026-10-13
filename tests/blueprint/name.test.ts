import { describe, expect, it } from 'vitest';
import { linkableName, NAME_LIMIT } from '../../src/blueprint/name.js';

const named = (title: string) => linkableName(title);

describe('linkableName', () => {
  it('turns path characters into -', () => {
    expect(named('Collect ticket status from the Northwind/Arena project')).toEqual({
      ok: true,
      name: 'Collect ticket status from the Northwind-Arena project',
    });
    expect(named('Northwind\\Arena')).toEqual({ ok: true, name: 'Northwind-Arena' });
    expect(named('Renewals: the plan')).toEqual({ ok: true, name: 'Renewals- the plan' });
  });

  it('turns link characters into a space, then collapses repeated spaces', () => {
    expect(named('northwind-arena/club-console#88')).toEqual({ ok: true, name: 'northwind-arena-club-console 88' });
    expect(named('Retry #3 [card] ^ref | gate')).toEqual({ ok: true, name: 'Retry 3 card ref gate' });
  });

  it('turns characters Windows refuses into a space, on every platform', () => {
    expect(named('Why *does* "renewal" fail? <again>')).toEqual({ ok: true, name: 'Why does renewal fail again' });
  });

  it('turns control characters into a space', () => {
    expect(named('Gate\tA\r\nnotes\u0000\u001f\u007f\u0085end')).toEqual({ ok: true, name: 'Gate A notes end' });
  });

  it('strips leading dots, and trailing dots and spaces', () => {
    expect(named('.gitignore rules')).toEqual({ ok: true, name: 'gitignore rules' });
    expect(named(' .. hidden. ')).toEqual({ ok: true, name: 'hidden' });
    expect(named('Ask Priya. . .')).toEqual({ ok: true, name: 'Ask Priya' });
    expect(named('v2.1 release notes')).toEqual({ ok: true, name: 'v2.1 release notes' });
  });

  it('refuses a name with nothing left', () => {
    const empty = { ok: false, reason: 'nothing is left once path and link characters are removed' };
    for (const title of ['', '   ', '...', '#?*', ' . | . '])
      expect(named(title), JSON.stringify(title)).toEqual(empty);
  });

  it('refuses a name Windows reserves, in any case and with an extension', () => {
    for (const title of [
      'CON',
      'con',
      'Prn',
      'AUX',
      'nul',
      'COM1',
      'com9',
      'LPT1',
      'lpt9',
      'Con.notes',
      'NUL .txt',
      'Con.',
    ]) {
      expect(named(title), title).toEqual({
        ok: false,
        reason: `"${title.split(/[ .]/)[0]}" is a reserved name on Windows`,
      });
    }
  });

  it('allows a reserved name inside a longer one', () => {
    for (const title of ['Con Edison', 'Console', 'COM0', 'COM10', 'LPT', 'Aux cable', '2026-10-12 Con', 'Icon']) {
      expect(named(title), title).toEqual({ ok: true, name: title });
    }
  });

  describe(`cuts a long name at a word boundary, to ${NAME_LIMIT} characters`, () => {
    const words = (count: number) =>
      Array.from({ length: count }, (_, i) => `w${String(i).padStart(3, '0')}`).join(' ');

    it('keeps a name at the limit', () => {
      const title = 'x'.repeat(NAME_LIMIT);
      expect(named(title)).toEqual({ ok: true, name: title });
    });

    it('cuts before the word that crosses the limit', () => {
      // Each word is 4 characters and a space: 24 words end at 119, the 25th crosses 120.
      expect(named(words(30))).toEqual({ ok: true, name: words(24) });
    });

    it('keeps a word that ends exactly at the limit', () => {
      const title = `${'x'.repeat(NAME_LIMIT - 5)} last more words`;
      expect(named(title)).toEqual({ ok: true, name: `${'x'.repeat(NAME_LIMIT - 5)} last` });
    });

    it('cuts one long word at the limit', () => {
      expect(named('y'.repeat(200))).toEqual({ ok: true, name: 'y'.repeat(NAME_LIMIT) });
    });

    it('strips a trailing dot the cut leaves', () => {
      const title = `${'x'.repeat(NAME_LIMIT - 10)} the end. And then more`;
      expect(named(title)).toEqual({ ok: true, name: `${'x'.repeat(NAME_LIMIT - 10)} the end` });
    });

    it('counts characters, not UTF-16 units, so nothing is split', () => {
      const title = '🎟'.repeat(NAME_LIMIT + 5);
      expect(named(title)).toEqual({ ok: true, name: '🎟'.repeat(NAME_LIMIT) });
    });

    it('refuses a reserved name the cut leaves', () => {
      expect(named(`Con ${'x'.repeat(NAME_LIMIT)}`)).toEqual({
        ok: false,
        reason: '"Con" is a reserved name on Windows',
      });
    });
  });

  it('leaves %% and other punctuation as typed', () => {
    expect(named("Bob's 50%% +1 idea (draft), v2; ok! & more")).toEqual({
      ok: true,
      name: "Bob's 50%% +1 idea (draft), v2; ok! & more",
    });
  });
});
