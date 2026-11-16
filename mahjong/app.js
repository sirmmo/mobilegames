import { LAYOUTS } from './layouts.js';
import { newGame, isFree, matches, availablePairs, reshuffle } from './game.js';
import { faceSVG, faceName } from './tiles.js';
import { store, dialog, toast, formatTime, registerSW } from '../shared/util.js';

registerSW('../sw.js');

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const board = $('board');

const DEPTH = 0.12; // layer offset, in tile widths
const ASPECT = 4 / 3; // tile height / width

let layoutKey = store.get('mj:layout', null)
  || (innerHeight > innerWidth ? 'pagoda' : 'turtle');
let tiles = [];
let selected = null;
let history = [];
let elapsed = 0;
let timer = 0;
let over = false;
let shuffles = 0;

function start(key = layoutKey) {
  layoutKey = key;
  store.set('mj:layout', key);
  tiles = newGame(LAYOUTS[key].build());
  selected = null;
  history = [];
  elapsed = 0;
  over = false;
  shuffles = 0;
  board.innerHTML = '';
  for (const t of tiles) {
    const el = document.createElement('button');
    el.className = 'mj-tile';
    el.style.zIndex = t.z * 1000 + t.y * 40 + t.x;
    el.innerHTML = faceSVG(t.face);
    el.setAttribute('aria-label', faceName(t.face));
    el.addEventListener('click', () => onTile(t));
    t.el = el;
    board.appendChild(el);
  }
  $('title').textContent = `Mahjong · ${LAYOUTS[key].name}`;
  clearInterval(timer);
  timer = setInterval(() => {
    if (!over && !document.hidden) {
      elapsed++;
      $('time').textContent = formatTime(elapsed);
    }
  }, 1000);
  layout();
  refresh();
}

function layout() {
  if (!tiles.length) return;
  const rect = stage.getBoundingClientRect();
  // Bounding box in tile-width units.
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const t of tiles) {
    const l = (t.x / 2) - t.z * DEPTH;
    const tp = (t.y / 2) * ASPECT - t.z * DEPTH;
    minX = Math.min(minX, l);
    minY = Math.min(minY, tp);
    maxX = Math.max(maxX, l + 1 + DEPTH);
    maxY = Math.max(maxY, tp + ASPECT + DEPTH);
  }
  const W = Math.floor(Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 90));
  board.style.width = (maxX - minX) * W + 'px';
  board.style.height = (maxY - minY) * W + 'px';
  board.style.setProperty('--tw', W + 'px');
  board.style.setProperty('--th', W * ASPECT + 'px');
  board.style.setProperty('--d', Math.max(2, W * DEPTH) + 'px');
  for (const t of tiles) {
    const l = ((t.x / 2) - t.z * DEPTH - minX) * W;
    const tp = ((t.y / 2) * ASPECT - t.z * DEPTH - minY) * W;
    t.el.style.left = l + 'px';
    t.el.style.top = tp + 'px';
  }
}

function present() {
  return tiles.filter((t) => !t.removed);
}

function refresh() {
  const live = present();
  for (const t of live) t.el.classList.toggle('blocked', !isFree(t, live));
  board.classList.toggle('dim', store.get('mj:dim', true));
  const pairs = availablePairs(tiles);
  $('left').textContent = live.length;
  $('moves').textContent = pairs.length;
  $('time').textContent = formatTime(elapsed);
  $('undoBtn').disabled = history.length === 0;
  return pairs;
}

function clearMarks() {
  board.querySelectorAll('.hint').forEach((e) => e.classList.remove('hint'));
}

function select(t) {
  if (selected) selected.el.classList.remove('selected');
  selected = t;
  if (t) t.el.classList.add('selected');
}

function onTile(t) {
  if (over || t.removed) return;
  clearMarks();
  if (!isFree(t, present())) {
    t.el.classList.remove('nope');
    void t.el.offsetWidth;
    t.el.classList.add('nope');
    return;
  }
  if (selected === t) return select(null);
  if (selected && matches(selected, t)) {
    const a = selected;
    select(null);
    a.removed = t.removed = true;
    a.el.classList.add('gone');
    t.el.classList.add('gone');
    history.push([a, t]);
    afterMove();
    return;
  }
  select(t);
}

async function afterMove() {
  const pairs = refresh();
  if (present().length === 0) {
    over = true;
    const key = `mj:best:${layoutKey}`;
    const best = store.get(key, null);
    const record = best === null || elapsed < best;
    if (record) store.set(key, elapsed);
    const again = await dialog({
      title: record ? 'New best time!' : 'Board cleared!',
      html: `<p>${LAYOUTS[layoutKey].name} cleared in <b>${formatTime(elapsed)}</b>${shuffles ? ` with ${shuffles} shuffle${shuffles > 1 ? 's' : ''}` : ''}.<br>
Best: ${formatTime(record ? elapsed : best)}</p>`,
      buttons: [{ label: 'Play again', primary: true, value: 'again' }, { label: 'Other layout', value: 'menu' }],
    });
    if (again === 'menu') menu(); else start();
    return;
  }
  if (pairs.length === 0) {
    const choice = await dialog({
      title: 'No more moves',
      html: '<p>No free tiles match. Shuffle the remaining tiles, or undo and try another path.</p>',
      buttons: [
        { label: 'Shuffle', primary: true, value: 'shuffle' },
        { label: 'Undo', value: 'undo' },
        { label: 'New game', value: 'new' },
      ],
    });
    if (choice === 'shuffle') doShuffle();
    else if (choice === 'undo') undo();
    else start();
  }
}

function undo() {
  if (over || !history.length) return;
  clearMarks();
  select(null);
  const [a, b] = history.pop();
  a.removed = b.removed = false;
  a.el.classList.remove('gone');
  b.el.classList.remove('gone');
  refresh();
}

function hint() {
  if (over) return;
  clearMarks();
  const pairs = availablePairs(tiles);
  if (!pairs.length) return afterMove();
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  select(null);
  a.el.classList.add('hint');
  b.el.classList.add('hint');
}

function doShuffle() {
  if (over) return;
  clearMarks();
  select(null);
  reshuffle(tiles);
  shuffles++;
  for (const t of present()) {
    t.el.innerHTML = faceSVG(t.face);
    t.el.setAttribute('aria-label', faceName(t.face));
  }
  toast(stage, 'Shuffled', 'var(--ink)');
  afterMove();
}

async function menu() {
  const html = `<div class="choices">${Object.entries(LAYOUTS).map(([k, l]) => {
    const best = store.get(`mj:best:${k}`, null);
    return `<button class="choice${k === layoutKey ? ' active' : ''}" data-value="${k}">
<b>${l.name}${best !== null ? ` · best ${formatTime(best)}` : ''}</b><span>${l.desc}</span></button>`;
  }).join('')}</div>
<label class="mj-check"><input type="checkbox" id="dimOpt" ${store.get('mj:dim', true) ? 'checked' : ''}> Dim blocked tiles</label>
<p class="mj-legend">Tap two matching free tiles to remove them. A tile is free when nothing covers it and its left or right side is open. Any flower matches any flower; any season matches any season.</p>`;
  const p = dialog({ title: 'New game', html, buttons: [{ label: 'Close', value: null }] });
  document.getElementById('dimOpt').addEventListener('change', (e) => {
    store.set('mj:dim', e.target.checked);
    refresh();
  });
  const pick = await p;
  if (pick) start(pick);
}

$('undoBtn').onclick = undo;
$('hintBtn').onclick = hint;
$('shuffleBtn').onclick = doShuffle;
$('newBtn').onclick = menu;
$('menuBtn').onclick = menu;

new ResizeObserver(layout).observe(stage);
start();
