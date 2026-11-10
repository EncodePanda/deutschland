// Loads the vocabulary topics listed in vocab/index.json.

import { normalizeEntry } from './game.js';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/**
 * Returns [{ id, title, words }] in the order of index.json.
 * A broken topic file is skipped (with a console warning) so one typo
 * does not take the whole game down. Throws when nothing could be loaded.
 */
export async function loadTopics(base = 'vocab/') {
  const files = await fetchJson(`${base}index.json`);
  if (!Array.isArray(files)) throw new Error('vocab/index.json must be a list of file names');

  const loaded = await Promise.all(
    files.map(async (file) => {
      try {
        const data = await fetchJson(base + file);
        const words = (Array.isArray(data.words) ? data.words : [])
          .map(normalizeEntry)
          .filter(Boolean);
        if (!words.length) throw new Error('no usable words');
        const title = typeof data.title === 'string' && data.title.trim()
          ? data.title.trim()
          : file.replace(/\.json$/i, '');
        return { id: file, title, words };
      } catch (error) {
        console.warn(`Skipping vocabulary file "${file}":`, error);
        return null;
      }
    }),
  );

  const topics = loaded.filter(Boolean);
  if (!topics.length) throw new Error('No vocabulary could be loaded');
  return topics;
}
