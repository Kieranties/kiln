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
  it('falls back to reading the definitions without Node, and never writes to notes unasked', () => {
    for (const part of ['node --version', '_kiln/types/', '_kiln/properties.md', 'Obsidian CLI', '<%']) {
      expect(body, part).toContain(part);
    }
  });
  it('finds the vault by rule 1 of the vault rules, which say how to run the resolver', () => {
    const step = body.slice(body.indexOf('## 1. Find the vault'), body.indexOf('## 2.'));
    expect(step).toContain('rule 1 of the vault rules');
    expect(step).toContain('skip to step 2');
    expect(step).not.toContain('kiln-vault.mjs');
    expect(step).not.toContain('"<folder>"');
  });
});
