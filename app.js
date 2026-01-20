'use strict';

/* ------------------------------- State -------------------------------- */
const state = {
  data: Array.isArray(window.DATA) ? window.DATA.slice() : [],
  idx: 0,
  hideMeaning: false,
  hideExamples: false,
  known: new Set()
};

/* ------------------------------- DOM ---------------------------------- */
const dom = {
  word: document.getElementById('word'),
  meaning: document.getElementById('meaning'),
  examples: document.getElementById('examples'),
  counter: document.getElementById('counter'),

  prevBtn: document.getElementById('prevBtn'),
  randomBtn: document.getElementById('randomBtn'),
  nextBtn: document.getElementById('nextBtn'),

  hideMeaningBtn: document.getElementById('hideMeaningBtn'),
  hideExamplesBtn: document.getElementById('hideExamplesBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),

  markKnownBtn: document.getElementById('markKnownBtn'),
  resetKnownBtn: document.getElementById('resetKnownBtn'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),

  playAudioBtn: document.getElementById('playAudioBtn'),
  audioStatus: document.getElementById('audioStatus'),

  speakBtn: document.getElementById('speakBtn'),
  speechStatus: document.getElementById('speechStatus'),

  menuBtn: document.getElementById('menuBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  themeSelect: document.getElementById('themeSelect'),
  fontSize: document.getElementById('fontSize'),

  category: document.getElementById('category')
};

/* --------------------------- Rendering -------------------------------- */
function render() {
  if (!state.data.length) {
    dom.word.textContent = 'No data';
    dom.meaning.textContent = '';
    dom.examples.innerHTML = '';
    dom.counter.textContent = '0 / 0';
    return;
  }

  if (state.idx < 0 || state.idx >= state.data.length) state.idx = 0;

  const item = state.data[state.idx];
  const isKnown = state.known.has(item.word);

  dom.word.textContent = item.word || '';
  dom.meaning.textContent = state.hideMeaning ? '••••••••' : item.meaning || '';
  dom.examples.innerHTML = '';

  if (!state.hideExamples && Array.isArray(item.examples)) {
    item.examples.forEach(ex => {
      const li = document.createElement('li');
      li.textContent = ex;
      li.style.cursor = 'pointer';
      li.title = 'Tap to hear pronunciation';

      li.addEventListener('click', () => {
        speakText(ex);
        li.classList.add('speaking');
        setTimeout(() => li.classList.remove('speaking'), 600);
      });

      dom.examples.appendChild(li);
    });
  }

  dom.counter.textContent = `${state.idx + 1} / ${state.data.length}`;
  dom.audioStatus.textContent = 'Audio: ready';

  if (dom.category) dom.category.textContent = item.category || '';

  document.body.classList.toggle('known-word', isKnown);
}

/* ---------------------------- Navigation ------------------------------ */
function next() {
  state.idx = (state.idx + 1) % state.data.length;
  render();
}
function prev() {
  state.idx = (state.idx - 1 + state.data.length) % state.data.length;
  render();
}
function random() {
  state.idx = Math.floor(Math.random() * state.data.length);
  render();
}

/* ------------------------------ Shuffle ------------------------------- */
function shuffle() {
  for (let i = state.data.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.data[i], state.data[j]] = [state.data[j], state.data[i]];
  }
  state.idx = 0;
  render();
}

/* ------------------------------ Toggles ------------------------------- */
function toggleMeaning() {
  state.hideMeaning = !state.hideMeaning;
  render();
}
function toggleExamples() {
  state.hideExamples = !state.hideExamples;
  render();
}

/* ------------------------- Known & Progress --------------------------- */
function restoreKnown() {
  try {
    const saved = JSON.parse(localStorage.getItem('knownWords') || '[]');
    state.known = new Set(saved);
  } catch {
    state.known = new Set();
  }
}

function updateProgress() {
  if (!dom.progressBar || !dom.progressText) return;
  const pct = Math.round((state.known.size / state.data.length) * 100);
  dom.progressBar.style.width = `${pct}%`;
  dom.progressText.textContent = `${state.known.size} known`;
}

function markKnown() {
  const item = state.data[state.idx];
  if (!item) return;
  state.known.add(item.word);
  localStorage.setItem('knownWords', JSON.stringify([...state.known]));
  updateProgress();
}

function resetKnown() {
  state.known.clear();
  localStorage.removeItem('knownWords');
  updateProgress();
}

/* ------------------------- Text-to-Speech ----------------------------- */
let ttsVoice = null;

function loadTTSVoice() {
  const voices = speechSynthesis.getVoices();
  ttsVoice =
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0];
}

speechSynthesis.onvoiceschanged = loadTTSVoice;

function speakWord(word) {
  if (!word) return;
  if (!ttsVoice) loadTTSVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.voice = ttsVoice;
  u.lang = 'en-US';
  u.rate = 0.9;
  u.pitch = 1;
  u.onstart = () => dom.audioStatus.textContent = 'Audio: speaking';
  u.onend = () => dom.audioStatus.textContent = 'Audio: ready';
  speechSynthesis.speak(u);
}

function speakText(text) {
  if (!text) return;
  if (!ttsVoice) loadTTSVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = ttsVoice;
  u.lang = 'en-US';
  u.rate = 0.95;
  u.pitch = 1;
  u.onstart = () => dom.audioStatus && (dom.audioStatus.textContent = 'Audio: speaking');
  u.onend = () => dom.audioStatus && (dom.audioStatus.textContent = 'Audio: ready');
  speechSynthesis.speak(u);
}

/* ---------------------- Speech Recognition ---------------------------- */
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (window.SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.addEventListener('result', (event) => {
    const spoken = event.results[0][0].transcript.trim().toLowerCase();
    const currentWord = state.data[state.idx].word.toLowerCase();

    if (spoken === currentWord) {
      dom.speechStatus.textContent = `✅ Correct! You said: "${spoken}"`;
      state.known.add(state.data[state.idx].word);
      updateProgress();
    } else {
      dom.speechStatus.textContent = `❌ Try again. You said: "${spoken}"`;
    }

    listening = false;
    dom.speakBtn.textContent = '🎤 Speak Word';

    // Keep feedback visible for 2.5s
    setTimeout(() => {
      dom.speechStatus.textContent = 'Say the word!';
    }, 3000);
  });

  recognition.addEventListener('end', () => {
    listening = false;
    dom.speakBtn.textContent = '🎤 Speak Word';
  });

  dom.speakBtn?.addEventListener('click', () => {
    if (!listening) {
      recognition.start();
      listening = true;
      dom.speechStatus.textContent = 'Listening... 🎧';
      dom.speakBtn.textContent = '🛑 Stop Listening';
    } else {
      recognition.stop();
      listening = false;
      dom.speakBtn.textContent = '🎤 Speak Word';
      dom.speechStatus.textContent = 'Stopped';
    }
  });
} else {
  dom.speakBtn?.addEventListener('click', () => {
    alert("Speech recognition not supported in this browser.");
  });
}

/* ------------------------- Theme & Font ------------------------------- */
function applyTheme(theme) {
  document.documentElement.classList.remove('dark', 'amoled');
  if (theme === 'dark') document.documentElement.classList.add('dark');
  if (theme === 'amoled') document.documentElement.classList.add('amoled');
  localStorage.setItem('theme', theme);
}

function restoreTheme() {
  const theme = localStorage.getItem('theme') || 'light';
  applyTheme(theme);
  if (dom.themeSelect) dom.themeSelect.value = theme;
}

function applyFontSize(size) {
  document.documentElement.style.setProperty('--base-font', `${size}px`);
  localStorage.setItem('fontSize', size);
}

function restoreFont() {
  const size = Number(localStorage.getItem('fontSize') || 18);
  if (dom.fontSize) dom.fontSize.value = size;
  applyFontSize(size);
}

/* ------------------------------ Boot --------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  if (state.data.length) state.idx = Math.floor(Math.random() * state.data.length);

  restoreKnown();
  restoreTheme();
  restoreFont();

  dom.nextBtn?.addEventListener('click', next);
  dom.prevBtn?.addEventListener('click', prev);
  dom.randomBtn?.addEventListener('click', random);

  dom.hideMeaningBtn?.addEventListener('click', toggleMeaning);
  dom.hideExamplesBtn?.addEventListener('click', toggleExamples);
  dom.shuffleBtn?.addEventListener('click', shuffle);

  dom.markKnownBtn?.addEventListener('click', markKnown);
  dom.resetKnownBtn?.addEventListener('click', resetKnown);

  dom.playAudioBtn?.addEventListener('click', () => {
    const item = state.data[state.idx];
    speakWord(item.word);
  });

  dom.menuBtn && dom.settingsDialog &&
    dom.menuBtn.addEventListener('click', () => dom.settingsDialog.showModal());

  dom.themeSelect?.addEventListener('change', e => applyTheme(e.target.value));
  dom.fontSize?.addEventListener('input', e => applyFontSize(e.target.value));

  render();
  updateProgress();
});
