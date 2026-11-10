import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { buildOptions, buildPool, buildRound, normalizeEntry, shuffle } from '../js/game.js';

const entry = (de, pl, context) => normalizeEntry({ de, pl, context });

test('normalizeEntry accepts strings and lists', () => {
  assert.deepEqual(entry('der Hund', 'pies'), {
    de: ['der Hund'], pl: ['pies'], context: '', kind: 'noun',
  });
  assert.deepEqual(entry('gehen', ['iść', 'chodzić'], ' ruch '), {
    de: ['gehen'], pl: ['iść', 'chodzić'], context: 'ruch', kind: 'other',
  });
});

test('normalizeEntry rejects unusable items', () => {
  assert.equal(normalizeEntry({ de: 'der Hund' }), null);
  assert.equal(normalizeEntry({ de: '', pl: 'pies' }), null);
  assert.equal(normalizeEntry({ de: [], pl: 'pies' }), null);
  assert.equal(normalizeEntry(null), null);
  assert.equal(normalizeEntry('der Hund'), null);
});

test('shuffle keeps all items', () => {
  const items = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(shuffle(items).sort(), items);
});

test('buildPool merges topics and drops duplicates', () => {
  const a = { words: [entry('der Hund', 'pies'), entry('die Katze', 'kot')] };
  const b = { words: [entry('der Hund', 'pies'), entry('die Bank', 'bank', 'instytucja')] };
  assert.equal(buildPool([a, b]).length, 3);
});

test('same word with different context is kept twice', () => {
  const t = { words: [entry('die Bank', 'bank', 'instytucja'), entry('die Bank', 'ławka', 'do siedzenia')] };
  assert.equal(buildPool([t]).length, 2);
});

test('buildRound respects the length', () => {
  const pool = Array.from({ length: 30 }, (_, i) => entry(`wort${i}`, `słowo${i}`));
  assert.equal(buildRound(pool, 10).length, 10);
  assert.equal(buildRound(pool, 'all').length, 30);
  assert.equal(buildRound(pool.slice(0, 4), 20).length, 4);
  assert.equal(new Set(buildRound(pool, 20)).size, 20);
});

test('buildOptions returns four unique options including the correct one', () => {
  const pool = ['Hund|pies', 'Katze|kot', 'Kuh|krowa', 'Maus|mysz', 'Ente|kaczka']
    .map((s) => s.split('|'))
    .map(([de, pl]) => entry(`die ${de}`, pl));
  for (let i = 0; i < 50; i++) {
    const options = buildOptions(pool[0], 'pl-de', pool);
    assert.equal(options.length, 4);
    assert.equal(new Set(options).size, 4);
    assert.ok(options.includes('die Hund'));
  }
  const reverse = buildOptions(pool[0], 'de-pl', pool);
  assert.ok(reverse.includes('pies'));
});

test('buildOptions never offers another valid translation of the question', () => {
  const castle = entry('das Schloss', 'zamek', 'budowla');
  const zip = entry('der Reißverschluss', 'zamek', 'w ubraniu');
  const pool = [castle, zip, entry('die Stadt', 'miasto'), entry('der Park', 'park'), entry('das Kino', 'kino')];
  for (let i = 0; i < 50; i++) {
    assert.ok(!buildOptions(castle, 'pl-de', pool).includes('der Reißverschluss'));
  }
  const bank = entry('die Bank', 'bank', 'instytucja');
  const bench = entry('die Bank', 'ławka', 'do siedzenia');
  const pool2 = [bank, bench, ...pool];
  for (let i = 0; i < 50; i++) {
    assert.ok(!buildOptions(bank, 'de-pl', pool2).includes('ławka'));
  }
});

test('buildOptions prefers words of the same kind', () => {
  const nouns = ['Hund', 'Wolf', 'Fuchs', 'Bär'].map((n) => entry(`der ${n}`, n.toLowerCase()));
  const verbs = ['gehen', 'essen', 'lesen', 'sein'].map((v) => entry(v, `${v}-pl`));
  const pool = [...nouns, ...verbs];
  for (let i = 0; i < 50; i++) {
    assert.ok(buildOptions(nouns[0], 'pl-de', pool).every((o) => o.startsWith('der ')));
    assert.ok(buildOptions(verbs[0], 'pl-de', pool).every((o) => !o.startsWith('der ')));
  }
});

test('buildOptions falls back to the extra pool, then to fewer options', () => {
  const small = [entry('der Hund', 'pies'), entry('die Katze', 'kot')];
  const extra = [entry('gehen', 'iść'), entry('essen', 'jeść'), entry('das Haus', 'dom')];
  assert.equal(buildOptions(small[0], 'pl-de', small, extra).length, 4);
  assert.equal(buildOptions(small[0], 'pl-de', small).length, 2);
});

test('bundled vocabulary files are valid and listed in index.json', () => {
  const dir = new URL('../vocab/', import.meta.url);
  const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
  const onDisk = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  assert.deepEqual([...index].sort(), onDisk.sort());
  for (const file of index) {
    const data = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    assert.equal(typeof data.title, 'string', `${file}: title`);
    assert.ok(data.words.length >= 4, `${file}: at least 4 words`);
    for (const word of data.words) {
      assert.ok(normalizeEntry(word), `${file}: bad entry ${JSON.stringify(word)}`);
    }
  }
});
