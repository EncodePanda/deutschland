// Answer checking for the typing game. No DOM access, so it can be unit tested.

const ARTICLES = ['der', 'die', 'das'];

/** Trim, collapse inner whitespace and unify Unicode form (ä typed vs. composed). */
export function normalize(text) {
  return String(text ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

const lower = (text) => text.toLocaleLowerCase('de');

/** "der Hund" -> { article: "der", rest: "Hund" }; "gehen" -> { article: null, rest: "gehen" } */
export function splitArticle(text) {
  const space = text.indexOf(' ');
  if (space > 0) {
    const first = lower(text.slice(0, space));
    if (ARTICLES.includes(first)) {
      return { article: first, rest: text.slice(space + 1) };
    }
  }
  return { article: null, rest: text };
}

/**
 * Compare what the student typed with the list of accepted answers.
 *
 * Returns { status, expected, reason }:
 *   status   "correct"  exact match
 *            "case"     matches except for capital/small letters: accepted, but warn
 *            "wrong"
 *   expected the accepted answer that matched, or the main answer when wrong
 *   reason   for wrong answers only: "article-missing" | "article-wrong" | null
 */
export function checkAnswer(input, accepted) {
  const typed = normalize(input);
  const answers = accepted.map(normalize).filter(Boolean);

  const exact = answers.find((a) => a === typed);
  if (exact) return { status: 'correct', expected: exact, reason: null };

  const typedLower = lower(typed);
  const caseOnly = answers.find((a) => lower(a) === typedLower);
  if (typed && caseOnly) return { status: 'case', expected: caseOnly, reason: null };

  let reason = null;
  if (typed) {
    const typedParts = splitArticle(typed);
    for (const answer of answers) {
      const parts = splitArticle(answer);
      if (!parts.article) continue;
      if (lower(parts.rest) !== lower(typedParts.rest)) continue;
      reason = typedParts.article ? 'article-wrong' : 'article-missing';
      return { status: 'wrong', expected: answer, reason };
    }
  }
  return { status: 'wrong', expected: answers[0] ?? '', reason };
}
