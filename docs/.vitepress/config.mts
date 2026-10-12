// The docs site: docs/ built with VitePress and published to GitHub Pages on each merge to main.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type DefaultTheme } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import { readDefinitions } from '../../src/blueprint/load.js';

const DOCS = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = fileURLToPath(new URL('../../claude-plugin/blueprint/', import.meta.url));

/** A sidebar entry for every page in a docs folder, titled by its first heading, in file name order. */
function pagesIn(folder: string): DefaultTheme.SidebarItem[] {
  return readdirSync(`${DOCS}${folder}`)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const title = /^# (.+)$/m.exec(readFileSync(`${DOCS}${folder}/${f}`, 'utf8'))?.[1] ?? f;
      // Sidebar text is HTML: drop code ticks and escape `<host>`-style placeholders.
      const text = title.replace(/`/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return { text, link: `/${folder}/${f.replace(/\.md$/, '')}` };
    });
}

export default withMermaid(
  defineConfig({
    title: 'kiln',
    description: 'A personal knowledge and work system built on Obsidian: unshaped things in, finished things out.',
    base: '/kiln/',
    cleanUrls: true,
    lastUpdated: true,
    // docs/agents/ is for the engineering skills, not readers.
    srcExclude: ['agents/**'],
    themeConfig: {
      nav: [
        { text: 'Use kiln', link: '/guides/getting-started' },
        { text: 'Inside kiln', link: '/concepts/vision' },
      ],
      sidebar: [
        {
          text: 'Use kiln',
          items: [
            { text: 'Install, update and turn off', link: '/guides/install' },
            { text: 'Getting started', link: '/guides/getting-started' },
            { text: 'Try the sample', link: '/guides/try-the-sample' },
          ],
        },
        {
          text: 'Inside kiln',
          items: [
            {
              text: 'Concepts',
              items: [
                { text: 'Vision', link: '/concepts/vision' },
                { text: 'How notes are shaped', link: '/concepts/notes' },
                { text: 'Claude in the vault', link: '/concepts/claude-in-the-vault' },
                { text: 'Finding the vault', link: '/concepts/finding-the-vault' },
                { text: 'Setting up and re-applying', link: '/concepts/setup' },
              ],
            },
            {
              text: 'Reference',
              items: [
                { text: 'The blueprint', link: '/reference/blueprint' },
                {
                  text: 'Types',
                  link: '/reference/types/',
                  collapsed: true,
                  items: readDefinitions(BLUEPRINT).map((d) => ({ text: d.name, link: `/reference/types/${d.name}` })),
                },
                { text: 'Skills', link: '/reference/skills' },
                { text: 'Vault rules', link: '/reference/vault-rules' },
                { text: 'Configuration', link: '/reference/configuration' },
                { text: 'The repo', link: '/reference/repo' },
              ],
            },
            { text: 'Glossary', link: '/glossary' },
            { text: 'Decisions', collapsed: true, items: pagesIn('adr') },
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
