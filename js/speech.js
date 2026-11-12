// German pronunciation using the browser's built-in speech (Web Speech API).
// Nothing is touched at import time, so this can be unit tested without a browser.

const isGerman = (lang) => /^de([-_]|$)/i.test(String(lang ?? ''));
const isGermany = (lang) => /^de[-_]de$/i.test(String(lang ?? ''));

/** The best German voice in the list (de-DE first), or null when there is none. */
export function pickGermanVoice(voices) {
  const german = [...(voices ?? [])].filter((voice) => isGerman(voice.lang));
  return german.find((voice) => isGermany(voice.lang)) ?? german[0] ?? null;
}

/**
 * synth      window.speechSynthesis (or undefined when the browser has none)
 * Utterance  window.SpeechSynthesisUtterance
 */
export function createSpeaker(synth, Utterance, { maxWaitMs = 6000 } = {}) {
  const supported = Boolean(synth && Utterance);
  const voices = () => (supported ? synth.getVoices() ?? [] : []);

  return {
    /**
     * False when the browser cannot speak, or has voices but no German one.
     * An empty voice list counts as available: many browsers fill it in late,
     * and some phones speak German fine without ever listing a voice.
     */
    available() {
      if (!supported) return false;
      const list = voices();
      return list.length === 0 || pickGermanVoice(list) !== null;
    },

    /** Calls fn when the browser's voice list changes (it often loads late). */
    onChange(fn) {
      if (supported && synth.addEventListener) synth.addEventListener('voiceschanged', fn);
    },

    /** Stops anything still playing. */
    stop() {
      if (supported) synth.cancel();
    },

    /**
     * Says the text in German. The promise resolves when it has been said,
     * failed, or was stopped; it never rejects and never hangs.
     */
    speak(text) {
      if (!this.available() || !text) return Promise.resolve();
      return new Promise((resolve) => {
        const utterance = new Utterance(text);
        const voice = pickGermanVoice(voices());
        utterance.lang = voice ? voice.lang.replace('_', '-') : 'de-DE';
        if (voice) utterance.voice = voice;
        utterance.rate = 0.9; // a little slower, for learners

        const timer = setTimeout(resolve, maxWaitMs);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        utterance.onend = done;
        utterance.onerror = done;

        try {
          synth.cancel();
          synth.speak(utterance);
        } catch {
          done();
        }
      });
    },
  };
}
