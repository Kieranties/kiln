// Applies the repo's merge settings and the rulesets in .github/rulesets/ to GitHub.
// Idempotent: a ruleset with the same name is updated, otherwise created.
// Needs gh, authenticated as a repo admin. Runs the same from Bash and pwsh:
//   node scripts/apply-repo-settings.mjs [owner/repo]
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = process.argv[2] ?? 'Kieranties/kiln';
const RULESETS = fileURLToPath(new URL('../.github/rulesets/', import.meta.url));

/** Runs gh with these arguments and returns what it prints. */
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

console.log(`Merge settings for ${repo}`);
gh(
  'api',
  '-X',
  'PATCH',
  `repos/${repo}`,
  '--silent',
  '-F',
  'allow_squash_merge=true',
  '-F',
  'allow_merge_commit=false',
  '-F',
  'allow_rebase_merge=false',
  '-f',
  'squash_merge_commit_title=PR_TITLE',
  '-f',
  'squash_merge_commit_message=PR_BODY',
  '-F',
  'delete_branch_on_merge=true',
);

const existing = JSON.parse(gh('api', `repos/${repo}/rulesets`));
for (const file of readdirSync(RULESETS).filter((f) => f.endsWith('.json'))) {
  const name = basename(file, '.json'); // each file's "name" matches its file name
  const path = join(RULESETS, file);
  const id = existing.find((r) => r.name === name)?.id;
  if (id) {
    console.log(`Updating ruleset ${name} (${id})`);
    gh('api', '-X', 'PUT', `repos/${repo}/rulesets/${id}`, '--input', path, '--silent');
  } else {
    console.log(`Creating ruleset ${name}`);
    gh('api', '-X', 'POST', `repos/${repo}/rulesets`, '--input', path, '--silent');
  }
}
