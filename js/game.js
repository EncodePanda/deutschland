// Round building. No DOM access, so it can be unit tested.

import { normalize, splitArticle } from './check.js';

/** Fisher-Yates shuffle; returns a new array. */
export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function toList(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => typeof v === 'string').map(normalize).filter(Boolean);
}

/**
 * Turn one raw item from a vocabulary file into the internal shape:
 *   { de: [main, ...alternatives], pl: [main, ...alternatives], context, kind }
 * Returns null when the item is unusable (missing German or Polish word).
 */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const de = toList(raw.de);
  const pl = toList(raw.pl);
  if (!de.length || !pl.length) return null;
  const context = typeof raw.context === 'string' ? normalize(raw.context) : '';
  const kind = splitArticle(de[0]).article ? 'noun' : 'other';
  return { de, pl, context, kind };
}

/** Merge the words of several topics, dropping exact duplicates. */
export function buildPool(topics) {
  const seen = new Set();
  const pool = [];
  for (const topic of topics) {
    for (const entry of topic.words) {
      const key = `${entry.de[0]}|${entry.pl[0]}|${entry.context}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(entry);
    }
  }
  return pool;
}

/** Pick the words for one round. length is a number or "all". */
export function buildRound(pool, length, rng = Math.random) {
  const shuffled = shuffle(pool, rng);
  if (length === 'all') return shuffled;
  return shuffled.slice(0, Math.max(1, Math.min(length, shuffled.length)));
}

const overlaps = (a, b) => a.some((x) => b.includes(x));

/**
 * Answers to show in the choice game: the correct one plus up to three wrong ones.
 *
 * A wrong option is never another valid translation of the question word
 * (e.g. "zamek" must not offer both "das Schloss" and "der Reißverschluss"),
 * and words of the same kind (noun with article / everything else) are preferred
 * so the article does not give the answer away.
 *
 * direction is "pl-de" or "de-pl". extraPool is used when the selected
 * vocabulary is too small to supply three wrong options.
 */
export function buildOptions(entry, direction, pool, extraPool = [], rng = Math.random, count = 4) {
  const [from, to] = direction.split('-');
  const correct = entry[to][0];
  const used = new Set([correct]);
  const wrong = [];

  const usable = (other) =>
    other !== entry &&
    !overlaps(other[from], entry[from]) &&
    !overlaps(other[to], entry[to]) &&
    !used.has(other[to][0]);

  const take = (candidates) => {
    for (const other of shuffle(candidates, rng)) {
      if (wrong.length >= count - 1) return;
      if (!usable(other)) continue;
      used.add(other[to][0]);
      wrong.push(other[to][0]);
    }
  };

  const sameKind = (other) => other.kind === entry.kind;
  take(pool.filter(sameKind));
  take(extraPool.filter(sameKind));
  take(pool);
  take(extraPool);

  return shuffle([correct, ...wrong], rng);
}
