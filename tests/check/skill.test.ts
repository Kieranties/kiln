import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { splitFrontmatter } from '../../src/blueprint/markdown.js';

const PLUGIN = fileURLToPath(new URL('../../claude-plugin/', import.meta.url));
const skill = readFileSync(`${PLUGIN}skills/check/SKILL.md`, 'utf8');
const { frontmatter, body } = splitFrontmatter(skill);
const meta = parse(frontmatter) as { name: string; description: string };

describe('/kiln:check', () => {
  it('is named check, with a description that keeps to kiln work', () => {
    expect(meta.name).toBe('check');
    expect(meta.description).toMatch(/kiln/);
    expect(meta.description.length).toBeLessThanOrEqual(300);
  });
  it('runs the bundled script for the whole vault and for today', () => {
    expect(body).toContain("node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs' '<vault>'");
    expect(body).toContain("node '${CLAUDE_PLUGIN_ROOT}/scripts/kiln-check.mjs' --today '<vault>'");
    expect(existsSync(`${PLUGIN}scripts/kiln-check.mjs`)).toBe(true);
  });
  it('needs Node, pointing to /kiln:setup when it is missing, and never writes to notes unasked', () => {
    for (const part of ['node --version', 'Node 24 or later', '/kiln:setup', '_kiln/types/', 'Obsidian CLI', '<%']) {
      expect(body, part).toContain(part);
    }
    expect(body).not.toContain('check by hand');
  });
  it('lists nested notes and the whole linkable-name rule, and moves notes by rule 4', () => {
    const table = body.slice(body.indexOf('## The rules'));
    for (const part of ["a folder inside its type's folder", '"File names stay linkable"']) {
      expect(table, part).toContain(part);
    }
    // Rule 4 says what to do about a folder a move leaves empty.
    expect(body).toContain('rule 4 of the vault rules');
  });
  it('finds the vault by rule 1 of the vault rules, which say how to run the resolver', () => {
    const step = body.slice(body.indexOf('## 1. Find the vault'), body.indexOf('## 2.'));
    expect(step).toContain('rule 1 of the vault rules');
    expect(step).toContain('skip to step 2');
    expect(step).not.toContain('kiln-vault.mjs');
    expect(step).not.toContain('"<folder>"');
  });
});
