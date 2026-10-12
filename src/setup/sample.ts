import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { isFolder } from '../vault/paths.js';
import { filesUnder } from './hash.js';
import { isObject } from './json.js';
import type { Fetch, FetchResponse } from './setup.js';

export const REPO = 'Kieranties/kiln';
export const SAMPLE_PATH = 'tests/fixtures/layer1';

/** A sample note: `path` is relative to the sample, with `/`. */
export type SampleFile = { path: string; text: string };

const API = { Accept: 'application/vnd.github+json', 'User-Agent': 'kiln-setup' };
const COMMIT = /^[0-9a-f]{7,40}$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

const byPath = (a: SampleFile, b: SampleFile): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** The answer from `url`, which must be `ok`. A request that fails outright names the URL too. */
async function get(fetch: Fetch, url: string, headers?: Record<string, string>): Promise<FetchResponse> {
  let response: FetchResponse;
  try {
    response = await fetch(url, headers === undefined ? undefined : { headers });
  } catch (error) {
    throw new Error(`can't fetch the sample: ${error instanceof Error ? error.message : String(error)} ${url}`, {
      cause: error,
    });
  }
  if (!response.ok) throw new Error(`can't fetch the sample: ${response.status} ${url}`);
  return response;
}

/** The sample's files under the commit `sha`, as `/` paths in the repo. */
function sampleBlobs(tree: unknown, url: string): string[] {
  if (!isObject(tree) || !Array.isArray(tree.tree)) throw new Error(`can't read the sample's file list: ${url}`);
  if (tree.truncated === true) throw new Error("the sample's file list was cut short");
  const paths: string[] = [];
  for (const entry of tree.tree) {
    if (isObject(entry) && entry.type === 'blob' && typeof entry.path === 'string') {
      if (entry.path.startsWith(`${SAMPLE_PATH}/`)) paths.push(entry.path);
    }
  }
  return paths;
}

/**
 * The Northwind Arena sample, sorted by path. From the plugin's own clone when the repo is next to it
 * (`source` is `local`); otherwise from GitHub at the commit the plugin version names. Everything is
 * fetched before this returns, so a failure leaves nothing half-loaded.
 */
export async function loadSample(pluginRoot: string, fetch: Fetch): Promise<{ source: string; files: SampleFile[] }> {
  const local = join(pluginRoot, '..', ...SAMPLE_PATH.split('/'));
  if (isFolder(local)) {
    // filesUnder sorts by path.
    const files = filesUnder(local).map((path) => ({ path, text: readFileSync(join(local, path), 'utf8') }));
    return { source: 'local', files };
  }

  const version = basename(resolve(pluginRoot));
  if (!COMMIT.test(version)) throw new Error(`can't pin the sample: the plugin version "${version}" isn't a commit`);

  const commitUrl = `https://api.github.com/repos/${REPO}/commits/${version}`;
  const commit: unknown = await (await get(fetch, commitUrl, API)).json();
  const sha = isObject(commit) ? commit.sha : undefined;
  if (typeof sha !== 'string' || !FULL_SHA.test(sha)) throw new Error(`can't read the sample's commit: ${commitUrl}`);

  const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`;
  const paths = sampleBlobs(await (await get(fetch, treeUrl, API)).json(), treeUrl);
  if (paths.length === 0) throw new Error(`there is no sample at ${REPO}@${sha}`);

  const files: SampleFile[] = [];
  for (const path of paths) {
    const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`;
    files.push({ path: path.slice(SAMPLE_PATH.length + 1), text: await (await get(fetch, url)).text() });
  }
  return { source: `github:${REPO}@${sha}`, files: files.sort(byPath) };
}
