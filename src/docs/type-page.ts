import type { Blueprint, Definition, Naming, PropType, ViewDef } from '../blueprint/load.js';

const NAMING: Record<Naming, string> = {
  title: 'The title',
  date: 'The date, `YYYY-MM-DD`',
  'date-title': 'The date, then the title: `YYYY-MM-DD Title`',
  'source-title': "The source's own title",
};

const PROPERTY: Record<Exclude<PropType, 'links'>, string> = {
  text: 'Text',
  date: 'A date, `YYYY-MM-DD`',
  datetime: 'A date and time, `YYYY-MM-DDTHH:mm`',
  number: 'A number',
  list: 'A list',
};

/** Text for a Markdown table cell: pipes escaped, line breaks flattened. */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const code = (text: string): string => `\`${cell(text)}\``;
const codes = (items: string[]): string => items.map(code).join(', ');

function holds(name: string, type: PropType, blueprint: Blueprint): string {
  if (type !== 'links') return PROPERTY[type];
  const target = blueprint.properties.entries[name]?.links;
  return target ? `Links to ${code(target)} notes` : 'Links';
}

function lists(view: ViewDef): string {
  const notes = `${code(view.type)} notes`;
  if (view.via === 'link') return `${notes} that link to this note`;
  if (view.via === 'created') return `${notes} created on this note's \`date\``;
  if (view.via === 'mtime') return `${notes} changed on this note's \`date\``;
  return `${notes} whose ${code(view.via)} links to this note`;
}

/** The reference page for one type, in Markdown, written from its definition and the property catalogue. */
export function typePage(definition: Definition, blueprint: Blueprint): string {
  const { shared, optional } = blueprint.properties;
  const kinds = Object.entries(definition.kinds);
  const properties = Object.entries(definition.properties);
  const views = Object.entries(definition.views);
  const lines = [
    `# ${definition.name}`,
    '',
    definition.body,
    '',
    '| | |',
    '|---|---|',
    `| Folder | ${code(`${definition.folder}/`)} |`,
    `| File name | ${NAMING[definition.naming]} |`,
    ...(definition.template ? [`| Template | ${code(definition.template)} |`] : []),
    `| Icon | ${definition.icon ? code(definition.icon) : 'None'} |`,
    `| Colour | ${definition.color ? code(definition.color) : 'None'} |`,
    `| Statuses | ${definition.statuses.length ? codes(definition.statuses) : 'None'} |`,
    '',
    '## Kinds',
    '',
    ...(kinds.length
      ? [
          '| Kind | Icon | Colour |',
          '|---|---|---|',
          ...kinds.map(
            ([kind, { icon, color }]) =>
              `| ${code(kind)} | ${icon ? code(icon) : "The type's"} | ${color ? code(color) : "The type's"} |`,
          ),
        ]
      : ['None.']),
    '',
    '## Properties',
    '',
    `Every note has the shared properties, ${codes(shared)}, and may have ${codes(optional)}.`,
    '',
    ...(properties.length
      ? [
          `A ${definition.name} note also has:`,
          '',
          '| Property | Holds |',
          '|---|---|',
          ...properties.map(([name, type]) => `| ${code(name)} | ${holds(name, type, blueprint)} |`),
        ]
      : [`A ${definition.name} note has no properties of its own.`]),
    '',
    '## Sections',
    '',
    ...(definition.sections.length ? definition.sections.map((s, i) => `${i + 1}. ${s}`) : ['None.']),
    ...(definition.last ? ['', `${code(definition.last)} always stays last.`] : []),
    '',
    '## Views',
    '',
    ...(views.length
      ? ['| View | Lists |', '|---|---|', ...views.map(([name, view]) => `| ${cell(name)} | ${lists(view)} |`)]
      : ['None.']),
    '',
    `Written from \`claude-plugin/blueprint/types/${definition.name}.md\`, which a vault holds as \`_kiln/types/${definition.name}.md\`.`,
    '',
  ];
  return lines.join('\n');
}

/** The index of every type's page, in Markdown. */
export function typeIndex(blueprint: Blueprint): string {
  const lead = (body: string): string => cell(body.split(/\r?\n\r?\n/)[0] ?? '');
  return [
    '# Types',
    '',
    "One page per type, written from the blueprint's type definitions when the site is built.",
    '',
    '| Type | Folder | What it is |',
    '|---|---|---|',
    ...blueprint.definitions.map((d) => `| [${d.name}](./${d.name}) | ${code(`${d.folder}/`)} | ${lead(d.body)} |`),
    '',
  ].join('\n');
}
