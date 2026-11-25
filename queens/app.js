import { PUZZLES } from './puzzles.js';
import { parse, conflicts, attacks } from './logic.js';
import { store, dialog, toast, formatTime, registerSW } from '../shared/util.js';

registerSW('../sw.js');

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const boardEl = $('board');

const COLORS = ['#ff9aa2', '#ffc48a', '#fff08a', '#a8e6a1', '#8fd3ff', '#c3a6ff',
  '#ffb3e6', '#8ee8d8', '#e3c79c', '#a9b4ff', '#d8f08a', '#d0d0d0'];
const CROWN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 4l4.5 8L21 8l-2 11H5z"/><rect x="5" y="20" width="14" height="2" rx="1"/></svg>';
const EMPTY = 0, MARK = 1, CROWNED = 2;

let idx = 0;      // puzzle index
let P = null;     // parsed puzzle
let cells = [];   // EMPTY | MARK | CROWNED
let history = []; // list of [[cell, before], ...]
let elapsed = 0;
let won = false;
let autoX = store.get('queens:autoX', true);
let cellEls = [];
let solved = store.get('queens:solved', {}); // index -> best seconds

// ---------------------------------------------------------------- state

function save() {
  store.set('queens:cur', idx);
  store.set(`queens:s:${idx}`, { cells: cells.join(''), elapsed, won });
}

function load(i) {
  idx = Math.max(0, Math.min(PUZZLES.length - 1, i));
  P = parse(PUZZLES[idx]);
  const s = store.get(`queens:s:${idx}`, null);
  cells = s && s.cells && s.cells.length === P.n * P.n ? [...s.cells].map(Number) : new Array(P.n * P.n).fill(EMPTY);
  elapsed = s ? s.elapsed || 0 : 0;
  won = !!(s && s.won);
  history = [];
  build();
  render();
  save();
}

const queens = () => cells.map((v, i) => (v === CROWNED ? i : -1)).filter((i) => i >= 0);

// ---------------------------------------------------------------- view

function build() {
  const { n, regions } = P;
  boardEl.innerHTML = '';
  boardEl.classList.remove('won');
  boardEl.style.setProperty('--n', n);
  cellEls = [];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, k = regions[i];
    const el = document.createElement('div');
    el.className = 'qn-cell';
    el.style.setProperty('--c', COLORS[k]);
    if (r > 0 && regions[i - n] !== k) el.classList.add('bt');
    if (c > 0 && regions[i - 1] !== k) el.classList.add('bl');
    if (c < n - 1 && regions[i + 1] !== k) el.classList.add('br');
    if (r < n - 1 && regions[i + n] !== k) el.classList.add('bb');
    el.dataset.i = i;
    el.setAttribute('role', 'button');
    cellEls.push(el);
    boardEl.appendChild(el);
  }
  $('num').textContent = idx + 1;
  $('size').textContent = `${n}×${n}`;
  fit();
}

function fit() {
  if (!P) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  const cell = Math.max(24, Math.floor((Math.min(w, h) - 8) / P.n));
  boardEl.style.setProperty('--cell', cell + 'px');
}

function render() {
  const qs = queens();
  const bad = conflicts(P, qs);
  const ruled = new Set();
  if (autoX) for (const q of qs) for (const j of attacks(P, q)) ruled.add(j);
  let k = 0;
  cellEls.forEach((el, i) => {
    const v = cells[i];
    const auto = v === EMPTY && ruled.has(i);
    const want = v === CROWNED ? 'q' : v === MARK ? 'x' : auto ? 'a' : '';
    if (el.dataset.v !== want) {
      el.dataset.v = want;
      el.innerHTML = want === 'q' ? CROWN : want ? '<span class="x">×</span>' : '';
    }
    el.classList.toggle('auto', auto);
    el.classList.toggle('bad', bad.has(i));
    if (v === CROWNED) el.style.setProperty('--k', k++);
    el.setAttribute('aria-label', `row ${Math.floor(i / P.n) + 1} column ${(i % P.n) + 1}: ${v === CROWNED ? 'crown' : v === MARK ? 'marked' : 'empty'}`);
  });
  $('time').textContent = formatTime(elapsed);
  $('undoBtn').disabled = !history.length || won;
}

// ---------------------------------------------------------------- moves

function apply(changes) {
  const rec = [];
  for (const [i, v] of changes) {
    if (cells[i] === v) continue;
    rec.push([i, cells[i]]);
    cells[i] = v;
  }
  if (!rec.length) return;
  history.push(rec);
  render();
  save();
  checkWin();
}

function undo() {
  if (won || !history.length) return;
  for (const [i, v] of history.pop().reverse()) cells[i] = v;
  render();
  save();
}

function clearAll() {
  if (won) return;
  apply(cells.map((v, i) => [i, EMPTY]));
}

async function checkWin() {
  const qs = queens();
  if (won || qs.length !== P.n || conflicts(P, qs).size) return;
  won = true;
  const best = solved[idx];
  const isBest = best == null || elapsed < best;
  if (isBest) solved[idx] = elapsed;
  store.set('queens:solved', solved);
  save();
  render();
  boardEl.classList.add('won');
  await new Promise((r) => setTimeout(r, 900));
  const doneCount = Object.keys(solved).length;
  const choice = await dialog({
    title: 'Solved!',
    html: `<p>Puzzle ${idx + 1} (${P.n}×${P.n}) in <b>${formatTime(elapsed)}</b>.` +
      `${isBest && best != null ? ' New best time!' : best != null ? ` Best: ${formatTime(best)}.` : ''}</p>` +
      `<p>${doneCount} of ${PUZZLES.length} puzzles solved.</p>`,
    buttons: [
      { label: 'Next puzzle', primary: true, value: 'next' },
      { label: 'Choose a puzzle', value: 'list' },
      { label: 'Stay here', value: 'stay' },
    ],
  });
  if (choice === 'next') load(nextUnsolved(idx));
  else if (choice === 'list') pick();
}

function nextUnsolved(from) {
  for (let k = 1; k <= PUZZLES.length; k++) {
    const j = (from + k) % PUZZLES.length;
    if (solved[j] == null) return j;
  }
  return (from + 1) % PUZZLES.length;
}

function hint() {
  if (won) return;
  const { n, solution } = P;
  const sol = new Set(solution.map((c, r) => r * n + c));
  cellEls.forEach((el) => el.classList.remove('hint', 'wrong'));
  const wrongQ = queens().filter((i) => !sol.has(i));
  if (wrongQ.length) {
    wrongQ.forEach((i) => cellEls[i].classList.add('wrong'));
    toast(stage, wrongQ.length > 1 ? 'These crowns are misplaced' : 'This crown is misplaced', 'var(--bad)');
    return;
  }
  const wrongX = [...sol].filter((i) => cells[i] === MARK);
  if (wrongX.length) {
    cellEls[wrongX[0]].classList.add('wrong');
    toast(stage, 'This cell needs a crown', 'var(--bad)');
    return;
  }
  // Reveal a missing crown, preferring the smallest region (the easiest to see).
  const size = {};
  P.regions.forEach((k) => { size[k] = (size[k] || 0) + 1; });
  const missing = [...sol].filter((i) => cells[i] !== CROWNED).sort((a, b) => size[P.regions[a]] - size[P.regions[b]]);
  if (!missing.length) return;
  const i = missing[0];
  apply([[i, CROWNED]]);
  cellEls[i].classList.add('hint');
}

// ---------------------------------------------------------------- input
// Tap cycles empty → × → crown → empty. Dragging paints × over empty cells
// (or erases × marks if the drag started on one).

let drag = null;

function cellAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const c = el && el.closest('.qn-cell');
  return c && boardEl.contains(c) ? +c.dataset.i : -1;
}

boardEl.addEventListener('pointerdown', (e) => {
  if (won) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0) return;
  boardEl.setPointerCapture(e.pointerId);
  const from = cells[i];
  drag = { start: i, from, to: from === EMPTY ? MARK : EMPTY, seen: new Set([i]), changes: [], moved: false };
});

boardEl.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const i = cellAt(e.clientX, e.clientY);
  if (i < 0 || drag.seen.has(i)) return;
  if (drag.from === CROWNED) return; // dragging from a crown does nothing
  if (!drag.moved) {
    drag.moved = true;
    paint(drag.start);
  }
  drag.seen.add(i);
  paint(i);
});

function paint(i) {
  if (cells[i] !== drag.from) return;
  drag.changes.push([i, cells[i]]);
  cells[i] = drag.to;
  render();
}

function endDrag(e, cancel) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.moved) {
    // Turn the painted cells into one undo step.
    if (d.changes.length) {
      history.push(d.changes);
      render();
      save();
    }
    return;
  }
  if (cancel) return;
  cellEls.forEach((el) => el.classList.remove('hint', 'wrong'));
  const next = d.from === EMPTY ? MARK : d.from === MARK ? CROWNED : EMPTY;
  apply([[d.start, next]]);
}

boardEl.addEventListener('pointerup', (e) => endDrag(e, false));
boardEl.addEventListener('pointercancel', (e) => endDrag(e, true));

// ---------------------------------------------------------------- menus

function pick() {
  const groups = {};
  PUZZLES.forEach((raw, i) => {
    const n = Math.round(Math.sqrt(raw.indexOf(':')));
    (groups[n] = groups[n] || []).push(i);
  });
  let html = '<div class="qn-pick">';
  for (const [n, list] of Object.entries(groups)) {
    const done = list.filter((i) => solved[i] != null).length;
    html += `<h3>${n}×${n} · ${done}/${list.length}</h3><div class="grid">`;
    for (const i of list) {
      const cls = [solved[i] != null ? 'done' : '', i === idx ? 'cur' : ''].join(' ');
      const title = solved[i] != null ? `Solved in ${formatTime(solved[i])}` : `Puzzle ${i + 1}`;
      html += `<button class="${cls}" data-value="${i}" title="${title}">${i + 1}</button>`;
    }
    html += '</div>';
  }
  html += '</div>';
  dialog({ title: 'Puzzles', html, buttons: [{ label: 'Close', value: null }] }).then((v) => {
    if (v != null) load(+v);
  });
  const cur = document.querySelector('.qn-pick .cur');
  if (cur) cur.scrollIntoView({ block: 'center' });
}

function help() {
  return dialog({
    title: 'Crowns',
    html: `<p>Place one crown in every <b>row</b>, every <b>column</b> and every <b>coloured region</b>.</p>
      <p>Crowns may not touch each other, not even diagonally.</p>
      <p>Tap a cell once for <b>×</b> (a note that no crown goes there), twice for a crown, three times to clear it.
      Drag across cells to mark many at once.</p>
      <p>200 puzzles from 6×6 to 12×12, each with exactly one solution.</p>`,
    buttons: [{ label: 'Play', primary: true, value: true }],
  });
}

$('undoBtn').onclick = undo;
$('hintBtn').onclick = hint;
$('clearBtn').onclick = clearAll;
$('listBtn').onclick = pick;
$('helpBtn').onclick = help;
$('autoX').checked = autoX;
$('autoX').onchange = (e) => { autoX = e.target.checked; store.set('queens:autoX', autoX); render(); };
window.addEventListener('resize', fit);

// Timer runs only while the puzzle is open, visible and unsolved.
setInterval(() => {
  if (won || document.hidden || document.querySelector('.overlay')) return;
  elapsed++;
  $('time').textContent = formatTime(elapsed);
  if (elapsed % 5 === 0) save();
}, 1000);

window.__queens = () => ({ idx, P, cells, won, elapsed });

load(store.get('queens:cur', 0));
if (!store.get('queens:seenHelp', false)) {
  store.set('queens:seenHelp', true);
  help();
}
window.WavedashHook?.ready(); // on Wavedash: the puzzle is drawn, show the game
