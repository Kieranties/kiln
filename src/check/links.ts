const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const CODE_SPAN = /`[^`\n]*`/g;
const LINK = /(?<!!)\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

// In a table the pipe before an alias is escaped, `[[Name\|alias]]`, which leaves a `\` on the target.
// A target may also be written with its `.md`, which Obsidian ignores.
const keep = (target: string): string | undefined => {
  const t = target.trim().replace(/\\$/, '').replace(/\.md$/i, '').trim();
  return t === '' || t.includes('/') ? undefined : t;
};

/**
 * Wikilink targets in a note body, in order, without the `|alias`, `#heading` or `.md`.
 * Skips embeds, links in fenced code or code spans, and folder-qualified targets.
 */
export function linkTargets(body: string): string[] {
  const text = body.replace(FENCED, '').replace(CODE_SPAN, '');
  return [...text.matchAll(LINK)].map((m) => keep(m[1] ?? '')).filter((t) => t !== undefined);
}

/** The target of one `"[[...]]"` relationship value, with the same skips as `linkTargets`. */
export function frontmatterLinkTarget(value: string): string | undefined {
  return linkTargets(value)[0];
}

const MAX_DISTANCE = 2;

/**
 * The edit distance between `a` and `b` when it is MAX_DISTANCE or less; otherwise MAX_DISTANCE + 1.
 * Only cells within MAX_DISTANCE of the diagonal can hold such a distance, so only those are worked out,
 * and it stops as soon as a whole row is over.
 */
function distance(a: string, b: string): number {
  const over = MAX_DISTANCE + 1;
  if (Math.abs(a.length - b.length) > MAX_DISTANCE) return over;
  let previous = new Uint8Array(b.length + 1).fill(over);
  let current = new Uint8Array(b.length + 1).fill(over);
  for (let j = 0; j <= Math.min(b.length, MAX_DISTANCE); j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const from = Math.max(1, i - MAX_DISTANCE);
    const to = Math.min(b.length, i + MAX_DISTANCE);
    const ai = a.charCodeAt(i - 1);
    let left = from === 1 ? Math.min(i, over) : over;
    current[from - 1] = left;
    let rowMin = left;
    for (let j = from; j <= to; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const d = Math.min((previous[j] ?? over) + 1, left + 1, (previous[j - 1] ?? over) + cost, over);
      current[j] = d;
      left = d;
      if (d < rowMin) rowMin = d;
    }
    if (rowMin > MAX_DISTANCE) return over;
    const row = previous;
    previous = current;
    current = row;
  }
  return previous[b.length] ?? over;
}

/**
 * A lookup for the candidate nearest a name: the one with the smallest case-insensitive edit distance,
 * if it is 2 or less. Ties go to the first in sorted order. Sorts the candidates once and remembers each answer,
 * so a whole vault's links cost one pass per distinct target.
 */
export function nearestOf(candidates: Iterable<string>): (name: string) => string | undefined {
  const sorted = [...new Set(candidates)].sort().map((candidate) => ({ candidate, lower: candidate.toLowerCase() }));
  const answers = new Map<string, string | undefined>();
  return (name) => {
    const lower = name.toLowerCase();
    if (answers.has(lower)) return answers.get(lower);
    let best: string | undefined;
    let bestDistance = MAX_DISTANCE + 1;
    for (const { candidate, lower: other } of sorted) {
      const d = distance(lower, other);
      if (d < bestDistance) {
        best = candidate;
        bestDistance = d;
        if (d === 0) break;
      }
    }
    answers.set(lower, best);
    return best;
  };
}
