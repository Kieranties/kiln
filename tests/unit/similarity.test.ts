import { describe, it, expect } from 'vitest';
import { titleTokens, jaccard } from '../../src/similarity.js';

describe('titleTokens', () => {
  it('ignores stopwords and punctuation', () => {
    expect([...titleTokens('The Gate-Scanner: a plan, for the badges!')].sort()).toEqual([
      'badges',
      'gate',
      'plan',
      'scanner',
    ]);
  });

  it('lowercases and de-duplicates', () => {
    expect(titleTokens('Badge BADGE badge')).toEqual(new Set(['badge']));
  });

  it('keeps digits and non-ASCII letters, and drops apostrophes inside words', () => {
    expect(titleTokens("Q3 café don’t can't")).toEqual(new Set(['q3', 'café', 'dont', 'cant']));
  });

  it('returns an empty set for empty or all-stopword titles', () => {
    expect(titleTokens('').size).toBe(0);
    expect(titleTokens('The of and').size).toBe(0);
  });
});

describe('jaccard', () => {
  it('of identical titles is 1 and disjoint is 0', () => {
    expect(jaccard(titleTokens('Gate scanner plan'), titleTokens('plan: gate scanner'))).toBe(1);
    expect(jaccard(titleTokens('Gate scanner'), titleTokens('Catering budget'))).toBe(0);
  });

  it('is intersection over union', () => {
    expect(jaccard(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd']))).toBe(0.5);
  });

  it('is 0 when both sets are empty', () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});
