import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, normalize, splitArticle } from '../js/check.js';

test('exact match is correct', () => {
  assert.deepEqual(checkAnswer('der Hund', ['der Hund']), {
    status: 'correct', expected: 'der Hund', reason: null,
  });
});

test('surrounding and repeated spaces are ignored', () => {
  assert.equal(checkAnswer('  der   Hund ', ['der Hund']).status, 'correct');
});

test('small letter instead of capital is accepted with a warning', () => {
  const result = checkAnswer('berlin', ['Berlin']);
  assert.equal(result.status, 'case');
  assert.equal(result.expected, 'Berlin');
});

test('capital letter instead of small is also only a warning', () => {
  assert.equal(checkAnswer('Gehen', ['gehen']).status, 'case');
  assert.equal(checkAnswer('der hund', ['der Hund']).status, 'case');
  assert.equal(checkAnswer('Der Hund', ['der Hund']).status, 'case');
});

test('umlauts differing only by case are a warning', () => {
  assert.equal(checkAnswer('österreich', ['Österreich']).status, 'case');
});

test('missing umlaut or Polish diacritic is wrong', () => {
  assert.equal(checkAnswer('der Bar', ['der Bär']).status, 'wrong');
  assert.equal(checkAnswer('zolw', ['żółw']).status, 'wrong');
  assert.equal(checkAnswer('die Strasse', ['die Straße']).status, 'wrong');
});

test('decomposed umlaut (a + combining dots) equals the composed letter', () => {
  assert.equal(checkAnswer('der Bär', ['der Bär']).status, 'correct');
});

test('missing article is wrong, with a reason', () => {
  const result = checkAnswer('Hund', ['der Hund']);
  assert.equal(result.status, 'wrong');
  assert.equal(result.reason, 'article-missing');
  assert.equal(result.expected, 'der Hund');
});

test('wrong article is wrong, with a reason', () => {
  const result = checkAnswer('die Hund', ['der Hund']);
  assert.equal(result.status, 'wrong');
  assert.equal(result.reason, 'article-wrong');
});

test('article reasons also work when the noun case is off', () => {
  assert.equal(checkAnswer('hund', ['der Hund']).reason, 'article-missing');
});

test('any synonym is accepted and reported as the expected answer', () => {
  const result = checkAnswer('auto', ['samochód', 'auto']);
  assert.equal(result.status, 'correct');
  assert.equal(result.expected, 'auto');
});

test('wrong answer reports the main answer', () => {
  const result = checkAnswer('rower', ['samochód', 'auto']);
  assert.deepEqual(result, { status: 'wrong', expected: 'samochód', reason: null });
});

test('empty answer is wrong without a reason', () => {
  assert.deepEqual(checkAnswer('   ', ['der Hund']), {
    status: 'wrong', expected: 'der Hund', reason: null,
  });
});

test('an exact synonym wins over a case-only match', () => {
  assert.equal(checkAnswer('essen', ['das Essen', 'essen']).status, 'correct');
});

test('normalize and splitArticle helpers', () => {
  assert.equal(normalize('  a  b '), 'a b');
  assert.deepEqual(splitArticle('das Haus'), { article: 'das', rest: 'Haus' });
  assert.deepEqual(splitArticle('gehen'), { article: null, rest: 'gehen' });
  assert.deepEqual(splitArticle('der'), { article: null, rest: 'der' });
});
