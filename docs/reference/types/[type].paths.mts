// A reference page per type, and their index, written from the blueprint's type definitions when the site is built.
import { fileURLToPath } from 'node:url';
import { readBlueprint } from '../../../src/blueprint/load.js';
import { typeIndex, typePage } from '../../../src/docs/type-page.js';

const BLUEPRINT = fileURLToPath(new URL('../../../claude-plugin/blueprint/', import.meta.url));

export default {
  paths() {
    const blueprint = readBlueprint(BLUEPRINT);
    return [
      { params: { type: 'index' }, content: typeIndex(blueprint) },
      ...blueprint.definitions.map((d) => ({ params: { type: d.name }, content: typePage(d, blueprint) })),
    ];
  },
};
