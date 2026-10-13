// A reference page per type, and their index, written from the blueprint's type definitions when the site is built.
import { readRepoBlueprint } from '../../../src/docs/blueprint.js';
import { typeIndex, typePage } from '../../../src/docs/type-page.js';

export default {
  paths() {
    const blueprint = readRepoBlueprint();
    return [
      { params: { type: 'index' }, content: typeIndex(blueprint) },
      ...blueprint.definitions.map((d) => ({ params: { type: d.name }, content: typePage(d, blueprint) })),
    ];
  },
};
