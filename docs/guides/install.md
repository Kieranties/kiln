# Install, update and turn off

kiln reaches Claude through one Claude plugin, `kiln`, from this repo's marketplace. It carries the blueprint, kiln's skills and the rules every kiln skill follows in a vault. The commands are the same in Bash and PowerShell.

## Install

Install it once, for your user (the default), so it reaches every Claude Code session in any folder:

```
claude plugin marketplace add Kieranties/kiln
claude plugin install kiln@kiln
```

[Claudian](https://github.com/YishenTu/claudian), which `/kiln:setup` installs in your vault, runs your own Claude Code inside Obsidian, so it loads the Claude plugin too, as long as its **Load user Claude Code settings** switch is on (the default). Enabling kiln in a vault's `.claude/settings.json` isn't a substitute: it only turns on a plugin that is already installed, Claude Code ignores it in a folder you haven't trusted, and it reaches only that folder.

To try a branch, add the marketplace at that branch instead: `claude plugin marketplace add Kieranties/kiln#some-branch`.

Then [set up your vault](./getting-started.md).

## Update

Refresh the catalog, then update the Claude plugin:

```
claude plugin marketplace update kiln
claude plugin update kiln@kiln
```

The new version loads in your next session, or after `/reload-plugins`. Then run `/kiln:setup` to re-apply the blueprint to your vault, so the vault's types, templates, views and settings match the new version.

Auto-update is off by default for marketplaces outside Anthropic's own. You can turn it on for `kiln` in `/plugin`, under **Marketplaces**, but it only runs in interactive sessions. Claudian never auto-updates, so if you mostly use Claudian, update from a terminal now and then.

## Turn it off in one repo

kiln's skills show in every session. In a repo where they are noise, run this in the repo:

```
claude plugin disable kiln@kiln --scope local
```

It writes `"kiln@kiln": false` to the repo's `.claude/settings.local.json`, which applies only to you and only there. `claude plugin enable kiln@kiln --scope local` turns it back on.

## Companion skills

kepano's [Obsidian skills](https://github.com/kepano/obsidian-skills) teach Claude the Obsidian CLI (`obsidian-cli`) and Obsidian's Markdown (`obsidian-markdown`), among others. kiln's skills work without them. To add them:

```
claude plugin marketplace add kepano/obsidian-skills
claude plugin install obsidian@obsidian-skills
```

## The blueprint on its own

Each release on GitHub also carries the blueprint as `kiln-blueprint-<version>.zip`, for reading or applying by hand. [The blueprint reference](../reference/blueprint.md#setting-up-a-vault) has the steps.
