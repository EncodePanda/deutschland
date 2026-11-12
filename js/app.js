// Screens: home -> vocabulary -> game -> result. Nothing is stored between visits.

import { loadTopics } from './vocab.js';
import { buildOptions, buildPool, buildRound, shuffle } from './game.js';
import { checkAnswer, normalize } from './check.js';
import { createSpeaker } from './speech.js';

const app = document.getElementById('app');
const speaker = createSpeaker(window.speechSynthesis, window.SpeechSynthesisUtterance);

const MODES = {
  choice: {
    title: 'Wybierz tłumaczenie',
    desc: 'Zobaczysz słowo i cztery odpowiedzi. Wskaż właściwą.',
    icon: '4',
  },
  type: {
    title: 'Wpisz tłumaczenie',
    desc: 'Zobaczysz słowo i samodzielnie wpiszesz tłumaczenie.',
    icon: 'Aa',
  },
};

const DIRECTIONS = {
  'pl-de': { from: 'polski', to: 'niemiecki', question: 'Jak to jest po niemiecku?', placeholder: 'Wpisz po niemiecku' },
  'de-pl': { from: 'niemiecki', to: 'polski', question: 'Jak to jest po polsku?', placeholder: 'Wpisz po polsku' },
};

const GERMAN_LETTERS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'];
const AUTO_ADVANCE_MS = 900;

// Choices made on the way to a game; kept in memory so "play again" is one click.
const state = {
  topics: [],
  mode: 'choice',
  direction: 'pl-de',
  selected: new Set(),
  length: 10,
  autoSpeak: true, // say the German word aloud after each answer
};

let game = null;

// ---------- helpers ----------

const esc = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function countWords(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return '1 słowo';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} słowa`;
  return `${n} słów`;
}

function show(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

const $ = (selector) => app.querySelector(selector);

// ---------- pronunciation ----------

const ICON_SOUND =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_MUTED =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';

/** A small button that says the German text aloud (see the click handler below). */
const speakButton = (text) =>
  `<button type="button" class="speak" data-speak="${esc(text)}" aria-label="Posłuchaj wymowy" title="Posłuchaj wymowy">${ICON_SOUND}</button>`;

// Speaker buttons are hidden by CSS when this device cannot speak German.
function refreshSpeechSupport() {
  document.documentElement.classList.toggle('no-speech', !speaker.available());
}
refreshSpeechSupport();
speaker.onChange(refreshSpeechSupport);

// Keep the cursor in the answer field (and the phone keyboard up) when a speaker button is pressed.
app.addEventListener('mousedown', (event) => {
  if (event.target.closest('.speak, .sound-toggle')) event.preventDefault();
});
app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-speak]');
  if (button) speaker.speak(button.dataset.speak);
});

// ---------- home ----------

function renderHome() {
  game = null;
  speaker.stop();
  const directionButtons = (mode) =>
    Object.entries(DIRECTIONS)
      .map(
        ([key, d]) => `
        <button class="btn btn-primary" data-mode="${mode}" data-direction="${key}">
          ${d.from} <span class="arrow" aria-hidden="true">→</span><span class="sr-only">na</span> ${d.to}
        </button>`,
      )
      .join('');

  show(`
    <header class="hero">
      <h1>Słówka</h1>
      <p>Ćwicz niemieckie słówka. Wybierz grę i kierunek tłumaczenia.</p>
    </header>
    ${Object.entries(MODES)
      .map(
        ([key, mode]) => `
        <section class="card mode-card">
          <div class="mode-head">
            <div class="mode-icon" aria-hidden="true">${mode.icon}</div>
            <div>
              <h2>${mode.title}</h2>
              <p>${mode.desc}</p>
            </div>
          </div>
          <div class="dir-buttons">${directionButtons(key)}</div>
        </section>`,
      )
      .join('')}
  `);

  app.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      state.direction = button.dataset.direction;
      renderVocabulary();
    });
  });
}

// ---------- vocabulary selection ----------

function renderVocabulary() {
  const direction = DIRECTIONS[state.direction];
  if (state.topics.length === 1) state.selected.add(state.topics[0].id);

  show(`
    <button class="link link-back" id="back">← Wróć</button>
    <header class="hero">
      <h1>Wybierz słówka</h1>
      <p>${MODES[state.mode].title} · ${direction.from} → ${direction.to}</p>
    </header>
    <section class="card">
      <div class="row-between">
        <h2>Tematy</h2>
        <button class="link" id="toggle-all"></button>
      </div>
      <div class="topic-list">
        ${state.topics
          .map(
            (topic) => `
            <label class="topic">
              <input type="checkbox" value="${esc(topic.id)}" ${state.selected.has(topic.id) ? 'checked' : ''}>
              <span class="topic-title">${esc(topic.title)}</span>
              <span class="topic-count">${countWords(topic.words.length)}</span>
            </label>`,
          )
          .join('')}
      </div>
    </section>
    <section class="card">
      <h2>Długość rundy</h2>
      <div class="segmented" role="radiogroup" aria-label="Długość rundy">
        ${[[10, '10 słów'], [20, '20 słów'], ['all', 'Wszystkie']]
          .map(
            ([value, label]) => `
            <label>
              <input type="radio" name="length" value="${value}" ${state.length === value ? 'checked' : ''}>
              <span>${label}</span>
            </label>`,
          )
          .join('')}
      </div>
    </section>
    <div class="start-bar">
      <p class="summary" id="summary" aria-live="polite"></p>
      <button class="btn btn-primary btn-big" id="start">Zaczynamy!</button>
    </div>
  `);

  const checkboxes = [...app.querySelectorAll('.topic input')];
  const toggleAll = $('#toggle-all');

  const refresh = () => {
    const total = buildPool(state.topics.filter((t) => state.selected.has(t.id))).length;
    const inRound = state.length === 'all' ? total : Math.min(state.length, total);
    const allSelected = state.selected.size === state.topics.length;
    toggleAll.textContent = allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie';
    $('#start').disabled = total === 0;
    $('#summary').textContent =
      total === 0
        ? 'Zaznacz przynajmniej jeden temat.'
        : inRound === total
          ? `W rundzie: ${countWords(inRound)}.`
          : `W rundzie: ${countWords(inRound)}, losowo z ${total}.`;
  };

  checkboxes.forEach((box) =>
    box.addEventListener('change', () => {
      if (box.checked) state.selected.add(box.value);
      else state.selected.delete(box.value);
      refresh();
    }),
  );

  toggleAll.addEventListener('click', () => {
    const selectAll = state.selected.size !== state.topics.length;
    state.selected = new Set(selectAll ? state.topics.map((t) => t.id) : []);
    checkboxes.forEach((box) => (box.checked = selectAll));
    refresh();
  });

  app.querySelectorAll('input[name="length"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      state.length = radio.value === 'all' ? 'all' : Number(radio.value);
      refresh();
    }),
  );

  $('#back').addEventListener('click', renderHome);
  $('#start').addEventListener('click', () => startGame());
  refresh();
}

// ---------- game ----------

function startGame(onlyTheseWords) {
  const pool = buildPool(state.topics.filter((t) => state.selected.has(t.id)));
  const round = onlyTheseWords ? shuffle(onlyTheseWords) : buildRound(pool, state.length);
  const [from, to] = state.direction.split('-');
  game = {
    round,
    pool,
    allWords: buildPool(state.topics),
    from,
    to,
    index: 0,
    results: [],
    answered: false,
    timer: null,
  };
  renderGame();
}

function renderGame() {
  const direction = DIRECTIONS[state.direction];
  const letters =
    game.to === 'de'
      ? `<div class="letters" id="letters" aria-label="Niemieckie litery">
          ${GERMAN_LETTERS.map(
            (letter) =>
              `<button type="button" class="letter" data-letter="${letter}" aria-label="Wstaw literę ${letter}">${letter}</button>`,
          ).join('')}
        </div>`
      : '';

  const answerArea =
    state.mode === 'choice'
      ? '<div class="options" id="options"></div>'
      : `<form class="type-form" id="type-form" autocomplete="off" novalidate>
          <label class="sr-only" for="answer-input">Twoja odpowiedź</label>
          <input class="answer-input" id="answer-input" type="text" lang="${game.to}"
            placeholder="${direction.placeholder}" autocomplete="off" autocapitalize="none"
            autocorrect="off" spellcheck="false" enterkeyhint="done">
          ${letters}
          <div class="type-actions" id="type-actions">
            <button type="button" class="btn btn-ghost" id="skip">Nie wiem</button>
            <button type="submit" class="btn btn-primary" id="check">Sprawdź</button>
          </div>
        </form>`;

  show(`
    <div class="game-top">
      <button class="btn-quit" id="quit">✕ Zakończ</button>
      <span class="counter" id="counter"></span>
      <span class="top-right">
        <button type="button" class="sound-toggle" id="sound-toggle"></button>
        <span class="score-pill" id="score" aria-label="Poprawne odpowiedzi">✓ 0</span>
      </span>
    </div>
    <div class="progress" aria-hidden="true"><div class="progress-fill" id="progress"></div></div>
    <section class="card prompt-card">
      <p class="prompt-label">${direction.question}</p>
      <p class="prompt-word"><span id="word" lang="${game.from}"></span><span id="word-speak"></span></p>
      <p class="prompt-context" id="context" hidden></p>
    </section>
    ${answerArea}
    <div class="feedback" id="feedback" role="status" hidden></div>
    <button class="btn btn-primary btn-big" id="next" hidden>Dalej</button>
  `);

  $('#quit').addEventListener('click', () => {
    if (window.confirm('Zakończyć grę? Wynik tej rundy przepadnie.')) {
      clearTimeout(game.timer);
      renderHome();
    }
  });
  $('#next').addEventListener('click', nextQuestion);

  const soundToggle = $('#sound-toggle');
  const paintSoundToggle = () => {
    const label = state.autoSpeak ? 'Wyłącz automatyczną wymowę' : 'Włącz automatyczną wymowę';
    soundToggle.innerHTML = state.autoSpeak ? ICON_SOUND : ICON_MUTED;
    soundToggle.setAttribute('aria-label', label);
    soundToggle.title = label;
    soundToggle.setAttribute('aria-pressed', String(state.autoSpeak));
  };
  soundToggle.addEventListener('click', () => {
    state.autoSpeak = !state.autoSpeak;
    if (!state.autoSpeak) speaker.stop();
    paintSoundToggle();
  });
  paintSoundToggle();

  if (state.mode === 'choice') {
    $('#options').addEventListener('click', (event) => {
      const button = event.target.closest('.option');
      if (button && !game.answered) answerChoice(button);
    });
  } else {
    const input = $('#answer-input');
    $('#type-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (game.answered) nextQuestion();
      else answerTyped(input.value);
    });
    $('#skip').addEventListener('click', () => {
      if (!game.answered) answerTyped('', true);
    });
    // The field stays focused after answering (so the phone keyboard does not
    // jump up and down between words), but must not be editable.
    input.addEventListener('beforeinput', (event) => {
      if (game.answered) event.preventDefault();
    });

    const letterBar = $('#letters');
    if (letterBar) {
      // Keep the cursor in the text field when a letter button is pressed.
      letterBar.addEventListener('mousedown', (event) => event.preventDefault());
      letterBar.addEventListener('click', (event) => {
        const button = event.target.closest('[data-letter]');
        if (!button || game.answered) return;
        input.setRangeText(button.dataset.letter, input.selectionStart, input.selectionEnd, 'end');
        input.focus();
      });
    }
  }

  showQuestion();
}

function showQuestion() {
  const entry = game.round[game.index];
  game.answered = false;

  $('#counter').textContent = `${game.index + 1} / ${game.round.length}`;
  $('#progress').style.width = `${(game.index / game.round.length) * 100}%`;
  $('#word').textContent = entry[game.from][0];
  // A German question may be heard right away; a German answer only once it is revealed.
  $('#word-speak').innerHTML = game.from === 'de' ? speakButton(entry.de[0]) : '';
  const context = $('#context');
  context.textContent = entry.context;
  context.hidden = !entry.context;
  $('#feedback').hidden = true;
  $('#next').hidden = true;

  if (state.mode === 'choice') {
    const options = buildOptions(entry, state.direction, game.pool, game.allWords);
    $('#options').innerHTML = options
      .map(
        (option, i) => `
        <button class="option" data-value="${esc(option)}">
          <span class="option-key" aria-hidden="true">${i + 1}</span>
          <span lang="${game.to}">${esc(option)}</span>
        </button>`,
      )
      .join('');
  } else {
    const input = $('#answer-input');
    input.value = '';
    input.className = 'answer-input';
    $('#type-actions').hidden = false;
    app.querySelectorAll('.letter').forEach((b) => (b.disabled = false));
    input.focus();
  }
}

function answerChoice(button) {
  const entry = game.round[game.index];
  const correct = entry[game.to][0];
  const given = button.dataset.value;
  const isCorrect = given === correct;

  app.querySelectorAll('.option').forEach((option) => {
    option.disabled = true;
    if (option.dataset.value === correct) option.classList.add('is-correct');
  });
  if (!isCorrect) button.classList.add('is-wrong');

  finishQuestion({ status: isCorrect ? 'correct' : 'wrong', given, expected: correct, reason: null });
}

function answerTyped(value, skipped = false) {
  const input = $('#answer-input');
  const entry = game.round[game.index];

  if (!skipped && !normalize(value)) {
    input.classList.remove('shake');
    void input.offsetWidth; // restart the animation
    input.classList.add('shake');
    input.focus();
    return;
  }

  const result = checkAnswer(value, entry[game.to]);
  input.classList.add(`is-${result.status}`);
  $('#type-actions').hidden = true;
  app.querySelectorAll('.letter').forEach((b) => (b.disabled = true));
  finishQuestion({ ...result, given: normalize(value) });
}

function finishQuestion(result) {
  const entry = game.round[game.index];
  game.answered = true;
  game.results.push({ entry, ...result });

  const good = game.results.filter((r) => r.status !== 'wrong').length;
  $('#score').textContent = `✓ ${good}`;
  $('#progress').style.width = `${((game.index + 1) / game.round.length) * 100}%`;

  const feedback = $('#feedback');
  feedback.className = `feedback is-${result.status}`;
  feedback.innerHTML = feedbackHtml(result, entry);
  feedback.hidden = false;

  const spoken = state.autoSpeak ? speaker.speak(entry.de[0]) : Promise.resolve();

  if (result.status === 'correct') {
    // Move on by itself, but not before the word has been said.
    const current = game;
    const index = game.index;
    const pause = new Promise((resolve) => {
      game.timer = setTimeout(resolve, AUTO_ADVANCE_MS);
    });
    Promise.all([pause, spoken]).then(() => {
      if (game === current && game.index === index && game.answered) nextQuestion();
    });
  } else {
    const next = $('#next');
    next.textContent = game.index + 1 === game.round.length ? 'Zobacz wynik' : 'Dalej';
    next.hidden = false;
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function feedbackHtml(result, entry) {
  const lang = game.to;
  const listen = lang === 'de' ? speakButton(result.expected) : '';
  const expected = `<b lang="${lang}">${esc(result.expected)}</b>${listen}`;
  const others = entry[lang].filter((answer) => answer !== result.expected);
  const also = others.length
    ? `<span class="also">Też poprawnie: <span lang="${lang}">${esc(others.join(', '))}</span></span>`
    : '';

  if (result.status === 'correct') return '<strong>✓ Dobrze!</strong>';
  if (result.status === 'case') {
    return `<strong>✓ Dobrze, ale uważaj na wielkie i małe litery.</strong>
      <span>Poprawny zapis: ${expected}</span>`;
  }
  const title =
    result.reason === 'article-missing'
      ? 'Brakuje rodzajnika (der, die, das).'
      : result.reason === 'article-wrong'
        ? 'Zły rodzajnik.'
        : result.given
          ? 'Niestety, nie tym razem.'
          : 'Zapamiętaj to słowo.';
  return `<strong>✗ ${title}</strong><span>Poprawna odpowiedź: ${expected}</span>${also}`;
}

function nextQuestion() {
  if (!game || !game.answered) return;
  clearTimeout(game.timer);
  speaker.stop();
  game.index += 1;
  if (game.index >= game.round.length) renderResult();
  else showQuestion();
}

// Keyboard: 1-4 pick an option, Enter moves on after an answer.
document.addEventListener('keydown', (event) => {
  if (!game || game.finished || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (game.answered) {
    if (event.key === 'Enter') {
      event.preventDefault();
      nextQuestion();
    }
    return;
  }
  if (state.mode === 'choice' && /^[1-4]$/.test(event.key)) {
    const button = app.querySelectorAll('.option')[Number(event.key) - 1];
    if (button) {
      event.preventDefault();
      answerChoice(button);
    }
  }
});

// ---------- result ----------

function resultMessage(percent) {
  if (percent === 100) return 'Perfekcyjnie! Wszystko dobrze.';
  if (percent >= 80) return 'Świetna robota!';
  if (percent >= 50) return 'Nieźle! Jeszcze trochę ćwiczeń.';
  return 'Początki bywają trudne. Spróbuj jeszcze raz!';
}

function renderResult() {
  const { results, from, to } = game;
  game.finished = true;
  const total = results.length;
  const wrong = results.filter((r) => r.status === 'wrong');
  const cased = results.filter((r) => r.status === 'case');
  const good = total - wrong.length;
  const percent = Math.round((good / total) * 100);

  const pair = (r) => `
    <span class="review-pair">
      <span lang="${from}">${esc(r.entry[from][0])}</span>${from === 'de' ? speakButton(r.entry.de[0]) : ''}
      ${r.entry.context ? `<span class="ctx">(${esc(r.entry.context)})</span>` : ''}
      <span class="arrow" aria-hidden="true">→</span>
      <span class="answer" lang="${to}">${esc(r.expected)}</span>${to === 'de' ? speakButton(r.expected) : ''}
    </span>`;

  const wrongList = wrong.length
    ? `<section class="card">
        <h2>Do powtórki (${wrong.length})</h2>
        <ul class="review-list">
          ${wrong
            .map(
              (r) => `<li>${pair(r)}
                <span class="review-given">${
                  r.given ? `Twoja odpowiedź: <s lang="${to}">${esc(r.given)}</s>` : 'Bez odpowiedzi'
                }</span></li>`,
            )
            .join('')}
        </ul>
      </section>`
    : '';

  const caseList = cased.length
    ? `<section class="card">
        <h2>Uwaga na wielkie litery (${cased.length})</h2>
        <ul class="review-list">
          ${cased
            .map(
              (r) => `<li>${pair(r)}
                <span class="review-given">Wpisano: <span lang="${to}">${esc(r.given)}</span> (zaliczone)</span></li>`,
            )
            .join('')}
        </ul>
      </section>`
    : '';

  show(`
    <section class="card result-card">
      <h1 class="sr-only">Wynik</h1>
      <div class="ring" style="--pct: ${percent}" role="img" aria-label="Wynik: ${good} z ${total}, ${percent} procent">
        <div class="ring-inner">
          <span class="ring-score">${good} / ${total}</span>
          <span class="ring-pct">${percent}%</span>
        </div>
      </div>
      <p class="result-message">${resultMessage(percent)}</p>
    </section>
    ${wrongList}
    ${caseList}
    <div class="result-actions">
      <button class="btn btn-primary btn-big" id="home">Strona główna</button>
      ${wrong.length ? `<button class="btn btn-big" id="retry-wrong">Poćwicz błędy (${wrong.length})</button>` : ''}
      <button class="btn btn-big" id="again">Zagraj jeszcze raz</button>
    </div>
  `);

  $('#home').addEventListener('click', renderHome);
  $('#again').addEventListener('click', () => startGame());
  $('#retry-wrong')?.addEventListener('click', () => startGame(wrong.map((r) => r.entry)));
}

// ---------- start ----------

async function init() {
  try {
    state.topics = await loadTopics();
    renderHome();
  } catch (error) {
    console.error(error);
    const local = location.protocol === 'file:';
    show(`
      <section class="card result-card">
        <h1>Nie udało się wczytać słówek</h1>
        <p class="subtitle">${
          local
            ? 'Gra musi być otwarta przez serwer (np. GitHub Pages), a nie bezpośrednio z pliku.'
            : 'Sprawdź połączenie z internetem i spróbuj ponownie.'
        }</p>
        <button class="btn btn-primary" id="reload">Spróbuj ponownie</button>
      </section>
    `);
    $('#reload').addEventListener('click', () => location.reload());
  }
}

init();
