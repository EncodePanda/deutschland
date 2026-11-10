# Implementation plan: Słówka (German ↔ Polish vocabulary game)

Static site for GitHub Pages. Plain HTML, CSS and JavaScript modules, no build step.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Single page; screens are rendered into `#app` |
| `css/style.css` | All styling, light and dark theme, phone-first |
| `js/check.js` | Answer checking: capital-letter warning, articles, synonyms |
| `js/game.js` | Vocabulary normalising, round building, wrong options for the choice game |
| `js/vocab.js` | Loads `vocab/index.json` and the topic files |
| `js/app.js` | Screens: start, vocabulary, game, result |
| `vocab/*.json` | One topic per file, listed in `vocab/index.json` |
| `tests/*.test.js` | Unit tests for `check.js` and `game.js` (`npm test`, Node built-in runner) |

## Steps

1. `check.js` with tests: exact match, case-only difference (accepted with warning),
   missing or wrong article (wrong, with a reason), synonyms, whitespace.
2. `game.js` with tests: entry validation, pool de-duplication, round length,
   choice options (unique, never ambiguous, same word kind preferred).
3. `vocab.js` and five sample topics.
4. `app.js` and `style.css`: the four screens, German letter buttons, keyboard support.
5. Verify in a real browser, then commit.

## Decisions made

- Interface in Polish.
- One attempt per word; a wrong answer shows the correct one.
- Correct answers advance automatically; wrong answers and capital-letter warnings wait for "Dalej".
- "Nie wiem" button in the typing game counts as a wrong answer.
- Result screen offers: home, play again, practise only the mistakes.
- Nothing is stored between visits.
