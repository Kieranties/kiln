import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { obsidianJson, readJson, sameJson } from '../../src/setup/json.js';

const dir = mkdtempSync(join(tmpdir(), 'kiln-json-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('JSON like Obsidian', () => {
  it('reads a file saved by another editor: byte-order mark and CRLF', () => {
    writeFileSync(join(dir, 'app.json'), '\uFEFF{\r\n  "showInlineTitle": false\r\n}\r\n');
    expect(readJson(join(dir, 'app.json'))).toEqual({ showInlineTitle: false });
  });
  it('names a broken file, and treats a missing one as absent', () => {
    writeFileSync(join(dir, 'broken.json'), '{ "a": 1,, }');
    expect(() => readJson(join(dir, 'broken.json'))).toThrow(`${join(dir, 'broken.json')}: not valid JSON: `);
    expect(readJson(join(dir, 'missing.json'))).toBeUndefined();
  });
  it('writes two-space JSON with LF and no final newline', () => {
    expect(obsidianJson({ a: [1, { b: true }] })).toBe('{\n  "a": [\n    1,\n    {\n      "b": true\n    }\n  ]\n}');
  });
  it('compares values, not key order', () => {
    expect(sameJson({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(sameJson([1, 2], [2, 1])).toBe(false);
  });
});
