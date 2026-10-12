// The docs site: docs/ built with VitePress and published to GitHub Pages, at kiln.kieranties.com, on each merge to main.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type DefaultTheme } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { REPO_BLUEPRINT, readRepoBlueprint } from '../../src/docs/blueprint.js';

const DOCS = fileURLToPath(new URL('../', import.meta.url));
const CONFIG = fileURLToPath(import.meta.url);

/** A sidebar entry for a page, titled by its first heading. `path` is relative to docs/, without `.md`. */
function page(path: string): DefaultTheme.SidebarItem {
  const title = /^# (.+)$/m.exec(readFileSync(join(DOCS, `${path}.md`), 'utf8'))?.[1] ?? path;
  // Sidebar text is HTML: drop code ticks and escape `<host>`-style placeholders.
  const text = title.replace(/`/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return { text, link: `/${path}` };
}

/** Sidebar entries for the named pages of a docs folder, in that order, or for all of them by file name. */
function pages(folder: string, names?: string[]): DefaultTheme.SidebarItem[] {
  const all = readdirSync(join(DOCS, folder))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
  return (names ?? all).map((name) => page(`${folder}/${name}`));
}

export default withMermaid(
  defineConfig({
    title: 'kiln',
    description: 'A personal knowledge and work system built on Obsidian: unshaped things in, finished things out.',
    // Served from the root of its own domain, kiln.kieranties.com.
    base: '/',
    cleanUrls: true,
    lastUpdated: true,
    // docs/agents/ is for the engineering skills, not readers.
    srcExclude: ['agents/**'],
    vite: {
      // Mermaid 11's CommonJS dependencies (fastdom among them) need bundling for `docs:dev`; the plugin
      // only lists older ones.
      optimizeDeps: { include: ['mermaid'] },
      plugins: [
        {
          // In `docs:dev`, a change to a type definition or properties.md restarts the server, as a config change
          // does, so the type pages and the sidebar follow. A build always reads them afresh.
          name: 'kiln:restart-on-blueprint-change',
          configureServer(server) {
            const slashes = (file: string) => file.replace(/\\/g, '/');
            const watched = [join(REPO_BLUEPRINT, 'types'), join(REPO_BLUEPRINT, 'properties.md')];
            server.watcher.add(watched);
            server.watcher.on('change', (file) => {
              if (watched.some((path) => slashes(file).startsWith(slashes(path)))) {
                server.watcher.emit('change', slashes(CONFIG));
              }
            });
          },
        },
      ],
    },
    themeConfig: {
      nav: [
        { text: 'Use kiln', link: '/guides/getting-started' },
        { text: 'Inside kiln', link: '/concepts/vision' },
      ],
      sidebar: [
        { text: 'Use kiln', items: pages('guides', ['install', 'getting-started', 'try-the-sample']) },
        {
          text: 'Inside kiln',
          items: [
            {
              text: 'Concepts',
              items: pages('concepts', ['vision', 'notes', 'claude-in-the-vault', 'finding-the-vault', 'setup']),
            },
            {
              text: 'Reference',
              items: [
                page('reference/blueprint'),
                {
                  text: 'Types',
                  link: '/reference/types/',
                  collapsed: true,
                  items: readRepoBlueprint().definitions.map((d) => ({
                    text: d.name,
                    link: `/reference/types/${d.name}`,
                  })),
                },
                ...pages('reference', ['skills', 'vault-rules', 'configuration', 'repo']),
              ],
            },
            page('glossary'),
            { text: 'Decisions', collapsed: true, items: pages('adr') },
          ],
        },
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/Kieranties/kiln' }],
      editLink: {
        pattern: 'https://github.com/Kieranties/kiln/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },
      search: { provider: 'local' },
      outline: [2, 3],
    },
  }),
);
