// Pure Queens logic, shared by the game and the tests.

export function parse(raw) {
  const [reg, sol] = raw.split(':');
  const n = Math.round(Math.sqrt(reg.length));
  return {
    n,
    regions: [...reg].map((ch) => ch.charCodeAt(0) - 97),
    solution: [...sol].map((h) => parseInt(h, 16)),
  };
}

/** Cells (indices) of queens that break a rule: same row, column, region, or touching. */
export function conflicts({ n, regions }, queens) {
  const bad = new Set();
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const i = queens[a], j = queens[b];
      const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
      if (ri === rj || ci === cj || regions[i] === regions[j] ||
          (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
        bad.add(i); bad.add(j);
      }
    }
  }
  return bad;
}

/** Cells a queen at i rules out (row, column, region, neighbours), excluding i. */
export function attacks({ n, regions }, i) {
  const r = Math.floor(i / n), c = i % n, out = [];
  for (let j = 0; j < n * n; j++) {
    if (j === i) continue;
    const rj = Math.floor(j / n), cj = j % n;
    if (rj === r || cj === c || regions[j] === regions[i] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) out.push(j);
  }
  return out;
}
