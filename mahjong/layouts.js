// Board layouts. Positions are [x, y, z] in half-tile units: a tile covers
// x..x+2 horizontally and y..y+2 vertically on layer z.

function rect(out, z, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x * 2, y * 2, z]);
}

function rows(out, z, spec) {
  // spec: [[row, fromCol, toCol], ...]
  for (const [y, a, b] of spec) for (let x = a; x <= b; x++) out.push([x * 2, y * 2, z]);
}

function turtle() {
  const t = [];
  rows(t, 0, [[0, 1, 12], [1, 3, 10], [2, 2, 11], [3, 1, 12], [4, 1, 12], [5, 2, 11], [6, 3, 10], [7, 1, 12]]);
  t.push([0, 7, 0], [26, 7, 0], [28, 7, 0]);
  rect(t, 1, 4, 9, 1, 6);
  rect(t, 2, 5, 8, 2, 5);
  rect(t, 3, 6, 7, 3, 4);
  t.push([13, 7, 4]);
  return t;
}

function pagoda() {
  const t = [];
  rect(t, 0, 0, 7, 0, 9);
  rect(t, 1, 1, 6, 1, 8);
  rect(t, 2, 2, 5, 3, 6);
  return t;
}

function pyramid() {
  const t = [];
  rect(t, 0, 0, 9, 0, 5);
  rect(t, 1, 1, 8, 1, 4);
  rect(t, 2, 2, 7, 2, 3);
  t.push([8, 5, 3], [10, 5, 3]);
  return t;
}

function butterfly() {
  // Two wings joined by a tall body; portrait friendly.
  const t = [];
  rows(t, 0, [
    [0, 0, 2], [0, 5, 7],
    [1, 0, 3], [1, 4, 7],
    [2, 0, 7], [3, 0, 7], [4, 1, 6], [5, 1, 6],
    [6, 0, 7], [7, 0, 7],
    [8, 0, 3], [8, 4, 7],
    [9, 0, 2], [9, 5, 7],
  ]);
  rows(t, 1, [[1, 0, 2], [1, 5, 7], [2, 1, 2], [2, 5, 6], [7, 1, 2], [7, 5, 6], [8, 0, 2], [8, 5, 7]]);
  rect(t, 1, 3, 4, 2, 7);
  rect(t, 2, 3, 4, 3, 6);
  t.push([7, 6, 3], [7, 10, 3]);
  return t;
}

export const LAYOUTS = {
  turtle: { name: 'Turtle', desc: 'The classic. 144 tiles, best in landscape.', build: turtle },
  pagoda: { name: 'Pagoda', desc: '144 tiles in a tall stack, made for phones.', build: pagoda },
  butterfly: { name: 'Butterfly', desc: 'Two wings around a tall body. Portrait.', build: butterfly },
  pyramid: { name: 'Pyramid', desc: 'A quick game with 106 tiles.', build: pyramid },
};
