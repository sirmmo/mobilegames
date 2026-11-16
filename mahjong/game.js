// Pure game logic for Mahjong Pairs (no DOM), so it can be tested in Node.

import { groupOf, allPairs } from './tiles.js';

const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

/** A tile is free when nothing lies on it and its left or right side is open. */
export function isFree(t, tiles) {
  let left = false;
  let right = false;
  for (const o of tiles) {
    if (o === t || o.removed) continue;
    if (o.z > t.z && overlaps(o, t)) return false;
    if (o.z === t.z && Math.abs(o.y - t.y) < 2) {
      if (o.x === t.x - 2) left = true;
      else if (o.x === t.x + 2) right = true;
    }
  }
  return !(left && right);
}

function pickWeighted(list, rnd) {
  // Prefer high tiles: dismantling stacks first avoids dead ends.
  let total = 0;
  for (const t of list) total += t.z + 1;
  let r = rnd() * total;
  for (const t of list) {
    r -= t.z + 1;
    if (r <= 0) return t;
  }
  return list[list.length - 1];
}

/**
 * Assign faces to `tiles` (objects with x, y, z) so that the deal can be
 * cleared: we simulate removing pairs of free tiles and give each removed
 * pair matching faces. `pairs` is a list of [faceA, faceB].
 * Returns true on success (tiles get a .face), false if no deal was found.
 */
export function dealSolvable(tiles, pairs, rnd = Math.random, attempts = 400) {
  for (let a = 0; a < attempts; a++) {
    const live = tiles.map((t) => ({ t, x: t.x, y: t.y, z: t.z, removed: false }));
    const order = pairs.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let ok = true;
    let step = 0;
    for (const pair of order) {
      const present = live.filter((l) => !l.removed);
      const free = present.filter((l) => isFree(l, present));
      if (free.length < 2) { ok = false; break; }
      const first = pickWeighted(free, rnd);
      const rest = free.filter((l) => l !== first);
      const second = pickWeighted(rest, rnd);
      first.removed = second.removed = true;
      first.face = pair[0];
      second.face = pair[1];
      first.step = second.step = step++;
    }
    if (ok) {
      live.forEach((l) => { l.t.face = l.face; l.t.step = l.step; });
      return true;
    }
  }
  return false;
}

/** Build a new game for a layout's positions. */
export function newGame(positions, rnd = Math.random) {
  const tiles = positions.map(([x, y, z], id) => ({ id, x, y, z, face: null, removed: false }));
  let pairs = allPairs();
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  pairs = pairs.slice(0, tiles.length / 2);
  if (!dealSolvable(tiles, pairs, rnd)) {
    // Extremely unlikely; fall back to a random deal.
    const faces = pairs.flat();
    tiles.forEach((t, i) => { t.face = faces[i]; });
  }
  return tiles;
}

/** Re-deal the faces of the remaining tiles, keeping their positions. */
export function reshuffle(tiles, rnd = Math.random) {
  const present = tiles.filter((t) => !t.removed);
  const byGroup = new Map();
  for (const t of present) {
    const g = groupOf(t.face);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(t.face);
  }
  const pairs = [];
  for (const list of byGroup.values()) {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  }
  if (dealSolvable(present, pairs, rnd, 200)) return true;
  // Positions admit no solvable deal (e.g. one tall stack): shuffle anyway.
  const faces = pairs.flat();
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [faces[i], faces[j]] = [faces[j], faces[i]];
  }
  present.forEach((t, i) => { t.face = faces[i]; });
  return false;
}

export const matches = (a, b) => a !== b && groupOf(a.face) === groupOf(b.face);

/** All currently playable pairs. */
export function availablePairs(tiles) {
  const present = tiles.filter((t) => !t.removed);
  const free = present.filter((t) => isFree(t, present));
  const groups = new Map();
  for (const t of free) {
    const g = groupOf(t.face);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  const out = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
  }
  return out;
}
