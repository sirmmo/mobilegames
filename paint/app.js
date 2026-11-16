import { Match3 } from '../shared/match3.js';
import { store, toast, dialog, sleep, registerSW } from '../shared/util.js';
import { LEVELS } from './levels.js';

registerSW('../sw.js');

const $ = (id) => document.getElementById(id);
const stage = $('stage');

let engine = null;
let state = {};

function levelData(n) {
  const base = LEVELS[(n - 1) % LEVELS.length];
  const round = Math.floor((n - 1) / LEVELS.length);
  // After the last picture, pictures repeat with fewer moves and more colours.
  return { ...base, moves: Math.max(14, base.moves - round * 3), colors: round > 0 || n > 5 ? 6 : 5 };
}

function render() {
  $('level').textContent = state.level;
  const pct = Math.floor((100 * state.painted) / state.total);
  $('painted').textContent = pct + '%';
  $('progress').style.width = pct + '%';
  $('moves').textContent = state.moves;
  $('pic').textContent = state.won ? state.data.name : '?';
}

function fit() {
  if (!engine) return;
  const r = stage.getBoundingClientRect();
  engine.fit(r.width, r.height);
}

function start() {
  if (engine) engine.destroy();
  const level = store.get('paint:level', 1);
  const data = levelData(level);
  const mask = data.art.map((row) => row.replace(/[^.]/g, '#'));
  state = { level, data, moves: data.moves, painted: 0, total: 0, over: false, won: false, paint: [] };
  engine = new Match3(stage, {
    rows: data.art.length,
    cols: data.art[0].length,
    colors: data.colors,
    mask,
    hooks: {
      canInteract: () => !state.over,
      onMove: () => { state.moves--; render(); },
      onClear: (cells) => {
        for (const [r, c] of cells) {
          if (state.paint[r][c]) continue;
          state.paint[r][c] = true;
          state.painted++;
          const el = engine.cellEls[r][c];
          el.style.setProperty('--paint', data.pal[data.art[r][c]]);
          el.classList.add('painted');
        }
        render();
      },
      onCascade: (n) => { if (n >= 3) toast(stage, `Combo ×${n}`); },
      onShuffle: () => toast(stage, 'Shuffle!', 'var(--ink)'),
      onSettled: checkEnd,
    },
  });
  state.paint = data.art.map((row) => [...row].map(() => false));
  state.total = data.art.join('').replace(/\./g, '').length;
  fit();
  render();
}

async function checkEnd() {
  if (state.over) return;
  if (state.painted >= state.total) {
    state.over = true;
    state.won = true;
    render();
    engine.el.classList.add('reveal');
    await sleep(1400);
    const ratio = state.moves / state.data.moves;
    const stars = ratio >= 0.3 ? 3 : ratio >= 0.12 ? 2 : 1;
    store.set('paint:level', state.level + 1);
    await dialog({
      title: `“${state.data.name}” painted!`,
      html: `<p style="font-size:2rem;margin:4px 0">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
<p>Finished with ${state.moves} moves to spare.</p>`,
      buttons: [{ label: 'Next picture', primary: true, value: true }],
    });
    start();
  } else if (state.moves <= 0) {
    state.over = true;
    const left = state.total - state.painted;
    await dialog({
      title: 'Out of moves',
      html: `<p>${left} square${left === 1 ? '' : 's'} left unpainted. Try again?</p>`,
      buttons: [{ label: 'Try again', primary: true, value: true }],
    });
    start();
  }
}

async function help(first) {
  await dialog({
    title: 'How to play',
    html: `<p>Swap neighbouring gems to make lines of three or more.
Every square where gems are cleared gets painted, slowly revealing a hidden picture.</p>
<p>Paint the whole canvas before you run out of moves. Lines of four, L-shapes and lines of five
make special gems that paint big areas at once.</p>`,
    buttons: [{ label: first ? 'Start painting' : 'Got it', primary: true, value: true }],
  });
  store.set('paint:seenHelp', true);
}

$('helpBtn').onclick = () => help(false);
$('hintBtn').onclick = () => engine?.showHint();
$('restartBtn').onclick = async () => {
  if (state.over) return start();
  const ok = await dialog({
    title: 'Restart picture?',
    html: '<p>The canvas will be wiped clean.</p>',
    buttons: [{ label: 'Restart', primary: true, value: true }, { label: 'Cancel', value: false }],
  });
  if (ok) start();
};

window.__engine = () => engine; // debugging aid
new ResizeObserver(fit).observe(stage);
start();
if (!store.get('paint:seenHelp', false)) help(true);
