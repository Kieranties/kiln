const FENCED = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const CODE_SPAN = /`[^`\n]*`/g;
const LINK = /(?<!!)\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;

const keep = (target: string): string | undefined => {
  const t = target.trim();
  return t === '' || t.includes('/') ? undefined : t;
};

/**
 * Wikilink targets in a note body, in order, without the `|alias` or `#heading`.
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

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** The candidate with the smallest case-insensitive edit distance, if it is 2 or less. Ties go to the first in sorted order. */
export function nearest(name: string, candidates: Iterable<string>): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of [...candidates].sort()) {
    const d = distance(lower, candidate.toLowerCase());
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best;
}
