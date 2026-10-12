/** A JSON value: what `JSON.parse` gives, and what Obsidian and its plugins store. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
