import { describe, expect, it } from 'vitest';
import { loadDefinitions, PROP_TYPES, SHARED_PROPERTIES, type Definition } from './load.js';

const TYPES = [
  'organisation',
  'person',
  'product',
  'topic',
  'project',
  'work',
  'research',
  'decision',
  'meeting',
  'daily',
  'reference',
  'capture',
];

function byName(): Map<string, Definition> {
  return new Map(loadDefinitions().map((d) => [d.name, d]));
}

function def(name: string): Definition {
  const d = byName().get(name);
  if (!d) throw new Error(`no definition for ${name}`);
  return d;
}

describe('type definitions', () => {
  it('has exactly the twelve starting types', () => {
    expect([...byName().keys()].sort()).toEqual([...TYPES].sort());
  });

  it('every definition is complete', () => {
    for (const d of loadDefinitions()) {
      expect(d.folder, d.name).toBeTruthy();
      expect(d.template, d.name).toMatch(/^[A-Z][a-z]+\.md$/);
      expect(d.icon, d.name).toMatch(/^lucide-[a-z0-9-]+$/);
      expect(d.color, d.name).toMatch(/^#[0-9a-f]{6}$/);
      if (d.name !== 'capture') expect(d.sections.length, d.name).toBeGreaterThan(0); // a capture is free text
      expect(d.body, d.name).not.toBe('');
      for (const [prop, type] of Object.entries(d.properties)) expect(PROP_TYPES, `${d.name}.${prop}`).toContain(type);
      for (const [kind, o] of Object.entries(d.kinds)) {
        if (o.icon) expect(o.icon, `${d.name}/${kind}`).toMatch(/^lucide-[a-z0-9-]+$/);
        if (o.color) expect(o.color, `${d.name}/${kind}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('folders match the spec', () => {
    expect(TYPES.map((t) => def(t).folder)).toEqual([
      'Organisations',
      'People',
      'Products',
      'Topics',
      'Projects',
      'Work',
      'Research',
      'Decisions',
      'Meetings',
      'Daily',
      'References',
      'Inbox',
    ]);
  });

  it('statuses match the spec', () => {
    const lasting = ['active', 'archived'];
    expect(Object.fromEntries(TYPES.map((t) => [t, def(t).statuses]))).toEqual({
      organisation: lasting,
      person: lasting,
      product: lasting,
      topic: lasting,
      project: ['shaping', 'active', 'closing', 'done', 'abandoned'],
      work: ['backlog', 'active', 'blocked', 'review', 'done', 'abandoned'],
      research: ['open', 'answered'],
      decision: ['proposed', 'accepted', 'superseded'],
      meeting: [],
      daily: [],
      reference: [],
      capture: ['inbox', 'filed'],
    });
  });

  it('kinds match the spec', () => {
    expect(Object.fromEntries(TYPES.map((t) => [t, Object.keys(def(t).kinds)]))).toEqual({
      organisation: ['client', 'vendor', 'partner', 'self'],
      person: [],
      product: ['app', 'service', 'tool', 'platform'],
      topic: [],
      project: [],
      work: ['feature', 'bug', 'chore', 'incident', 'task'],
      research: [],
      decision: [],
      meeting: ['standup', 'workshop'],
      daily: [],
      reference: ['doc', 'thread', 'spec', 'code', 'dashboard', 'post', 'sheet', 'slides', 'video', 'ticket'],
      capture: [],
    });
  });

  it('properties match the spec table', () => {
    expect(Object.fromEntries(TYPES.map((t) => [t, def(t).properties]))).toEqual({
      organisation: { organisations: 'links' },
      person: { role: 'text', email: 'text', organisations: 'links' },
      product: { url: 'text', organisations: 'links' },
      topic: { verified: 'date', topics: 'links', products: 'links' },
      project: { organisations: 'links', products: 'links', people: 'links' },
      work: { jira: 'list', github: 'list', priority: 'text', projects: 'links', products: 'links' },
      research: { question: 'text', topics: 'links', projects: 'links' },
      decision: { decided: 'date', projects: 'links', research: 'links', supersedes: 'links' },
      meeting: { date: 'date', attendees: 'links', projects: 'links', organisations: 'links' },
      daily: { date: 'date' },
      reference: {
        url: 'text',
        author: 'text',
        published: 'date',
        projects: 'links',
        topics: 'links',
        work: 'links',
      },
      capture: { captured: 'datetime', from: 'text', url: 'text' },
    });
  });

  it('sections match the spec table', () => {
    expect(Object.fromEntries(TYPES.map((t) => [t, def(t).sections]))).toEqual({
      organisation: ['Overview', 'Working with them', 'Notes'],
      person: ['About', 'Notes'],
      product: ['Overview', 'Facts', 'Known issues'],
      topic: ['Overview', 'Durable facts', 'Notes'],
      project: ['Goal', 'Current state', 'Scope', 'Done when'],
      work: ['Context', 'Checkpoints', 'Outcome'],
      research: ['Question', 'Brief', 'Findings', 'Sources'],
      decision: ['Context', 'Decision', 'Consequences'],
      meeting: ['Notes', 'My notes', 'Actions', 'Decisions'],
      daily: ['Schedule', 'What changed', 'Scratch', 'Reflection', 'Log'],
      reference: ['Gist', 'Why it matters'],
      capture: [],
    });
  });

  it('views point at real relationships', () => {
    const defs = byName();
    for (const d of defs.values()) {
      for (const [heading, view] of Object.entries(d.views)) {
        const target = defs.get(view.type);
        expect(target, `${d.name}: ${heading}`).toBeDefined();
        if (d.name === 'daily') {
          // The daily note's views match on dates, not relationships.
          expect(['created', 'mtime'], `${d.name}: ${heading}`).toContain(view.via);
        } else if (view.via !== 'link') {
          expect(target?.properties[view.via], `${d.name}: ${heading}`).toBe('links');
        }
      }
    }
  });

  it('shared property names are not redefined', () => {
    for (const d of loadDefinitions()) {
      for (const shared of SHARED_PROPERTIES) expect(Object.keys(d.properties), d.name).not.toContain(shared);
    }
  });
});
