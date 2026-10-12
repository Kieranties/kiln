import type { Definition, Naming } from '../blueprint/load.js';
import type { Json } from './json.js';

export type KindTemplate = { path: string; text: string };
export type Choice = { id: string; name: string; type: string; [key: string]: Json };

export function isChoice(v: Json | undefined): v is Choice {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.type === 'string'
  );
}

/** The kind picker every type-with-kinds template starts with (a modal, which a headless run can't answer). */
const PICKER = /^<%\* const kind = await tp\.system\.suggester\(.*\) -%>\r?\n/;
const KIND = 'kind: <% kind %>';

export const FILE_NAME: Record<Naming, string> = {
  title: '{{VALUE:title}}',
  'source-title': '{{VALUE:title}}',
  'date-title': '{{DATE:YYYY-MM-DD}} {{VALUE:title}}',
  date: '{{DATE:YYYY-MM-DD}}',
};

const base = (d: Definition) => d.template.replace(/\.md$/, '');
const kindPath = (d: Definition, kind: string) => `_kiln/templates/kinds/${base(d)} ${kind}.md`;

export function kindTemplates(definitions: Definition[], readTemplate: (file: string) => string): KindTemplate[] {
  return definitions.flatMap((d) => {
    const kinds = Object.keys(d.kinds);
    if (kinds.length === 0) return [];
    const text = readTemplate(d.template);
    if (!PICKER.test(text) || !text.includes(KIND)) {
      throw new Error(`templates/${d.template}: expected a kind picker on its first line and "${KIND}"`);
    }
    return kinds.map((kind) => ({
      path: kindPath(d, kind),
      // A function, so a `$` pattern in the kind's name is written as it is.
      text: text.replace(PICKER, '').replace(KIND, () => `kind: ${kind}`),
    }));
  });
}

function templateChoice(id: string, name: string, d: Definition, templatePath: string): Choice {
  return {
    id,
    name,
    type: 'Template',
    command: false,
    templatePath,
    fileNameFormat: { enabled: true, format: FILE_NAME[d.naming] },
    folder: {
      enabled: true,
      folders: [d.folder],
      chooseWhenCreatingNote: false,
      createInSameFolderAsActiveFile: false,
      chooseFromSubfolders: false,
    },
    appendLink: false,
    openFile: false,
    fileOpening: { location: 'tab', direction: 'vertical', mode: 'default', focus: true },
    fileExistsBehavior: { kind: 'apply', mode: 'doNothing' },
  };
}

function walk(choices: Choice[]): Choice[] {
  return choices.flatMap((c) => [c, ...walk(Array.isArray(c.choices) ? c.choices.filter(isChoice) : [])]);
}

function assertUnique(choices: Choice[]): void {
  const all = walk(choices);
  const ids = new Set<string>();
  for (const c of all) {
    if (ids.has(c.id)) throw new Error(`QuickAdd choice id "${c.id}" is used twice`);
    ids.add(c.id);
  }
  const names = new Set<string>();
  for (const c of all) {
    if (names.has(c.name)) throw new Error(`QuickAdd choice name "${c.name}" is used twice`);
    names.add(c.name);
  }
}

/** The generated choices only, in definition order. */
export function kindChoices(definitions: Definition[], blueprintChoices: Choice[]): Choice[] {
  const taken = new Set(walk(blueprintChoices).map((c) => c.id));
  const generated: Choice[] = [];
  for (const d of definitions) {
    const kinds = Object.keys(d.kinds);
    if (kinds.length === 0) {
      const id = `kiln-${d.name}`;
      if (taken.has(id)) continue;
      if (d.template === '') {
        throw new Error(
          `types/${d.name}.md: no template and no kinds, so there is nothing for a QuickAdd choice to use`,
        );
      }
      generated.push(templateChoice(id, `New ${d.name}`, d, `_kiln/templates/${d.template}`));
      continue;
    }
    generated.push({
      id: `kiln-${d.name}-menu`,
      name: `New ${d.name}`,
      type: 'Multi',
      command: false,
      collapsed: true,
      choices: kinds.map((k) => templateChoice(`kiln-${d.name}-${k}`, `New ${k}`, d, kindPath(d, k))),
    });
  }
  assertUnique([...blueprintChoices, ...generated]);
  return generated;
}
