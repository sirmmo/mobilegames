// Generic match-three engine used by the Gem games and Prism Painter.
//
// Board model: grid[r][c] holds a gem {color, special, el} or null.
// mask[r][c] is false for holes (cells that are not part of the board).
// Specials: 'h' clears its row, 'v' clears its column, 'bomb' clears a 3x3
// area, 'prism' (color -1) clears every gem of one colour.

import { gemSVG } from './gems.js';
import { sleep, shuffle } from './util.js';

const T_SWAP = 160;
const T_CLEAR = 230;
const T_FALL = 280;
const PRISM = -1;

export class Match3 {
  constructor(host, opts = {}) {
    this.host = host;
    this.rows = opts.rows ?? 8;
    this.cols = opts.cols ?? 8;
    this.colors = opts.colors ?? 6;
    this.input = opts.input ?? 'swap'; // 'swap' | 'slide'
    this.hooks = {
      canInteract: () => true,
      onMove: () => {},
      onClear: () => {},
      onScore: () => {},
      onCascade: () => {},
      onSettled: () => {},
      onShuffle: () => {},
      ...opts.hooks,
    };
    this.mask = [];
    for (let r = 0; r < this.rows; r++) {
      this.mask.push([]);
      for (let c = 0; c < this.cols; c++) {
        const row = opts.mask?.[r];
        this.mask[r].push(row ? row[c] !== '.' : true);
      }
    }
    this.grid = this.mask.map((row) => row.map(() => null));
    this.busy = false;
    this.selected = null;
    this.hintTimer = 0;
    this.cell = 48;
    this.build();
    this.fillInitial();
  }

  // ---------------------------------------------------------------- DOM

  build() {
    const el = document.createElement('div');
    el.className = 'm3-board';
    el.style.touchAction = 'none';
    const cellsLayer = document.createElement('div');
    cellsLayer.className = 'm3-cells';
    const gemsLayer = document.createElement('div');
    gemsLayer.className = 'm3-gems';
    this.cellEls = this.mask.map((row, r) => row.map((ok, c) => {
      if (!ok) return null;
      const d = document.createElement('div');
      d.className = 'm3-cell' + ((r + c) % 2 ? ' alt' : '');
      cellsLayer.appendChild(d);
      return d;
    }));
    el.append(cellsLayer, gemsLayer);
    this.el = el;
    this.gemsLayer = gemsLayer;
    this.host.appendChild(el);
    this.bindInput();
  }

  destroy() {
    clearTimeout(this.hintTimer);
    this.destroyed = true;
    this.el.remove();
  }

  /** Size the board to fit inside w x h pixels. */
  fit(w, h) {
    const cell = Math.max(26, Math.min(76, Math.floor(Math.min(w / this.cols, h / this.rows))));
    this.cell = cell;
    this.el.style.width = cell * this.cols + 'px';
    this.el.style.height = cell * this.rows + 'px';
    this.el.style.setProperty('--cell', cell + 'px');
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ce = this.cellEls[r][c];
        if (ce) ce.style.transform = `translate(${c * cell}px, ${r * cell}px)`;
        const g = this.grid[r][c];
        if (g) this.place(g, r, c, false);
      }
    }
  }

  makeGem(color, special = null) {
    const el = document.createElement('div');
    el.className = 'm3-gem';
    const gem = { color, special: null, el };
    this.setGem(gem, color, special);
    this.gemsLayer.appendChild(el);
    return gem;
  }

  setGem(gem, color, special) {
    gem.color = color;
    gem.special = special;
    gem.el.innerHTML = gemSVG(color === PRISM ? 'prism' : color);
    gem.el.classList.remove('sp-h', 'sp-v', 'sp-bomb', 'sp-prism');
    if (special) gem.el.classList.add('sp-' + special);
  }

  place(gem, r, c, animate = true, duration = T_FALL) {
    gem.el.style.transition = animate ? `transform ${duration}ms cubic-bezier(.35,.05,.45,1.15)` : 'none';
    gem.el.style.transform = `translate(${c * this.cell}px, ${r * this.cell}px)`;
  }

  // -------------------------------------------------------------- Board

  randomColor() {
    return Math.floor(Math.random() * this.colors);
  }

  colorAt(r, c) {
    const g = this.grid[r]?.[c];
    return g ? g.color : null;
  }

  fillInitial() {
    for (let attempt = 0; attempt < 50; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.mask[r][c]) continue;
          let color;
          do {
            color = this.randomColor();
          } while (
            (c >= 2 && this.colorAt(r, c - 1) === color && this.colorAt(r, c - 2) === color) ||
            (r >= 2 && this.colorAt(r - 1, c) === color && this.colorAt(r - 2, c) === color)
          );
          if (this.grid[r][c]) this.setGem(this.grid[r][c], color, null);
          else this.grid[r][c] = this.makeGem(color);
        }
      }
      if (this.findMatches().length === 0 && this.findMove()) break;
    }
  }

  /** Runs of 3+ same-coloured gems: [{cells: [[r,c]...], dir: 'h'|'v'}]. */
  findMatches() {
    const runs = [];
    const scan = (outer, inner, get, dir) => {
      for (let a = 0; a < outer; a++) {
        let run = [];
        let color = null;
        for (let b = 0; b <= inner; b++) {
          const [r, c] = get(a, b);
          const col = b < inner ? this.colorAt(r, c) : null;
          if (col !== null && col !== PRISM && col === color) {
            run.push([r, c]);
          } else {
            if (run.length >= 3) runs.push({ cells: run, dir });
            run = col !== null && col !== PRISM ? [[r, c]] : [];
            color = col !== null && col !== PRISM ? col : null;
          }
        }
      }
    };
    scan(this.rows, this.cols, (r, c) => [r, c], 'h');
    scan(this.cols, this.rows, (c, r) => [r, c], 'v');
    return runs;
  }

  swapCells(a, b) {
    const t = this.grid[a[0]][a[1]];
    this.grid[a[0]][a[1]] = this.grid[b[0]][b[1]];
    this.grid[b[0]][b[1]] = t;
  }

  isSwapValid(a, b) {
    const ga = this.grid[a[0]][a[1]];
    const gb = this.grid[b[0]][b[1]];
    if (!ga || !gb) return false;
    if (ga.color === PRISM || gb.color === PRISM) return true;
    if (ga.special && gb.special) return true;
    this.swapCells(a, b);
    const ok = this.findMatches().length > 0;
    this.swapCells(a, b);
    return ok;
  }

  /** Cyclically shift row (axis 'h') or column ('v') `index` by k. */
  shiftLine(axis, index, k) {
    const n = axis === 'h' ? this.cols : this.rows;
    const line = [];
    for (let i = 0; i < n; i++) line.push(axis === 'h' ? this.grid[index][i] : this.grid[i][index]);
    for (let i = 0; i < n; i++) {
      const g = line[(((i - k) % n) + n) % n];
      if (axis === 'h') this.grid[index][i] = g; else this.grid[i][index] = g;
    }
  }

  lineIsFull(axis, index) {
    const n = axis === 'h' ? this.cols : this.rows;
    for (let i = 0; i < n; i++) {
      if (axis === 'h' ? !this.mask[index][i] : !this.mask[i][index]) return false;
    }
    return true;
  }

  /** A valid move for hints / dead-board detection, or null. */
  findMove() {
    if (this.input === 'slide') {
      const opts = [];
      for (const axis of ['h', 'v']) {
        const count = axis === 'h' ? this.rows : this.cols;
        const n = axis === 'h' ? this.cols : this.rows;
        for (let i = 0; i < count; i++) {
          if (!this.lineIsFull(axis, i)) continue;
          for (let k = 1; k < n; k++) opts.push([axis, i, k]);
        }
      }
      shuffle(opts);
      for (const [axis, i, k] of opts) {
        this.shiftLine(axis, i, k);
        const ok = this.findMatches().length > 0;
        this.shiftLine(axis, i, -k);
        if (ok) return { slide: [axis, i, k] };
      }
      return null;
    }
    const cells = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) cells.push([r, c]);
    shuffle(cells);
    for (const [r, c] of cells) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const b = [r + dr, c + dc];
        if (b[0] >= this.rows || b[1] >= this.cols) continue;
        if (this.isSwapValid([r, c], b)) return { swap: [[r, c], b] };
      }
    }
    return null;
  }

  // -------------------------------------------------------------- Input

  cellFromEvent(e) {
    const rect = this.el.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / this.cell);
    const r = Math.floor((e.clientY - rect.top) / this.cell);
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols || !this.mask[r][c]) return null;
    return [r, c];
  }

  canAct() {
    return !this.busy && !this.destroyed && this.hooks.canInteract();
  }

  bindInput() {
    let start = null;
    let startCell = null;
    let dragged = false;
    let slideAxis = null;

    this.el.addEventListener('pointerdown', (e) => {
      if (!this.canAct()) return;
      const cell = this.cellFromEvent(e);
      if (!cell || !this.grid[cell[0]][cell[1]]) return;
      this.clearHint();
      start = { x: e.clientX, y: e.clientY };
      startCell = cell;
      dragged = false;
      slideAxis = null;
      this.el.setPointerCapture(e.pointerId);
    });

    this.el.addEventListener('pointermove', (e) => {
      if (!start || dragged === 'done') return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (this.input === 'slide') {
        if (!slideAxis && Math.hypot(dx, dy) > this.cell * 0.2) {
          slideAxis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
          const idx = slideAxis === 'h' ? startCell[0] : startCell[1];
          if (!this.lineIsFull(slideAxis, idx)) { start = null; return; }
          this.select(null);
        }
        if (slideAxis) {
          dragged = true;
          this.dragLine(slideAxis, slideAxis === 'h' ? startCell[0] : startCell[1], slideAxis === 'h' ? dx : dy);
        }
        return;
      }
      if (Math.hypot(dx, dy) > this.cell * 0.35) {
        dragged = 'done';
        const dir = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
        const b = [startCell[0] + dir[0], startCell[1] + dir[1]];
        this.select(null);
        if (b[0] >= 0 && b[1] >= 0 && b[0] < this.rows && b[1] < this.cols && this.grid[b[0]][b[1]]) {
          this.trySwap(startCell, b);
        }
      }
    });

    const end = (e) => {
      if (!start) return;
      const s = start;
      start = null;
      if (this.input === 'slide' && slideAxis && dragged) {
        const delta = slideAxis === 'h' ? e.clientX - s.x : e.clientY - s.y;
        this.releaseLine(slideAxis, slideAxis === 'h' ? startCell[0] : startCell[1], delta);
        return;
      }
      if (dragged) return;
      // Tap: select, or swap with a previously selected neighbour.
      if (this.input === 'swap') {
        const sel = this.selected;
        if (sel && Math.abs(sel[0] - startCell[0]) + Math.abs(sel[1] - startCell[1]) === 1) {
          this.select(null);
          this.trySwap(sel, startCell);
        } else if (sel && sel[0] === startCell[0] && sel[1] === startCell[1]) {
          this.select(null);
        } else {
          this.select(startCell);
        }
      }
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', (e) => {
      if (this.input === 'slide' && slideAxis && start) {
        start = null;
        this.releaseLine(slideAxis, slideAxis === 'h' ? startCell[0] : startCell[1], 0);
      }
      start = null;
    });
  }

  select(cell) {
    if (this.selected) this.grid[this.selected[0]][this.selected[1]]?.el.classList.remove('selected');
    this.selected = cell;
    if (cell) this.grid[cell[0]][cell[1]]?.el.classList.add('selected');
  }

  dragLine(axis, index, delta) {
    const n = axis === 'h' ? this.cols : this.rows;
    const span = n * this.cell;
    for (let i = 0; i < n; i++) {
      const g = axis === 'h' ? this.grid[index][i] : this.grid[i][index];
      if (!g) continue;
      let p = i * this.cell + delta;
      p = ((p % span) + span) % span;
      if (p > span - this.cell / 2) p -= span;
      g.el.style.transition = 'none';
      g.el.style.transform = axis === 'h'
        ? `translate(${p}px, ${index * this.cell}px)`
        : `translate(${index * this.cell}px, ${p}px)`;
    }
  }

  async releaseLine(axis, index, delta) {
    const n = axis === 'h' ? this.cols : this.rows;
    const k = ((Math.round(delta / this.cell) % n) + n) % n;
    this.busy = true;
    if (k !== 0) {
      this.shiftLine(axis, index, k);
      if (this.findMatches().length > 0) {
        this.placeLine(axis, index, 120);
        await sleep(130);
        this.hooks.onMove();
        await this.resolve(null, null);
        return;
      }
      this.shiftLine(axis, index, -k);
    }
    this.placeLine(axis, index, 200);
    await sleep(210);
    this.busy = false;
    this.scheduleHint();
  }

  placeLine(axis, index, duration) {
    const n = axis === 'h' ? this.cols : this.rows;
    for (let i = 0; i < n; i++) {
      const r = axis === 'h' ? index : i;
      const c = axis === 'h' ? i : index;
      if (this.grid[r][c]) this.place(this.grid[r][c], r, c, true, duration);
    }
  }

  // ------------------------------------------------------------ Actions

  async trySwap(a, b) {
    if (!this.canAct()) return false;
    this.busy = true;
    const ga = this.grid[a[0]][a[1]];
    const gb = this.grid[b[0]][b[1]];
    this.swapCells(a, b);
    this.place(ga, b[0], b[1], true, T_SWAP);
    this.place(gb, a[0], a[1], true, T_SWAP);
    await sleep(T_SWAP + 10);

    let forced = null;
    if (ga.color === PRISM || gb.color === PRISM) {
      forced = new Set();
      const other = ga.color === PRISM ? gb : ga;
      const target = other.color === PRISM ? null : other.color;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const g = this.grid[r][c];
          if (g && (target === null || g.color === target)) forced.add(r * this.cols + c);
        }
      }
      forced.add(a[0] * this.cols + a[1]);
      forced.add(b[0] * this.cols + b[1]);
      ga.triggered = gb.triggered = ga.color === PRISM && gb.color === PRISM;
      (ga.color === PRISM ? ga : gb).triggered = true;
    } else if (ga.special && gb.special) {
      forced = new Set([a[0] * this.cols + a[1], b[0] * this.cols + b[1]]);
    } else if (this.findMatches().length === 0) {
      this.swapCells(a, b);
      this.place(ga, a[0], a[1], true, T_SWAP);
      this.place(gb, b[0], b[1], true, T_SWAP);
      ga.el.classList.add('shake');
      gb.el.classList.add('shake');
      await sleep(T_SWAP + 10);
      setTimeout(() => { ga.el.classList.remove('shake'); gb.el.classList.remove('shake'); }, 300);
      this.busy = false;
      this.scheduleHint();
      return false;
    }
    this.hooks.onMove();
    await this.resolve(forced, [a, b]);
    return true;
  }

  effectCells(r, c, gem) {
    const out = [];
    if (gem.special === 'h') for (let i = 0; i < this.cols; i++) out.push([r, i]);
    else if (gem.special === 'v') for (let i = 0; i < this.rows; i++) out.push([i, c]);
    else if (gem.special === 'bomb') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) out.push([r + dr, c + dc]);
    } else if (gem.color === PRISM) {
      // Triggered by another effect: clear the most common colour.
      const counts = new Array(this.colors).fill(0);
      this.grid.forEach((row) => row.forEach((g) => { if (g && g.color >= 0) counts[g.color]++; }));
      const target = counts.indexOf(Math.max(...counts));
      this.grid.forEach((row, rr) => row.forEach((g, cc) => { if (g && g.color === target) out.push([rr, cc]); }));
    }
    return out.filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < this.rows && cc < this.cols && this.grid[rr][cc]);
  }

  /** Decide which specials the runs create: [{r, c, color, special}]. */
  planSpecials(runs, focus) {
    const plans = [];
    const used = new Set();
    const key = (r, c) => r * this.cols + c;
    const isFocus = (r, c) => focus && focus.some(([fr, fc]) => fr === r && fc === c);
    const pick = (cells) => cells.find(([r, c]) => isFocus(r, c)) || cells[Math.floor(cells.length / 2)];

    // Prisms from runs of five or more.
    for (const run of runs) {
      if (run.cells.length >= 5) {
        const [r, c] = pick(run.cells);
        plans.push({ r, c, color: PRISM, special: 'prism' });
        run.done = true;
        run.cells.forEach(([rr, cc]) => used.add(key(rr, cc)));
      }
    }
    // Bombs where a horizontal and a vertical run cross.
    for (const h of runs) {
      if (h.done || h.dir !== 'h') continue;
      for (const v of runs) {
        if (v.done || v.dir !== 'v') continue;
        const cross = h.cells.find(([r, c]) => v.cells.some(([r2, c2]) => r === r2 && c === c2));
        if (cross && this.colorAt(...cross) === this.colorAt(...v.cells[0])) {
          plans.push({ r: cross[0], c: cross[1], color: this.colorAt(...cross), special: 'bomb' });
          h.done = v.done = true;
          break;
        }
      }
    }
    // Line gems from runs of four.
    for (const run of runs) {
      if (run.done || run.cells.length !== 4) continue;
      const [r, c] = pick(run.cells);
      if (used.has(key(r, c))) continue;
      plans.push({ r, c, color: this.colorAt(r, c), special: run.dir });
      used.add(key(r, c));
    }
    return plans;
  }

  async resolve(forced, focus) {
    let cascade = 0;
    for (;;) {
      const runs = this.findMatches();
      if (!runs.length && !forced) break;
      cascade++;
      const key = (r, c) => r * this.cols + c;
      const clear = new Set(forced || []);
      forced = null;
      runs.forEach((run) => run.cells.forEach(([r, c]) => clear.add(key(r, c))));
      const plans = this.planSpecials(runs, cascade === 1 ? focus : null);

      // Chain special effects.
      const queue = [...clear];
      while (queue.length) {
        const k = queue.pop();
        const r = Math.floor(k / this.cols);
        const c = k % this.cols;
        const g = this.grid[r][c];
        if (!g || g.triggered || (!g.special && g.color !== PRISM)) continue;
        g.triggered = true;
        for (const [rr, cc] of this.effectCells(r, c, g)) {
          const kk = key(rr, cc);
          if (!clear.has(kk)) { clear.add(kk); queue.push(kk); }
        }
        g.el.classList.add('fire');
      }

      const affected = [...clear].map((k) => [Math.floor(k / this.cols), k % this.cols]);
      const keep = new Set();
      for (const p of plans) {
        const g = this.grid[p.r][p.c];
        // A special keeps its spot unless an effect destroyed it this turn.
        if (g && !g.triggered) {
          keep.add(key(p.r, p.c));
        }
      }
      for (const [r, c] of affected) {
        const g = this.grid[r][c];
        if (!keep.has(key(r, c))) g.el.classList.add('pop');
      }
      this.hooks.onClear(affected);
      const points = affected.length * 10 * cascade + plans.length * 50;
      this.hooks.onScore(points, cascade);
      if (cascade > 1) this.hooks.onCascade(cascade);
      await sleep(T_CLEAR);
      if (this.destroyed) return;

      for (const [r, c] of affected) {
        if (keep.has(key(r, c))) continue;
        this.grid[r][c].el.remove();
        this.grid[r][c] = null;
      }
      for (const p of plans) {
        if (!keep.has(key(p.r, p.c))) continue;
        const g = this.grid[p.r][p.c];
        this.setGem(g, p.color, p.special);
        g.el.classList.add('born');
        setTimeout(() => g.el.classList.remove('born'), 400);
      }

      this.collapse();
      await sleep(T_FALL + 20);
      if (this.destroyed) return;
    }

    if (!this.findMove()) {
      await this.reshuffle();
    }
    this.busy = false;
    this.hooks.onSettled();
    this.scheduleHint();
  }

  /** Gravity + refill. Gems fall past holes. */
  collapse() {
    const fresh = [];
    for (let c = 0; c < this.cols; c++) {
      const cells = [];
      for (let r = 0; r < this.rows; r++) if (this.mask[r][c]) cells.push(r);
      const gems = cells.map((r) => this.grid[r][c]).filter(Boolean);
      const missing = cells.length - gems.length;
      const newGems = [];
      for (let i = 0; i < missing; i++) newGems.push(this.makeGem(this.randomColor()));
      const all = [...newGems, ...gems];
      const top = cells[0] ?? 0;
      newGems.forEach((g, i) => {
        this.place(g, top - missing + i, c, false);
        fresh.push(g);
      });
      cells.forEach((r, i) => { this.grid[r][c] = all[i]; });
    }
    void this.el.offsetWidth; // flush start positions of new gems
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) this.place(this.grid[r][c], r, c, true);
      }
    }
  }

  async reshuffle() {
    this.hooks.onShuffle();
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const g = this.grid[r][c];
          if (g && !g.special && g.color !== PRISM) {
            g.color = this.randomColor();
          }
        }
      }
      if (this.findMatches().length === 0 && this.findMove()) break;
    }
    this.grid.forEach((row) => row.forEach((g) => {
      if (!g) return;
      this.setGem(g, g.color, g.special);
      g.el.classList.add('born');
      setTimeout(() => g.el.classList.remove('born'), 400);
    }));
    await sleep(420);
  }

  // -------------------------------------------------------------- Hints

  scheduleHint(delay = 7000) {
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.showHint(), delay);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    this.gemsLayer.querySelectorAll('.hint').forEach((e) => e.classList.remove('hint'));
  }

  showHint() {
    if (!this.canAct()) return false;
    this.clearHint();
    const m = this.findMove();
    if (!m) return false;
    if (m.swap) {
      m.swap.forEach(([r, c]) => this.grid[r][c].el.classList.add('hint'));
    } else {
      const [axis, i] = m.slide;
      const n = axis === 'h' ? this.cols : this.rows;
      for (let j = 0; j < n; j++) {
        const g = axis === 'h' ? this.grid[i][j] : this.grid[j][i];
        g?.el.classList.add('hint');
      }
    }
    return true;
  }
}
