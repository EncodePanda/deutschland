import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeaker, pickGermanVoice } from '../js/speech.js';

const voice = (name, lang, extra = {}) => ({ name, lang, default: false, localService: true, ...extra });

test('no voices or no German voice gives null', () => {
  assert.equal(pickGermanVoice([]), null);
  assert.equal(pickGermanVoice([voice('Zosia', 'pl-PL'), voice('Samantha', 'en-US')]), null);
});

test('a German voice is found among others', () => {
  const anna = voice('Anna', 'de-DE');
  assert.equal(pickGermanVoice([voice('Zosia', 'pl-PL'), anna]), anna);
});

test('de-DE is preferred over other German variants', () => {
  const austrian = voice('Lukas', 'de-AT');
  const german = voice('Anna', 'de-DE');
  assert.equal(pickGermanVoice([austrian, german]), german);
  assert.equal(pickGermanVoice([austrian]), austrian);
});

test('language tags with underscore or other case are understood (Android)', () => {
  const android = voice('Deutsch', 'de_DE');
  assert.equal(pickGermanVoice([voice('Polski', 'pl_PL'), android]), android);
  assert.equal(pickGermanVoice([voice('X', 'DE-de')]).name, 'X');
});

test('a language that merely starts with "de" letters is not German', () => {
  assert.equal(pickGermanVoice([voice('X', 'den')]), null);
});

// ---------- speaker, with a fake speechSynthesis ----------

function fakeSynth(voices) {
  const synth = {
    spoken: [],
    cancelled: 0,
    listeners: {},
    getVoices: () => voices,
    speak(utterance) { synth.spoken.push(utterance); },
    cancel() { synth.cancelled += 1; },
    addEventListener(type, fn) { synth.listeners[type] = fn; },
  };
  return synth;
}

class FakeUtterance {
  constructor(text) { this.text = text; }
}

test('speaker without speech support is unavailable and resolves at once', async () => {
  const speaker = createSpeaker(undefined, undefined);
  assert.equal(speaker.available(), false);
  await speaker.speak('der Hund');
});

test('speaker is unavailable when voices exist but none is German', async () => {
  const synth = fakeSynth([voice('Zosia', 'pl-PL')]);
  const speaker = createSpeaker(synth, FakeUtterance);
  assert.equal(speaker.available(), false);
  await speaker.speak('der Hund');
  assert.equal(synth.spoken.length, 0);
});

test('speaker is available while the voice list is still empty (loads late)', () => {
  const speaker = createSpeaker(fakeSynth([]), FakeUtterance);
  assert.equal(speaker.available(), true);
});

test('speak uses the German voice and resolves when the utterance ends', async () => {
  const anna = voice('Anna', 'de-DE');
  const synth = fakeSynth([voice('Zosia', 'pl-PL'), anna]);
  const speaker = createSpeaker(synth, FakeUtterance);

  let done = false;
  const promise = speaker.speak('die Tür').then(() => { done = true; });
  assert.equal(synth.cancelled, 1, 'anything still playing is stopped first');
  const [utterance] = synth.spoken;
  assert.equal(utterance.text, 'die Tür');
  assert.equal(utterance.lang, 'de-DE');
  assert.equal(utterance.voice, anna);

  await Promise.resolve();
  assert.equal(done, false);
  utterance.onend();
  await promise;
  assert.equal(done, true);
});

test('speak resolves on error too, so the game never gets stuck', async () => {
  const synth = fakeSynth([voice('Anna', 'de-DE')]);
  const speaker = createSpeaker(synth, FakeUtterance);
  const promise = speaker.speak('das Bett');
  synth.spoken[0].onerror();
  await promise;
});

test('speak gives up waiting after the timeout when the browser never reports the end', async () => {
  const synth = fakeSynth([voice('Anna', 'de-DE')]);
  const speaker = createSpeaker(synth, FakeUtterance, { maxWaitMs: 5 });
  await speaker.speak('das Bett');
});

test('onChange fires when the browser loads its voices', () => {
  const synth = fakeSynth([]);
  const speaker = createSpeaker(synth, FakeUtterance);
  let calls = 0;
  speaker.onChange(() => { calls += 1; });
  synth.listeners.voiceschanged();
  assert.equal(calls, 1);
});
