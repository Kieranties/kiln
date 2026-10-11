/** Common English articles, prepositions, conjunctions and auxiliaries, ignored when comparing titles. */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'nor',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'from',
  'into',
  'about',
  'as',
  'over',
  'under',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'vs',
  'via',
]);

/** Lowercase word tokens of a title: punctuation stripped, apostrophes dropped, stopwords removed. */
export function titleTokens(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t !== '' && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** |a ∩ b| / |a ∪ b|. Two empty sets share no evidence of similarity, so they score 0. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}
