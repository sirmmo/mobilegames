import { Match3 } from '../shared/match3.js';
import { store, toast, dialog, formatTime, registerSW } from '../shared/util.js';

registerSW('../sw.js');

const MODES = {
  classic: { name: 'Classic', desc: 'Reach the target score before you run out of moves.', input: 'swap', levels: true },
  blitz: { name: 'Blitz', desc: '90 seconds. Score as much as you can.', input: 'swap', time: 90 },
  zen: { name: 'Zen', desc: 'No moves limit, no clock. Just play.', input: 'swap' },
  shift: { name: 'Shift', desc: 'Drag whole rows and columns to line up gems.', input: 'slide', levels: true },
};

const MASKS = [
  null,
  ['..####..', '.######.', '########', '########', '########', '########', '.######.', '..####..'],
  ['########', '########', '###..###', '##....##', '##....##', '###..###', '########', '########'],
  ['##.##.##', '########', '########', '.######.', '.######.', '########', '########', '##.##.##'],
  ['########', '#.####.#', '########', '###..###', '###..###', '########', '#.####.#', '########'],
];

function levelConfig(mode, n) {
  if (mode === 'shift') {
    return { colors: n < 4 ? 5 : 6, moves: 16 + Math.min(8, Math.floor(n / 2)), target: 1100 + (n - 1) * 650, mask: null };
  }
  return {
    colors: n < 3 ? 5 : n < 12 ? 6 : 7,
    moves: 20 + Math.min(10, Math.floor(n / 2)),
    target: 900 + (n - 1) * 450,
    mask: MASKS[(n - 1) % MASKS.length],
  };
}

const $ = (id) => document.getElementById(id);
const stage = $('stage');

const params = new URLSearchParams(location.search);
let mode = MODES[params.get('mode')] ? params.get('mode') : store.get('gems:mode', 'classic');

let engine = null;
let state = {};
let timerId = 0;

function render() {
  const m = MODES[mode];
  $('title').textContent = `Gemfall · ${m.name}`;
  $('score').textContent = state.score.toLocaleString();
  $('levelStat').hidden = !m.levels;
  $('targetStat').hidden = !m.levels;
  $('progressWrap').hidden = !m.levels;
  $('level').textContent = state.level;
  $('target').textContent = (state.target || 0).toLocaleString();
  if (m.levels) {
    $('limitLabel').textContent = 'Moves';
    $('limit').textContent = state.moves;
    $('progress').style.width = Math.min(100, (100 * state.score) / state.target) + '%';
  } else if (m.time) {
    $('limitLabel').textContent = 'Time';
    $('limit').textContent = formatTime(state.timeLeft);
  } else {
    $('limitLabel').textContent = 'Best';
    $('limit').textContent = Math.max(state.score, store.get('gems:best:zen', 0)).toLocaleString();
  }
}

function fit() {
  if (!engine) return;
  const r = stage.getBoundingClientRect();
  engine.fit(r.width, r.height);
}

function start() {
  clearInterval(timerId);
  if (engine) engine.destroy();
  const m = MODES[mode];
  const level = m.levels ? store.get(`gems:level:${mode}`, 1) : 0;
  const cfg = m.levels ? levelConfig(mode, level) : { colors: 6, mask: null };
  state = {
    level,
    score: 0,
    target: cfg.target,
    moves: cfg.moves,
    timeLeft: m.time || 0,
    over: false,
  };
  engine = new Match3(stage, {
    colors: cfg.colors,
    mask: cfg.mask,
    input: m.input,
    hooks: {
      canInteract: () => !state.over,
      onMove: () => {
        if (m.levels) state.moves--;
        render();
      },
      onScore: (pts) => {
        state.score += pts;
        render();
      },
      onCascade: (n) => {
        if (n >= 3) toast(stage, n >= 5 ? `Incredible ×${n}` : `Combo ×${n}`);
      },
      onShuffle: () => toast(stage, 'Shuffle!', 'var(--ink)'),
      onSettled: () => checkEnd(),
    },
  });
  fit();
  render();
  if (m.time) {
    const endAt = Date.now() + m.time * 1000;
    timerId = setInterval(() => {
      state.timeLeft = (endAt - Date.now()) / 1000;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.over = true;
        clearInterval(timerId);
        waitIdle().then(finishBlitz);
      }
      render();
    }, 250);
  }
}

function waitIdle() {
  return new Promise((resolve) => {
    const tick = () => (engine.busy ? setTimeout(tick, 100) : resolve());
    tick();
  });
}

async function finishBlitz() {
  const key = 'gems:best:blitz';
  const best = store.get(key, 0);
  const record = state.score > best;
  if (record) store.set(key, state.score);
  const again = await dialog({
    title: record ? 'New best!' : "Time's up",
    html: `<p>You scored <b>${state.score.toLocaleString()}</b> points.<br>Best: ${Math.max(best, state.score).toLocaleString()}</p>`,
    buttons: [{ label: 'Play again', primary: true, value: true }, { label: 'Change mode', value: false }],
  });
  if (again) start(); else chooseMode();
}

async function checkEnd() {
  const m = MODES[mode];
  if (mode === 'zen') {
    if (state.score > store.get('gems:best:zen', 0)) store.set('gems:best:zen', state.score);
    return;
  }
  if (!m.levels || state.over) return;
  if (state.score >= state.target) {
    state.over = true;
    const cfg = levelConfig(mode, state.level);
    const ratio = state.moves / cfg.moves;
    const stars = ratio >= 0.35 ? 3 : ratio >= 0.15 ? 2 : 1;
    store.set(`gems:level:${mode}`, state.level + 1);
    await dialog({
      title: `Level ${state.level} complete`,
      html: `<p style="font-size:2rem;margin:4px 0">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
<p>${state.score.toLocaleString()} points with ${state.moves} moves to spare.</p>`,
      buttons: [{ label: 'Next level', primary: true, value: true }],
    });
    start();
  } else if (state.moves <= 0) {
    state.over = true;
    await dialog({
      title: 'Out of moves',
      html: `<p>${state.score.toLocaleString()} of ${state.target.toLocaleString()} points. So close!</p>`,
      buttons: [{ label: 'Try again', primary: true, value: true }],
    });
    start();
  }
}

async function chooseMode() {
  const html = `<div class="choices">${Object.entries(MODES).map(([k, m]) => {
    const extra = m.levels ? ` · level ${store.get(`gems:level:${k}`, 1)}`
      : m.time ? ` · best ${store.get('gems:best:blitz', 0).toLocaleString()}` : '';
    return `<button class="choice${k === mode ? ' active' : ''}" data-value="${k}"><b>${m.name}${extra}</b><span>${m.desc}</span></button>`;
  }).join('')}</div>`;
  const pick = await dialog({ title: 'Choose a mode', html, buttons: [{ label: 'Close', value: null }] });
  if (pick && pick !== mode) {
    mode = pick;
    store.set('gems:mode', mode);
    history.replaceState(null, '', `?mode=${mode}`);
    start();
  }
}

$('modeBtn').onclick = chooseMode;
$('hintBtn').onclick = () => engine?.showHint();
$('restartBtn').onclick = async () => {
  if (state.over) return start();
  const ok = await dialog({
    title: 'Restart?',
    html: '<p>Your current progress on this board will be lost.</p>',
    buttons: [{ label: 'Restart', primary: true, value: true }, { label: 'Cancel', value: false }],
  });
  if (ok) start();
};

window.__engine = () => engine; // debugging aid
new ResizeObserver(fit).observe(stage);
start();
window.WavedashHook?.ready(); // on Wavedash: the board is drawn, show the game
