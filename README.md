# Słówka

A small game for learning German vocabulary, made for Polish speakers.
It is a static site: no server, no database, nothing stored between visits.

## Games

- **Wybierz tłumaczenie**: a word is shown with four answers to choose from.
- **Wpisz tłumaczenie**: a word is shown and the translation is typed in.
  Buttons for ä, ö, ü, ß, Ä, Ö, Ü appear when the answer is German.

Both work in either direction (Polish → German, German → Polish).

Pronunciation: the German word is read aloud after each answer, and speaker
buttons replay it. This uses the voice built into the browser, so there are no
audio files; on a device without a German voice the buttons are hidden. The
speaker icon at the top of the game turns the automatic reading off.

Typing rules:

- A wrong capital or small letter (`berlin` for `Berlin`) is accepted with a warning.
- The article is part of the answer: `Hund` or `die Hund` for `der Hund` is wrong.
- Extra spaces are ignored. Umlauts and Polish letters must be correct.

## Adding vocabulary

1. Add a file to `vocab/`, for example `vocab/ubrania.json`:

   ```json
   {
     "title": "Ubrania",
     "words": [
       { "de": "die Hose", "pl": "spodnie" },
       { "de": "das Schloss", "pl": "zamek", "context": "budowla" },
       { "de": "das Auto", "pl": ["samochód", "auto"] }
     ]
   }
   ```

   - `de` and `pl` are required. Write German nouns with their article.
   - `context` is optional. It is shown next to the question word to tell apart
     words with several meanings.
   - `de` or `pl` may be a list when several answers are correct. The first one is
     shown in the game; any of them is accepted when typing.

2. Add the file name to `vocab/index.json`.

3. Run `npm test` to check the file, then commit and push.

## Running locally

```sh
npm start        # serves the site at http://localhost:8000
npm test         # unit tests (Node 20 or newer, no dependencies to install)
```

Opening `index.html` directly from disk does not work, because browsers block
loading the vocabulary files that way.

## Publishing on GitHub Pages

1. Create an empty repository on GitHub and push this one to it:

   ```sh
   git remote add origin https://github.com/<user>/<repository>.git
   git push -u origin main
   ```

2. On GitHub open **Settings → Pages**, choose **Deploy from a branch**,
   branch **main**, folder **/ (root)**, and save.

3. After a minute the game is live at `https://<user>.github.io/<repository>/`.
   Every later push updates it.
