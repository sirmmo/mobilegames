// Generates queens/puzzles.js: 200 region puzzles (6x6 .. 12x12), each with
// exactly one solution. Run: node tools/gen-queens.mjs
import { writeFileSync } from 'node:fs';

let seed = 20261118;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Random queen placement: one per row/column, no two touching.
function placeQueens(n) {
  const cols = [];
  const used = new Set();
  const go = (r) => {
    if (r === n) return true;
    const order = [...Array(n).keys()].sort(() => rnd() - 0.5);
    for (const c of order) {
      if (used.has(c) || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      cols[r] = c; used.add(c);
      if (go(r + 1)) return true;
      used.delete(c);
    }
    return false;
  };
  go(0);
  return cols;
}

const nb4 = (i, n) => {
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

function growRegions(n, cols) {
  const reg = new Array(n * n).fill(-1);
  cols.forEach((c, r) => { reg[r * n + c] = r; });
  // Mildly uneven weights give some variety; dividing by the current size
  // keeps any one region from swallowing the board.
  const w = cols.map(() => 0.6 + rnd() * 1.2);
  const size = cols.map(() => 1);
  let left = n * n - n;
  while (left > 0) {
    const frontier = [];
    for (let i = 0; i < n * n; i++) {
      if (reg[i] !== -1) continue;
      for (const j of nb4(i, n)) if (reg[j] !== -1) frontier.push([i, reg[j]]);
    }
    const wt = (k) => w[k] / size[k];
    let tot = frontier.reduce((s, [, k]) => s + wt(k), 0);
    let x = rnd() * tot;
    for (const [i, k] of frontier) {
      x -= wt(k);
      if (x <= 0) { if (reg[i] === -1) { reg[i] = k; size[k]++; left--; } break; }
    }
  }
  return reg;
}

// Solutions as column arrays; stops after `limit`.
function solve(n, reg, limit = 2) {
  const sols = [];
  const cols = [];
  const usedC = new Array(n).fill(false);
  const usedR = new Array(n).fill(false);
  let nodes = 0;
  const go = (r) => {
    if (sols.length >= limit) return;
    if (r === n) { sols.push(cols.slice()); return; }
    for (let c = 0; c < n; c++) {
      const k = reg[r * n + c];
      if (usedC[c] || usedR[k] || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      nodes++;
      cols[r] = c; usedC[c] = usedR[k] = true;
      go(r + 1);
      usedC[c] = usedR[k] = false;
    }
  };
  go(0);
  return { sols, nodes };
}

function connectedWithout(n, reg, k, skip) {
  const cells = [];
  for (let i = 0; i < n * n; i++) if (reg[i] === k && i !== skip) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const q = [cells[0]];
  while (q.length) {
    const i = q.pop();
    for (const j of nb4(i, n)) if (j !== skip && reg[j] === k && !seen.has(j)) { seen.add(j); q.push(j); }
  }
  return seen.size === cells.length;
}

// Break alternative solutions by moving one of their queen cells into a
// neighbouring region that already holds another of their queens.
function makeUnique(n, reg, cols) {
  const truth = new Set(cols.map((c, r) => r * n + c));
  for (let iter = 0; iter < 400; iter++) {
    const { sols } = solve(n, reg, 2);
    if (sols.length === 1) return true;
    const alt = sols.find((s) => s.some((c, r) => c !== cols[r]));
    const altCells = alt.map((c, r) => r * n + c).filter((i) => !truth.has(i));
    const altRegions = new Set(alt.map((c, r) => reg[r * n + c]));
    const moves = [];
    for (const i of altCells) {
      for (const j of nb4(i, n)) {
        const k = reg[j];
        if (k === reg[i] || !altRegions.has(k)) continue;
        if (connectedWithout(n, reg, reg[i], i)) moves.push([i, k]);
      }
    }
    if (!moves.length) return false;
    const [i, k] = pick(moves);
    reg[i] = k;
  }
  return false;
}

// Difficulty proxy: how much a row-by-row search has to branch.
function difficulty(n, reg) {
  return solve(n, reg, 2).nodes / n;
}

const PLAN = { 6: 30, 7: 30, 8: 30, 9: 30, 10: 30, 11: 25, 12: 25 };
const out = [];
for (const [ns, count] of Object.entries(PLAN)) {
  const n = +ns;
  const batch = [];
  const seenKeys = new Set();
  let tries = 0;
  while (batch.length < count) {
    tries++;
    const cols = placeQueens(n);
    const reg = growRegions(n, cols);
    if (!makeUnique(n, reg, cols)) continue;
    // Every region must stay connected and non-empty.
    let ok = true;
    for (let k = 0; k < n && ok; k++) ok = connectedWithout(n, reg, k, -1);
    if (!ok) continue;
    // Keep shapes balanced: at most one single-cell region, none huge.
    const sizes = Array.from({ length: n }, (_, k) => reg.filter((x) => x === k).length);
    if (sizes.filter((z) => z === 1).length > 1 || Math.max(...sizes) > n * n * 0.3) continue;
    // Relabel regions in reading order so the data is canonical.
    const map = new Map();
    const lab = reg.map((k) => { if (!map.has(k)) map.set(k, map.size); return map.get(k); });
    const regions = lab.map((k) => 'abcdefghijkl'[k]).join('');
    if (seenKeys.has(regions)) continue;
    seenKeys.add(regions);
    batch.push({ n, regions, sol: cols.map((c) => c.toString(16)).join(''), d: difficulty(n, reg) });
  }
  batch.sort((a, b) => a.d - b.d);
  out.push(...batch);
  console.log(`${n}x${n}: ${count} puzzles in ${tries} tries`);
}

const body = out.map((p) => `  '${p.regions}:${p.sol}',`).join('\n');
writeFileSync(new URL('../queens/puzzles.js', import.meta.url),
  `// Generated by tools/gen-queens.mjs: "<regions row-major>:<solution column per row, hex>".\n` +
  `// Every puzzle has exactly one solution.\nexport const PUZZLES = [\n${body}\n];\n`);
console.log('total', out.length);
