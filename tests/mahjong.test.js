// Checks layouts and that every deal can be cleared (by replaying the dealer's order).
import assert from 'node:assert/strict';
import { LAYOUTS } from '../mahjong/layouts.js';
import { newGame, isFree, availablePairs, reshuffle } from '../mahjong/game.js';
import { fullSet, allPairs, groupOf } from '../mahjong/tiles.js';

assert.equal(fullSet().length, 144);
assert.equal(allPairs().length, 72);

function replay(tiles) {
  // The dealer records the order it removed pairs in; replaying that order
  // proves the deal can be cleared.
  const steps = new Map();
  tiles.forEach((t) => {
    if (!steps.has(t.step)) steps.set(t.step, []);
    steps.get(t.step).push(t);
  });
  for (const k of [...steps.keys()].sort((a, b) => a - b)) {
    const [a, b] = steps.get(k);
    const present = tiles.filter((t) => !t.removed);
    if (!isFree(a, present) || !isFree(b, present) || groupOf(a.face) !== groupOf(b.face)) return false;
    a.removed = b.removed = true;
  }
  return tiles.every((t) => t.removed);
}

for (const [key, layout] of Object.entries(LAYOUTS)) {
  const pos = layout.build();
  assert.equal(pos.length % 2, 0, `${key} has an even tile count`);
  const keys = new Set(pos.map((p) => p.join(',')));
  assert.equal(keys.size, pos.length, `${key} has no duplicate positions`);
  let solved = 0;
  let t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    const tiles = newGame(pos);
    // Face counts: every group appears an even number of times.
    const counts = {};
    tiles.forEach((t) => { counts[groupOf(t.face)] = (counts[groupOf(t.face)] || 0) + 1; });
    Object.values(counts).forEach((n) => assert.equal(n % 2, 0));
    if (replay(tiles)) solved++;
    tiles.forEach((t) => { t.removed = false; });
  }
  console.log(`${key.padEnd(10)} tiles=${pos.length} solved ${solved}/20 in ${Date.now() - t0}ms`);
  assert.equal(solved, 20, `${key}: deals should be solvable`);

  // Reshuffle mid-game keeps the face multiset.
  const tiles = newGame(pos);
  const [a, b] = availablePairs(tiles)[0];
  a.removed = b.removed = true;
  const before = tiles.filter((t) => !t.removed).map((t) => t.face).sort().join();
  reshuffle(tiles);
  const after = tiles.filter((t) => !t.removed).map((t) => t.face).sort().join();
  assert.equal(before, after);
}
console.log('ok');
