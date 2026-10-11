#!/usr/bin/env bash
# Applies the repo's merge settings and the rulesets in .github/rulesets/ to GitHub.
# Idempotent: a ruleset with the same name is updated, otherwise created.
# Needs gh, authenticated as a repo admin. Usage: scripts/apply-repo-settings.sh [owner/repo]
set -euo pipefail

repo="${1:-Kieranties/kiln}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Merge settings for $repo"
gh api -X PATCH "repos/$repo" --silent \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -F delete_branch_on_merge=true

for file in "$here"/.github/rulesets/*.json; do
  name="$(basename "$file" .json)" # each file's "name" matches its file name
  id="$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")"
  if [[ -n "$id" ]]; then
    echo "Updating ruleset $name ($id)"
    gh api -X PUT "repos/$repo/rulesets/$id" --input "$file" --silent
  else
    echo "Creating ruleset $name"
    gh api -X POST "repos/$repo/rulesets" --input "$file" --silent
  fi
done
