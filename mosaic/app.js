import { LEVELS } from './levels.js';
import { store, dialog, shuffle, sleep, registerSW } from '../shared/util.js';

registerSW('../sw.js');

const TRAY_SIZE = 4;
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const boardEl = $('board');
const trayEl = $('tray');

// Two modes with separate progress:
//  single – move one jewel at a time.
//  group  – a jewel brings along its touching, misplaced neighbours of the
//           same colour. The shape keeps its layout when dropped; every piece
//           that lands on a free slot of its colour goes in, the rest stay put.
let mode = store.get('mosaic:mode', 'single') === 'group' ? 'group' : 'single';
const key = (name) => (mode === 'group' ? `mosaic:group:${name}` : `mosaic:${name}`);

let S = null; // game state
let sel = null; // {k: 'b' | 't', i}
let locked = false;
let cellEls = [];
let trayEls = [];
let COLORS = [];

// ---------------------------------------------------------------- setup

function levelData(n) {
  return LEVELS[(n - 1) % LEVELS.length];
}

function charsOf(data) {
  const chars = [];
  for (const ch of data.art.join('')) if (ch !== '.' && !chars.includes(ch)) chars.push(ch);
  return chars;
}

function neighbours(i, rows, cols) {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out = [];
  if (r > 0) out.push(i - cols);
  if (r < rows - 1) out.push(i + cols);
  if (c > 0) out.push(i - 1);
  if (c < cols - 1) out.push(i + 1);
  return out;
}

/** Connected misplaced jewels of one colour, starting from cell i. */
function clusterAt(st, i) {
  const color = st.board[i];
  const seen = new Set([i]);
  const queue = [i];
  while (queue.length) {
    const x = queue.shift();
    for (const n of neighbours(x, st.rows, st.cols)) {
      if (seen.has(n) || st.board[n] !== color || st.board[n] === st.targets[n]) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return [...seen];
}

function countClusters(st) {
  const seen = new Set();
  let n = 0;
  st.board.forEach((c, i) => {
    if (c === null || c === st.targets[i] || seen.has(i)) return;
    n++;
    clusterAt(st, i).forEach((x) => seen.add(x));
  });
  return n;
}

function newState(level) {
  const data = levelData(level);
  const rows = data.art.length;
  const cols = data.art[0].length;
  const chars = charsOf(data);
  const targets = [];
  for (const row of data.art) for (const ch of row) targets.push(ch === '.' ? -1 : chars.indexOf(ch));
  const slots = targets.map((t, i) => (t >= 0 ? i : -1)).filter((i) => i >= 0);
  const board = targets.map((t) => (t >= 0 ? t : null));

  if (mode === 'group') {
    // Swap random rectangles of the finished picture, so same-coloured
    // jewels stay clumped together in the wrong places.
    for (let n = 0; n < slots.length * 3; n++) {
      const h = 1 + Math.floor(Math.random() * 3);
      const w = 1 + Math.floor(Math.random() * 3);
      const r1 = Math.floor(Math.random() * (rows - h + 1));
      const c1 = Math.floor(Math.random() * (cols - w + 1));
      const r2 = Math.floor(Math.random() * (rows - h + 1));
      const c2 = Math.floor(Math.random() * (cols - w + 1));
      if (Math.abs(r1 - r2) < h && Math.abs(c1 - c2) < w) continue; // overlap
      const a = [];
      const b = [];
      for (let dr = 0; dr < h; dr++) {
        for (let dc = 0; dc < w; dc++) {
          a.push((r1 + dr) * cols + c1 + dc);
          b.push((r2 + dr) * cols + c2 + dc);
        }
      }
      if (a.some((x) => targets[x] < 0) || b.some((x) => targets[x] < 0)) continue;
      a.forEach((x, k) => { [board[x], board[b[k]]] = [board[b[k]], board[x]]; });
    }
  } else {
    const jewels = shuffle(slots.map((i) => targets[i]));
    slots.forEach((i, k) => { board[i] = jewels[k]; });
  }
  // Break up jewels that landed in their own place by chance.
  for (let pass = 0; pass < 4; pass++) {
    for (const i of slots) {
      if (board[i] !== targets[i]) continue;
      const j = slots.find((x) => board[x] !== targets[i] && targets[x] !== board[i] && Math.random() < 0.3)
        ?? slots.find((x) => board[x] !== targets[i] && targets[x] !== board[i]);
      if (j !== undefined) [board[i], board[j]] = [board[j], board[i]];
    }
  }
  const st = {
    level, rows, cols, targets, board,
    tray: new Array(TRAY_SIZE).fill(null),
    moves: 0,
    history: [],
  };
  st.startWrong = slots.filter((i) => board[i] !== targets[i]).length;
  st.startClusters = countClusters(st);
  return st;
}

function start(fresh = false) {
  const level = store.get(key('level'), 1);
  const saved = store.get(key('save'), null);
  if (!fresh && saved && saved.level === level) {
    S = saved;
    // Older saves stored history entries as a single [from, to] pair.
    S.history = (S.history || []).map((e) => (e[0] && e[0].k ? [e] : e));
  } else {
    S = newState(level);
  }
  COLORS = charsOf(levelData(level)).map((ch) => levelData(level).pal[ch]);
  sel = null;
  locked = false;
  build();
  fit();
  render();
  save();
}

function save() {
  store.set(key('save'), S);
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
  document.querySelectorAll('.mo-modes button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  });
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

/** The cells that move together with board cell i. */
function groupOf(i) {
  if (mode !== 'group') return [i];
  const g = clusterAt(S, i);
  return [i, ...g.filter((x) => x !== i)];
}

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
    const members = sel.k === 'b' ? groupOf(sel.i) : null;
    if (members) members.forEach((x) => cellEls[x].querySelector('.jewel')?.classList.add('selected'));
    else elOf(sel).querySelector('.jewel')?.classList.add('selected');
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
const B = (i) => ({ k: 'b', i });
const T = (i) => ({ k: 't', i });

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
  ], { duration: 210, easing: 'cubic-bezier(.3,.7,.4,1)' });
  await anim.finished.catch(() => {});
  j.remove();
}

/** Move several jewels at once (one player move). pairs: [[from, to], ...] */
async function moveMany(pairs, { record = true } = {}) {
  if (!pairs.length) return;
  locked = true;
  sel = null;
  clearHint();
  const colors = pairs.map(([from]) => get(from));
  await Promise.all(pairs.map(([from, to], k) => fly(from, to, colors[k])));
  pairs.forEach(([from]) => put(from, null));
  pairs.forEach(([, to], k) => put(to, colors[k]));
  if (record) {
    S.moves++;
    S.history.push(pairs);
  }
  locked = false;
  const won = render();
  save();
  if (won) win();
}

/** Where the group picked up at board cell `from` lands if dropped on cell d. */
function planDrop(from, d) {
  const color = S.board[from];
  const pairs = [];
  const claimed = new Set();
  const fr = Math.floor(from / S.cols);
  const fc = from % S.cols;
  const dr = Math.floor(d / S.cols) - fr;
  const dc = (d % S.cols) - fc;
  for (const m of groupOf(from)) {
    const r = Math.floor(m / S.cols) + dr;
    const c = (m % S.cols) + dc;
    if (r < 0 || c < 0 || r >= S.rows || c >= S.cols) continue;
    const x = r * S.cols + c;
    if (S.targets[x] !== color || S.board[x] !== null || claimed.has(x)) continue;
    claimed.add(x);
    pairs.push([B(m), B(x)]);
  }
  return pairs;
}

/** Park the picked-up jewel (and, in group mode, its group) in the tray. */
function planTray(from, firstSlot = null) {
  const free = S.tray.map((c, j) => (c === null ? j : -1)).filter((j) => j >= 0);
  if (firstSlot !== null) free.sort((a, b) => (a === firstSlot ? -1 : b === firstSlot ? 1 : 0));
  return groupOf(from).slice(0, free.length).map((m, k) => [B(m), T(free[k])]);
}

const emptySlotsFor = (color) => S.targets
  .map((t, i) => (t === color && S.board[i] === null ? i : -1))
  .filter((i) => i >= 0);

/** Best drop for a board pick-up: the free slot where most of its group fits. */
function bestDrop(from) {
  let best = null;
  for (const d of emptySlotsFor(S.board[from])) {
    const p = planDrop(from, d);
    if (!best || p.length > best.length) best = p;
  }
  return best;
}

/** Double-tap: send the jewel(s) to the best free spot, else to the tray. */
function smart(p) {
  if (p.k === 't') {
    const d = emptySlotsFor(S.tray[p.i])[0];
    if (d !== undefined) return moveMany([[p, B(d)]]);
  } else {
    const best = bestDrop(p.i);
    if (best) return moveMany(best);
    const park = planTray(p.i);
    if (park.length) return moveMany(park);
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
      if (S.targets[i] !== get(sel)) return nope(cellEls[i]);
      if (sel.k === 't') return moveMany([[sel, B(i)]]);
      return moveMany(planDrop(sel.i, i));
    }
    return select(B(i));
  }
  if (color !== null) return select(B(i));
  // Empty slot with nothing held: pull a matching jewel from the tray.
  const j = S.tray.indexOf(S.targets[i]);
  if (j >= 0) return moveMany([[T(j), B(i)]]);
  flashColor(S.targets[i]);
}

function onTray(j) {
  if (locked) return;
  clearHint();
  if (sel) {
    if (sel.k === 't' && sel.i === j) return smart(sel);
    if (S.tray[j] === null && sel.k === 'b') return moveMany(planTray(sel.i, j));
    if (S.tray[j] !== null) return select(T(j));
    return nope(trayEls[j]);
  }
  if (S.tray[j] !== null) select(T(j));
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
  // 1. A tray jewel that fits a free slot.
  for (let j = 0; j < S.tray.length; j++) {
    if (S.tray[j] === null) continue;
    const d = emptySlotsFor(S.tray[j])[0];
    if (d !== undefined) {
      trayEls[j].querySelector('.jewel').classList.add('hint');
      cellEls[d].classList.add('target');
      return;
    }
  }
  // 2. The board move that places the most jewels at once.
  let best = null;
  S.board.forEach((c, i) => {
    if (c === null || isOk(i)) return;
    const p = bestDrop(i);
    if (p && (!best || p.length > best.length)) best = p;
  });
  if (best) {
    best.forEach(([from, to]) => {
      cellEls[from.i].querySelector('.jewel').classList.add('hint');
      cellEls[to.i].classList.add('target');
    });
    return;
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
  const pairs = S.history.pop();
  S.moves--;
  await moveMany(pairs.map(([from, to]) => [to, from]), { record: false });
}

async function win() {
  locked = true;
  store.set(key('save'), null);
  boardEl.classList.add('done');
  await sleep(900);
  let stars;
  if (mode === 'group') {
    // Moving groups should take well under one move per jewel.
    const ratio = S.moves / Math.max(1, S.startWrong);
    stars = ratio <= 0.6 ? 3 : ratio <= 0.85 ? 2 : 1;
  } else {
    const ratio = S.moves / Math.max(1, S.startWrong);
    stars = ratio <= 1.3 ? 3 : ratio <= 1.6 ? 2 : 1;
  }
  const data = levelData(S.level);
  store.set(key('level'), S.level + 1);
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
Double-tap a jewel to send it to the best free spot automatically.</p>
<p><b>Groups mode:</b> touching jewels of the same colour move together and keep their shape.
Every jewel that lands on a free slot of its colour goes in; the others stay where they were.</p>
<p>Tap a colour at the bottom to find its jewels.</p>`,
    buttons: [{ label: first ? 'Start' : 'Got it', primary: true, value: true }],
  });
  store.set('mosaic:seenHelp', true);
}

function setMode(m) {
  if (m === mode || locked) return;
  mode = m;
  store.set('mosaic:mode', m);
  start();
}

document.querySelectorAll('.mo-modes button').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});
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
