'use strict';

const app = document.querySelector('#app');
const libraryKey = 'first-score.library.v1';
const example = 'A gentle classical melody with arpeggios in C major.';
const questions = [
  ['mood', 'How should it feel?', ['Bright', 'Calm', 'Wistful']],
  ['style', 'What style sounds right?', ['Classical', 'Folk', 'Cinematic']],
  ['texture', 'How should the notes move?', ['Flowing melody', 'Arpeggiated']],
];
const inkNotes = [64,67,69,67,71,72,69,67,65,67,64,62,64,67,64,60].map((midi,i)=>({midi,beats:1,bar:Math.floor(i/4)}));
let draft = freshDraft();
let generation = 0;
let playback = null;
let screen = '';

function freshDraft() {
  return {prompt:'', answers:{}, stage:'idea', scores:[], error:'', id:null, favorite:null};
}
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function library() {
  const entries = JSON.parse(localStorage.getItem(libraryKey) || '[]');
  if (!Array.isArray(entries)) throw new Error('Invalid library');
  return entries;
}
function setStatus(message, error = false) {
  const element = document.querySelector('#status');
  if (!element) return;
  element.classList.toggle('error', error);
  element.textContent = message;
}
function route() {
  const [page, id] = (location.hash.slice(1) || 'home').split('/');
  const next = ['create','explore'].includes(page) ? page : 'home';
  stopMusic();
  if (next !== 'create' && draft.stage === 'generating') {
    generation++;
    draft.stage = 'questions';
    draft.scores = [];
  }
  const changed = screen !== next;
  screen = next;
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#'+next) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (next === 'create') renderCreate();
  else if (next === 'explore') renderExplore(id);
  else renderHome();
  if (changed) focusHeading();
}
function focusHeading() {
  const heading = app.querySelector('h1');
  heading.tabIndex = -1;
  heading.focus({preventScroll:true});
}
function renderHome() {
  app.innerHTML = `<section class="hero"><div class="hero-copy">
    <span class="eyebrow">Your music studio</span><h1>Get started creating your first score.</h1>
    <p>Describe a piece of music. Hear two takes on your idea and keep the one you love.</p>
    <a class="button light" href="#create">Create a score</a></div>
    <div class="hero-art">${Music.notation(inkNotes, true)}</div></section>
    <div class="home-cards">
    <a class="card home-card" href="#create"><span class="tile-icon" aria-hidden="true">♪</span><div><h3>Create</h3><p>Turn an idea into sheet music.</p></div></a>
    <a class="card home-card" href="#explore"><span class="tile-icon pink" aria-hidden="true">♬</span><div><h3>Explore</h3><p>Revisit the scores you’ve saved.</p></div></a></div>`;
}
function renderCreate() {
  const {stage, prompt, answers, scores, error} = draft;
  let body = '';
  if (stage === 'idea') {
    body = `<section class="panel"><h2>Blank score</h2><div class="score">${Music.notation()}</div>
      <form id="idea" novalidate><label for="prompt">Describe your music idea</label>
      <textarea id="prompt" name="prompt" rows="3" maxlength="1000" required placeholder="A gentle classical melody…">${escapeText(prompt)}</textarea>
      <p class="examples hint"><button type="button" data-action="example">Try an example</button></p>
      <div class="actions"><button class="button" type="submit">Continue</button></div></form></section>`;
  } else if (stage === 'questions') {
    body = `<section class="panel"><h2>Shape your score</h2><p class="prompt">${escapeText(prompt)}</p>
      <div class="score">${Music.notation()}</div><form id="questions">
      ${questions.map(([name, label, options]) => `<fieldset><legend>${label}</legend><div class="options">
        ${options.map(option => `<label class="option"><input type="radio" name="${name}" value="${option}" ${answers[name] === option ? 'checked' : ''}><span>${option}</span></label>`).join('')}
        <label class="option"><input type="radio" name="${name}" value="" ${!answers[name] ? 'checked' : ''}><span>Leave it open</span></label>
        </div></fieldset>`).join('')}
      <div class="actions"><button class="button" type="submit">${error ? 'Try again' : 'Generate two versions'}</button>
      <button class="button quiet" type="button" data-action="edit">Edit idea</button></div></form></section>`;
  } else {
    const pending = stage === 'generating';
    body = `<section aria-label="Your two versions"><p class="prompt">${escapeText(prompt)}</p>
      <div class="score-grid">${[0,1].map(i => scoreCard(scores[i], i, pending, draft.favorite)).join('')}</div>
      ${pending ? '<div class="actions"><button class="button secondary" data-action="cancel">Cancel</button></div>' :
        '<div class="actions"><button class="button secondary" data-action="new">Create another score</button><a class="button quiet" href="#explore">Explore saved scores</a></div>'}</section>`;
  }
  app.innerHTML = `<div class="studio"><div class="heading"><h1>Create a score</h1>
    <p>${stage === 'results' ? 'Listen to both versions and choose a favorite to save the pair.' : 'Start with an idea, then hear two versions.'}</p>
    </div>${body}<p id="status" class="status" role="status"></p></div>`;
  if (error) setStatus(error, true);
}
function scoreCard(score, index, pending, favorite) {
  return `<article class="panel"><div class="title-row"><h2>Version ${index ? 'B' : 'A'}</h2>
    ${favorite === index ? '<span class="badge">Favorite</span>' : ''}</div>
    <p class="tempo hint" id="tempo-${index}">${score ? score.tempo+' BPM' : 'Waiting to compose'}</p>
    <div class="score" id="score-${index}">${Music.notation(score?.notes)}</div>
    ${pending ? '' : `<div class="actions"><button class="button secondary" data-action="play" data-index="${index}">Play</button>
    ${screen === 'create' && favorite !== index ? `<button class="button" data-action="favorite" data-index="${index}">Choose as favorite</button>` : ''}</div>`}</article>`;
}

let openedEntry;
function renderExplore(id) {
  openedEntry = null;
  let entries;
  try { entries = library(); } catch {
    app.innerHTML = '<div class="heading"><h1>Explore</h1></div><p class="error">Your saved scores couldn’t be opened. Make sure this browser allows local storage, then reload.</p>';
    return;
  }
  const entry = entries.find(item => item.id === id);
  if (entry) {
    openedEntry = entry;
    app.innerHTML = `<a class="button quiet" href="#explore">All saved scores</a><div class="heading">
      <h1>Saved score</h1><p class="prompt">${escapeText(entry.prompt)}</p></div>
      <div class="score-grid">${entry.scores.map((score,i)=>scoreCard(score,i,false,entry.favorite)).join('')}</div>
      <p id="status" class="status" role="status"></p>`;
    return;
  }
  app.innerHTML = `<div class="heading"><h1>Explore</h1><p>Your saved scores, with both versions ready to play.</p></div>
    ${id ? '<p class="error">That score couldn’t be found in this browser.</p>' : ''}
    ${entries.length ? '<div class="library">'+entries.map(item => `<article class="panel"><h3>${escapeText(item.prompt.length > 90 ? item.prompt.slice(0,87)+'…' : item.prompt)}</h3>
      <p class="hint">${escapeText(new Date(item.date).toLocaleDateString())} · Favorite: Version ${item.favorite ? 'B' : 'A'}</p>
      <div class="actions"><a class="button secondary" href="#explore/${encodeURIComponent(item.id)}">Open score</a></div></article>`).join('')+'</div>' :
      '<section class="panel"><h2>Your library is empty</h2><p>Choose a favorite after composing to save both versions here.</p><div class="actions"><a class="button" href="#create">Create a score</a></div></section>'}`;
}

async function generate() {
  const run = ++generation;
  draft.error = '';
  draft.stage = 'generating';
  draft.scores = [];
  renderCreate();
  app.querySelector('[data-action="cancel"]').focus();
  setStatus('Composing Version A…');
  const current = () => generation === run && screen === 'create';
  try {
    const result = await Music.compose(draft.prompt, draft.answers, (i, tempo) => {
      if (!current()) return;
      setStatus('Composing Version '+(i ? 'B' : 'A')+'…');
      draft.scores[i] = {tempo, notes:[]};
      document.querySelector('#tempo-'+i).textContent = tempo+' BPM';
    }, (i, note) => {
      if (!current()) return;
      draft.scores[i].notes.push(note);
      document.querySelector('#score-'+i).innerHTML = Music.notation(draft.scores[i].notes);
    }, current);
    if (!result || !current()) return;
    draft.scores = result;
    draft.stage = 'results';
    renderCreate();
    focusHeading();
    setStatus('Both versions are ready to play.');
  } catch {
    if (!current()) return;
    draft.stage = 'questions';
    draft.scores = [];
    draft.error = 'The music couldn’t be generated. Your idea and answers are still here.';
    renderCreate();
    focusHeading();
  }
}

function stopMusic() {
  if (!playback) return;
  playback.stop();
  playback.button.textContent = 'Play';
  playback = null;
}
function playScore(button, index) {
  const wasPlaying = playback?.button === button;
  stopMusic();
  setStatus('');
  if (wasPlaying) return;
  try {
    const score = (screen === 'create' ? draft : openedEntry).scores[index];
    const stop = Music.play(score, message => {
      stopMusic();
      if (message) setStatus(message, true);
    });
    playback = {stop, button};
    button.textContent = 'Stop';
  } catch (error) {
    setStatus(error.message, true);
  }
}
function save(index) {
  try {
    const id = draft.id || (crypto.randomUUID?.() ?? Date.now().toString(36));
    const entries = library();
    const existing = entries.find(item => item.id === id);
    const entry = {id, prompt:draft.prompt, scores:draft.scores, favorite:index, date:existing?.date ?? Date.now()};
    localStorage.setItem(libraryKey, JSON.stringify([entry, ...entries.filter(item => item.id !== id)]));
    draft.id = id;
    draft.favorite = index;
    stopMusic();
    renderCreate();
    focusHeading();
    setStatus('Saved both versions in Explore. Version '+(index ? 'B' : 'A')+' is your favorite.');
  } catch {
    setStatus('This browser couldn’t save the score. Check that local storage is enabled and try again.', true);
  }
}

app.addEventListener('input', event => {
  if (event.target.id === 'prompt') {
    draft.prompt = event.target.value;
    event.target.removeAttribute('aria-invalid');
    setStatus('');
  }
});
app.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'idea') {
    const input = document.querySelector('#prompt');
    draft.prompt = input.value.trim();
    if (!draft.prompt) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      setStatus('Enter a music idea to continue.', true);
      return;
    }
    draft.stage = 'questions';
    renderCreate();
    focusHeading();
  } else if (event.target.id === 'questions') {
    draft.answers = Object.fromEntries(new FormData(event.target));
    void generate();
  }
});
app.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  switch (button.dataset.action) {
    case 'example': {
      const prompt = document.querySelector('#prompt');
      draft.prompt = prompt.value = example;
      prompt.removeAttribute('aria-invalid');
      setStatus('');
      prompt.focus();
      break;
    }
    case 'edit':
    case 'cancel':
    case 'new':
      stopMusic();
      generation++;
      if (button.dataset.action === 'new') draft = freshDraft();
      else {
        draft.stage = button.dataset.action === 'edit' ? 'idea' : 'questions';
        draft.error = '';
        draft.scores = [];
      }
      renderCreate();
      focusHeading();
      break;
    case 'play': playScore(button, index); break;
    case 'favorite': save(index); break;
  }
});
window.addEventListener('hashchange', route);
route();
