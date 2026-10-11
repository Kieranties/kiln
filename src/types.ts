export type NoteType = 'anchor' | 'project' | 'work' | 'decision' | 'reference' | 'source' | 'note';

export type Fields = Record<string, unknown>;

/** A knowledge base root. `path` is absolute. */
export type Base = { name: string; path: string };

export type KilnErrorCode = 'validation' | 'conflict' | 'busy' | 'not_found' | 'locked_file' | 'no_base';

export class KilnError extends Error {
  readonly code: KilnErrorCode;
  readonly details?: unknown;

  constructor(code: KilnErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'KilnError';
    this.code = code;
    this.details = details;
  }
}

export type ValidationIssue = { field: string; message: string; hint: string };

export type WriteResult = { id: string | null; path: string; revision: string; created: boolean };
