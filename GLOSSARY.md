# kiln

kiln is a personal knowledge and work system built on Obsidian: unshaped things in, finished things out. This glossary is the canonical language for the repo, its docs, its issues and its skills.

## The system

**kiln**:
The whole system: the blueprint, and every plugin and skill that works with it. Never shorthand for one of its parts.

**Claude plugin**:
The Claude Code plugin that carries kiln's skills to Claude, installed from this repo's marketplace.
_Avoid_: kiln plugin, the plugin

**Obsidian plugin**:
A kiln plugin that runs inside Obsidian. None exists yet.
_Avoid_: kiln plugin, the plugin

**Flow**:
One journey through kiln, from a trigger to a result, such as capturing something or triaging the inbox. It is the unit of value kiln is built in.
_Avoid_: workflow, story, layer

## The vault

**Vault**:
A folder of notes that Obsidian opens as one collection. Someone can have more than one, such as work and personal.
_Avoid_: base, knowledge base, KB

**Base**:
An Obsidian Bases file (`.base`) that shows notes as a table, cards or a board. Only ever this Obsidian feature.
_Avoid_: using "base" for a vault

**Blueprint**:
kiln's vault structure: the type definitions, and the templates, views and settings written from them. It is applied to a vault.
_Avoid_: kit

**Sample**:
The fictional Northwind Arena vault that shows the blueprint working.
_Avoid_: layer1, fixture, demo

**Trial vault**:
A throwaway vault that the sample is loaded into.
_Avoid_: test vault

## Notes

**Entity**:
One note about one thing. Every note in a vault is an entity.

**Type**:
The top-level classification of an entity, such as `work`, `person` or `meeting`. It decides the note's folder, template, properties, icon and views.

**Kind**:
An optional narrowing within a type, such as a `bug` within `work`. It can override anything its type decides.
_Avoid_: subtype

**Type definition**:
The blueprint file that defines a type and its kinds. It is the single source of truth that everything else in the blueprint is written from.
_Avoid_: schema
