// Checks every Queens puzzle: right size, n connected regions, the stored
// solution is valid, and it is the only solution.
import { PUZZLES } from '../queens/puzzles.js';
import { parse, conflicts } from '../queens/logic.js';

let fail = 0;
const bad = (i, msg) => { fail++; console.error(`puzzle ${i + 1}: ${msg}`); };

// Independent solver: column-by-column with full attack checks.
function countSolutions(n, reg) {
  let count = 0;
  const q = [];
  const ok = (r, c) => q.every(([r2, c2]) =>
    r2 !== r && c2 !== c && reg[r2 * n + c2] !== reg[r * n + c] && (Math.abs(r2 - r) > 1 || Math.abs(c2 - c) > 1));
  const go = (c) => {
    if (count > 1) return;
    if (c === n) { count++; return; }
    for (let r = 0; r < n; r++) if (ok(r, c)) { q.push([r, c]); go(c + 1); q.pop(); }
  };
  go(0);
  return count;
}

const sizes = {};
PUZZLES.forEach((raw, i) => {
  const p = parse(raw);
  const { n, regions, solution } = p;
  sizes[n] = (sizes[n] || 0) + 1;
  if (n < 6 || n > 12) bad(i, `size ${n}`);
  if (regions.length !== n * n) bad(i, 'region string length');
  const ids = new Set(regions);
  if (ids.size !== n) bad(i, `${ids.size} regions for n=${n}`);
  for (const k of ids) {
    const cells = regions.map((r, j) => (r === k ? j : -1)).filter((j) => j >= 0);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const j = stack.pop();
      const r = Math.floor(j / n), c = j % n;
      for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
        const t = rr * n + cc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[t] === k && !seen.has(t)) { seen.add(t); stack.push(t); }
      }
    }
    if (seen.size !== cells.length) bad(i, `region ${k} not connected`);
  }
  const queens = solution.map((c, r) => r * n + c);
  if (conflicts(p, queens).size) bad(i, 'stored solution has conflicts');
  const sols = countSolutions(n, regions);
  if (sols !== 1) bad(i, `${sols} solutions`);
});

if (PUZZLES.length !== 200) bad(-1, `expected 200 puzzles, got ${PUZZLES.length}`);
console.log('sizes', sizes);
console.log(fail ? `${fail} failures` : `queens: all ${PUZZLES.length} puzzles OK`);
process.exit(fail ? 1 : 0);
