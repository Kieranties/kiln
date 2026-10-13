import { fileURLToPath } from 'node:url';
import { readBlueprint, type Blueprint } from '../blueprint/load.js';

/** The blueprint in this repo, which the docs site and the tests read. */
export const REPO_BLUEPRINT = fileURLToPath(new URL('../../claude-plugin/blueprint/', import.meta.url));

export const readRepoBlueprint = (): Blueprint => readBlueprint(REPO_BLUEPRINT);
