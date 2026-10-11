/**
 * Test helper for the cross-process concurrency tests, run as a child process:
 *
 *   node --import tsx tests/integration/writer.ts <basePath> <noteIdOrPath> <writerName> <count>
 *
 * Appends `count` checkpoints (`- <writerName> #<n>`, n from 1) to the note's Checkpoints section through
 * `Store.updateNote`, the way a session would: it reads the note's revision with `get` before it starts, then guards
 * each append with the revision it last read or wrote. A stale revision (`conflict`) or a held write lock (`busy`)
 * re-reads with `get` and retries after a short random backoff; successful appends are spaced by a similar pause.
 * With `KILN_WRITER_GATE=stdin` it prints `ready` once it has read the note and waits for a line on stdin before
 * writing, so two writers can start together from the same revision. The last stdout line is a JSON report:
 * `{ writer, written, conflicts, busy, revisions }`, where `revisions` lists the revision of every write it made.
 * Exits 0 on success, 1 with a message on stderr on failure.
 */
import { once } from 'node:events';
import { resolve } from 'node:path';
import { Index } from '../../src/index/db.js';
import { Store } from '../../src/store.js';
import { KilnError } from '../../src/types.js';

const MAX_ATTEMPTS = 1_000;
/**
 * Upper bound of the random pauses. Windows timers fire on a ~15.6 ms tick, so a bound under one tick would round every
 * pause to the same tick and lock the two writers in step; 40 ms spreads pauses over several ticks.
 */
const MAX_BACKOFF_MS = 40;

const [basePath, note, writer, countArg] = process.argv.slice(2);
const count = Number(countArg);
if (!basePath || !note || !writer || !Number.isInteger(count) || count < 0) {
  console.error('usage: writer.ts <basePath> <noteIdOrPath> <writerName> <count>');
  process.exit(2);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const index = Index.open({ name: 'writer', path: resolve(basePath) });
let conflicts = 0;
let busy = 0;
const revisions: string[] = [];

try {
  const store = new Store(index.base, index);
  let revision = index.get(note).revision;
  if (process.env.KILN_WRITER_GATE === 'stdin') {
    console.log('ready');
    await once(process.stdin, 'data');
    process.stdin.destroy();
  }

  for (let n = 1; n <= count; n++) {
    const text = `- ${writer} #${n}`;
    for (let attempt = 1; ; attempt++) {
      try {
        revision = store.updateNote({
          idOrPath: note,
          ifRevision: revision,
          sections: [{ heading: 'Checkpoints', mode: 'append', text }],
        }).revision;
        revisions.push(revision);
        // A pause between appends, as a session has: without it this process re-takes the write lock before the
        // other writer's busy handler wakes, and the two runs of appends never interleave.
        await sleep(Math.random() * MAX_BACKOFF_MS);
        break;
      } catch (e) {
        const retryable = e instanceof KilnError && (e.code === 'conflict' || e.code === 'busy');
        if (!retryable || attempt >= MAX_ATTEMPTS) throw e;
        if (e.code === 'conflict') conflicts++;
        else busy++;
        await sleep(Math.random() * MAX_BACKOFF_MS);
        revision = index.get(note).revision;
      }
    }
  }

  console.log(JSON.stringify({ writer, written: revisions.length, conflicts, busy, revisions }));
} catch (e) {
  const detail =
    e instanceof KilnError
      ? `${e.code}: ${e.message} ${JSON.stringify(e.details ?? null)}`
      : e instanceof Error
        ? (e.stack ?? e.message)
        : String(e);
  console.error(
    `writer ${writer} failed after ${revisions.length} of ${count} appends (conflicts ${conflicts}, busy ${busy}): ${detail}`,
  );
  process.exitCode = 1;
} finally {
  index.close();
}
