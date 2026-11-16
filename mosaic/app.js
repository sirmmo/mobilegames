import { LEVELS } from './levels.js';
import { store, dialog, shuffle, sleep, registerSW } from '../shared/util.js';

registerSW('../sw.js');

const TRAY_SIZE = 4;
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const boardEl = $('board');
const trayEl = $('tray');

let S = null; // game state
let sel = null; // {k: 'b' | 't', i}
let locked = false;
let cellEls = [];
let trayEls = [];

// ---------------------------------------------------------------- setup

function levelData(n) {
  return LEVELS[(n - 1) % LEVELS.length];
}

function newState(level) {
  const data = levelData(level);
  const rows = data.art.length;
  const cols = data.art[0].length;
  const chars = [];
  for (const ch of data.art.join('')) if (ch !== '.' && !chars.includes(ch)) chars.push(ch);
  const targets = [];
  for (const row of data.art) for (const ch of row) targets.push(ch === '.' ? -1 : chars.indexOf(ch));
  const slots = targets.map((t, i) => (t >= 0 ? i : -1)).filter((i) => i >= 0);
  // Scramble: hand out the picture's own jewels at random, then break up
  // any that landed in the right place by chance.
  const jewels = shuffle(slots.map((i) => targets[i]));
  const board = targets.map(() => null);
  slots.forEach((i, k) => { board[i] = jewels[k]; });
  for (let pass = 0; pass < 4; pass++) {
    for (const i of slots) {
      if (board[i] !== targets[i]) continue;
      const j = slots.find((x) => board[x] !== targets[i] && targets[x] !== board[i] && Math.random() < 0.5)
        ?? slots.find((x) => board[x] !== targets[i] && targets[x] !== board[i]);
      if (j !== undefined) [board[i], board[j]] = [board[j], board[i]];
    }
  }
  return {
    level, rows, cols, targets, board,
    tray: new Array(TRAY_SIZE).fill(null),
    moves: 0,
    history: [],
    startWrong: slots.filter((i) => board[i] !== targets[i]).length,
  };
}

function colorsOf(level) {
  const data = levelData(level);
  const chars = [];
  for (const ch of data.art.join('')) if (ch !== '.' && !chars.includes(ch)) chars.push(ch);
  return chars.map((ch) => data.pal[ch]);
}

let COLORS = [];

function start(fresh = false) {
  const level = store.get('mosaic:level', 1);
  const saved = store.get('mosaic:save', null);
  S = !fresh && saved && saved.level === level ? { ...saved, history: saved.history || [] } : newState(level);
  COLORS = colorsOf(level);
  sel = null;
  locked = false;
  build();
  fit();
  render();
  save();
}

function save() {
  store.set('mosaic:save', S);
}

function build() {
  boardEl.classList.remove('done');
  boardEl.style.setProperty('--cols', S.cols);
  boardEl.innerHTML = '';
  cellEls = S.targets.map((t, i) => {
    const d = document.createElement('div');
    d.className = 'mo-slot' + (t < 0 ? ' hole' : '');
    if (t >= 0) {
      d.style.setProperty('--t', COLORS[t]);
      d.style.setProperty('--i', i);
      d.innerHTML = `<div class="mo-dot">${t + 1}</div><span class="mo-num">${t + 1}</span>`;
      d.addEventListener('click', () => onSlot(i));
    }
    boardEl.appendChild(d);
    return d;
  });
  trayEl.innerHTML = '';
  trayEls = S.tray.map((_, j) => {
    const d = document.createElement('button');
    d.className = 'mo-tray-slot';
    d.setAttribute('aria-label', `Tray slot ${j + 1}`);
    d.addEventListener('click', () => onTray(j));
    trayEl.appendChild(d);
    return d;
  });
  $('title').textContent = `Jewel Mosaic · ${S.level}`;
}

function fit() {
  if (!S) return;
  const r = stage.getBoundingClientRect();
  const cell = Math.floor(Math.max(18, Math.min((r.width - 12) / S.cols, (r.height - 12) / S.rows, 60)));
  boardEl.style.setProperty('--cell', cell + 'px');
}

// --------------------------------------------------------------- render

function jewelEl(color) {
  const j = document.createElement('div');
  j.className = 'jewel';
  j.style.setProperty('--c', COLORS[color]);
  return j;
}

function setJewel(container, color) {
  container.querySelector('.jewel')?.remove();
  if (color !== null && color !== undefined) container.appendChild(jewelEl(color));
}

const isOk = (i) => S.board[i] !== null && S.board[i] === S.targets[i];

function render() {
  document.querySelectorAll('.jewel.selected').forEach((e) => e.classList.remove('selected'));
  S.targets.forEach((t, i) => {
    if (t < 0) return;
    const el = cellEls[i];
    const cur = el.querySelector('.jewel');
    const want = S.board[i];
    const curColor = cur ? Number(cur.dataset.color) : null;
    if (curColor !== want) {
      setJewel(el, want);
      el.querySelector('.jewel')?.setAttribute('data-color', want);
      if (want !== null && want === t) {
        el.classList.add('snap');
        setTimeout(() => el.classList.remove('snap'), 400);
      }
    }
    el.classList.toggle('ok', isOk(i));
    el.classList.toggle('full', want !== null);
    el.classList.remove('target', 'flash');
  });
  S.tray.forEach((c, j) => {
    setJewel(trayEls[j], c);
    trayEls[j].classList.remove('target');
  });

  if (sel) {
    const color = get(sel);
    const selEl = elOf(sel)?.querySelector('.jewel');
    selEl?.classList.add('selected');
    S.targets.forEach((t, i) => {
      if (t === color && S.board[i] === null) cellEls[i].classList.add('target');
    });
    if (sel.k === 'b') S.tray.forEach((c, j) => { if (c === null) trayEls[j].classList.add('target'); });
  }

  const total = S.targets.filter((t) => t >= 0).length;
  const placed = S.targets.filter((t, i) => t >= 0 && isOk(i)).length;
  const pct = Math.floor((100 * placed) / total);
  $('level').textContent = S.level;
  $('placed').textContent = pct + '%';
  $('progress').style.width = pct + '%';
  $('moves').textContent = S.moves;
  $('undoBtn').disabled = S.history.length === 0;
  renderPalette();
  return placed === total;
}

function renderPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  COLORS.forEach((hex, c) => {
    const left = S.targets.filter((t, i) => t === c && !isOk(i)).length;
    const b = document.createElement('button');
    b.className = 'mo-swatch' + (left === 0 ? ' done' : '');
    b.style.setProperty('--c', hex);
    b.innerHTML = `<i>${c + 1}</i>${left}`;
    b.setAttribute('aria-label', `Colour ${c + 1}: ${left} left`);
    b.addEventListener('click', () => flashColor(c));
    pal.appendChild(b);
  });
}

// ---------------------------------------------------------------- moves

const get = (p) => (p.k === 'b' ? S.board[p.i] : S.tray[p.i]);
function put(p, v) { if (p.k === 'b') S.board[p.i] = v; else S.tray[p.i] = v; }
const elOf = (p) => (p.k === 'b' ? cellEls[p.i] : trayEls[p.i]);

function select(p) {
  sel = p;
  render();
}

function nope(el) {
  el.classList.remove('nope');
  void el.offsetWidth;
  el.classList.add('nope');
}

async function fly(from, to, color) {
  const src = elOf(from).querySelector('.jewel');
  const dst = elOf(to);
  if (!src || !dst) return;
  const a = src.getBoundingClientRect();
  const b = dst.getBoundingClientRect();
  const size = Math.min(b.width, b.height) * (to.k === 'b' ? 0.9 : 0.78);
  const j = jewelEl(color);
  Object.assign(j.style, {
    position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px',
    zIndex: 60, pointerEvents: 'none', margin: 0,
  });
  document.body.appendChild(j);
  src.style.visibility = 'hidden';
  const dx = b.left + (b.width - size) / 2 - a.left;
  const dy = b.top + (b.height - size) / 2 - a.top;
  const anim = j.animate([
    { transform: 'translate(0,0) scale(1)' },
    { transform: `translate(${dx}px, ${dy}px) scale(${size / a.width})` },
  ], { duration: 190, easing: 'cubic-bezier(.3,.7,.4,1)' });
  await anim.finished.catch(() => {});
  j.remove();
}

async function move(from, to, { record = true } = {}) {
  const color = get(from);
  locked = true;
  sel = null;
  clearHint();
  await fly(from, to, color);
  put(from, null);
  put(to, color);
  if (record) {
    S.moves++;
    S.history.push([from, to]);
  }
  locked = false;
  const won = render();
  save();
  if (won) win();
}

/** Double-tap: send the jewel to a matching free slot, else to the tray. */
function smart(p) {
  const color = get(p);
  const i = S.targets.findIndex((t, k) => t === color && S.board[k] === null);
  if (i >= 0) return move(p, { k: 'b', i });
  if (p.k === 'b') {
    const j = S.tray.indexOf(null);
    if (j >= 0) return move(p, { k: 't', i: j });
  }
  nope(elOf(p));
  select(null);
}

function onSlot(i) {
  if (locked) return;
  clearHint();
  const color = S.board[i];
  if (isOk(i)) {
    if (sel) select(null);
    return;
  }
  if (sel) {
    if (sel.k === 'b' && sel.i === i) return smart(sel);
    if (color === null) {
      if (S.targets[i] === get(sel)) return move(sel, { k: 'b', i });
      return nope(cellEls[i]);
    }
    return select({ k: 'b', i });
  }
  if (color !== null) return select({ k: 'b', i });
  // Empty slot with nothing held: pull a matching jewel from the tray.
  const j = S.tray.indexOf(S.targets[i]);
  if (j >= 0) return move({ k: 't', i: j }, { k: 'b', i });
  flashColor(S.targets[i]);
}

function onTray(j) {
  if (locked) return;
  clearHint();
  if (sel) {
    if (sel.k === 't' && sel.i === j) return smart(sel);
    if (S.tray[j] === null && sel.k === 'b') return move(sel, { k: 't', i: j });
    if (S.tray[j] !== null) return select({ k: 't', i: j });
    return nope(trayEls[j]);
  }
  if (S.tray[j] !== null) select({ k: 't', i: j });
}

function flashColor(c) {
  clearHint();
  S.targets.forEach((t, i) => {
    if (S.board[i] === c && !isOk(i)) cellEls[i].querySelector('.jewel')?.classList.add('hint');
  });
  S.tray.forEach((x, j) => { if (x === c) trayEls[j].querySelector('.jewel')?.classList.add('hint'); });
  setTimeout(clearHint, 1600);
}

function clearHint() {
  document.querySelectorAll('.jewel.hint').forEach((e) => e.classList.remove('hint'));
}

function hint() {
  if (locked) return;
  sel = null;
  render();
  const empty = S.targets.map((t, i) => (t >= 0 && S.board[i] === null ? i : -1)).filter((i) => i >= 0);
  // 1. A tray jewel that fits a free slot.
  for (let j = 0; j < S.tray.length; j++) {
    const i = empty.find((x) => S.targets[x] === S.tray[j]);
    if (S.tray[j] !== null && i !== undefined) {
      trayEls[j].querySelector('.jewel').classList.add('hint');
      cellEls[i].classList.add('target');
      return;
    }
  }
  // 2. A misplaced board jewel that fits a free slot.
  for (const i of empty) {
    const k = S.board.findIndex((c, x) => c === S.targets[i] && !isOk(x));
    if (k >= 0) {
      cellEls[k].querySelector('.jewel').classList.add('hint');
      cellEls[i].classList.add('target');
      return;
    }
  }
  // 3. Otherwise free a slot by parking a misplaced jewel in the tray.
  const k = S.board.findIndex((c, x) => c !== null && !isOk(x));
  const j = S.tray.indexOf(null);
  if (k >= 0 && j >= 0) {
    cellEls[k].querySelector('.jewel').classList.add('hint');
    trayEls[j].classList.add('target');
  }
}

async function undo() {
  if (locked || !S.history.length) return;
  const [from, to] = S.history.pop();
  S.moves--;
  await move(to, from, { record: false });
}

async function win() {
  locked = true;
  store.set('mosaic:save', null);
  boardEl.classList.add('done');
  await sleep(900);
  const ratio = S.moves / Math.max(1, S.startWrong);
  const stars = ratio <= 1.3 ? 3 : ratio <= 1.6 ? 2 : 1;
  const data = levelData(S.level);
  store.set('mosaic:level', S.level + 1);
  await dialog({
    title: `“${data.name}” complete!`,
    html: `<p style="font-size:2rem;margin:4px 0">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
<p>${S.startWrong} jewels sorted in ${S.moves} moves.</p>`,
    buttons: [{ label: 'Next picture', primary: true, value: true }],
  });
  start(true);
}

async function help(first) {
  await dialog({
    title: 'How to play',
    html: `<p>Every jewel belongs to the picture, but they are all in the wrong places.
Each slot shows the number and colour it needs.</p>
<p>Tap a jewel to pick it up, then tap where it goes: a free slot of its colour, or the tray.
Park jewels in the tray to free up slots, then bring them back.
Double-tap a jewel to send it to a free spot automatically.</p>
<p>Tap a colour at the bottom to find its jewels.</p>`,
    buttons: [{ label: first ? 'Start' : 'Got it', primary: true, value: true }],
  });
  store.set('mosaic:seenHelp', true);
}

$('helpBtn').onclick = () => help(false);
$('hintBtn').onclick = hint;
$('undoBtn').onclick = undo;
$('restartBtn').onclick = async () => {
  const ok = await dialog({
    title: 'Restart picture?',
    html: '<p>The jewels will be scrambled again.</p>',
    buttons: [{ label: 'Restart', primary: true, value: true }, { label: 'Cancel', value: false }],
  });
  if (ok) start(true);
};

new ResizeObserver(fit).observe(stage);
start();
if (!store.get('mosaic:seenHelp', false)) help(true);
window.__mosaic = () => S; // debugging aid
