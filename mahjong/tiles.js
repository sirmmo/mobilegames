// Tile set and face artwork (SVG, drawn in a 60x80 box).

const CJK = `font-family="'Noto Serif CJK SC','Noto Serif CJK JP','Songti SC','SimSun','MS Mincho',serif"`;
const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLUE = '#1f5fa8';
const GREEN = '#22844a';
const RED = '#c0392b';
const INK = '#1b2440';

/** All 144 faces. Flowers and seasons match any tile of their own group. */
export function fullSet() {
  const faces = [];
  for (const suit of ['d', 'b', 'c']) {
    for (let n = 1; n <= 9; n++) for (let k = 0; k < 4; k++) faces.push(suit + n);
  }
  for (const w of ['wE', 'wS', 'wW', 'wN', 'rR', 'rG', 'rW']) for (let k = 0; k < 4; k++) faces.push(w);
  for (let n = 1; n <= 4; n++) faces.push('f' + n, 's' + n);
  return faces;
}

export const groupOf = (face) => (face[0] === 'f' ? 'F' : face[0] === 's' ? 'S' : face);

/** 72 matching pairs drawn from the full set. */
export function allPairs() {
  const byGroup = new Map();
  for (const f of fullSet()) {
    const g = groupOf(f);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(f);
  }
  const pairs = [];
  for (const list of byGroup.values()) {
    for (let i = 0; i < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  }
  return pairs;
}

const DOTS = {
  1: { r: 17, p: [[30, 40]] },
  2: { r: 10, p: [[30, 21], [30, 59]] },
  3: { r: 9, p: [[15, 15], [30, 40], [45, 65]] },
  4: { r: 9, p: [[18, 22], [42, 22], [18, 58], [42, 58]] },
  5: { r: 8, p: [[16, 18], [44, 18], [30, 40], [16, 62], [44, 62]] },
  6: { r: 8, p: [[19, 16], [41, 16], [19, 40], [41, 40], [19, 64], [41, 64]] },
  7: { r: 6.5, p: [[14, 12], [30, 22], [46, 32], [19, 50], [41, 50], [19, 68], [41, 68]] },
  8: { r: 7, p: [[19, 12], [41, 12], [19, 31], [41, 31], [19, 50], [41, 50], [19, 69], [41, 69]] },
  9: { r: 7, p: [[14, 15], [30, 15], [46, 15], [14, 40], [30, 40], [46, 40], [14, 65], [30, 65], [46, 65]] },
};

function dot(x, y, r, color) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="none" stroke="#fff" stroke-width="${r * 0.22}"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#fff"/>`;
}

function dotsFace(n) {
  const { r, p } = DOTS[n];
  const colors = [BLUE, GREEN, RED];
  return p.map(([x, y], i) => {
    let color = colors[i % 3];
    if (n === 1) color = RED;
    if (n === 7) color = i < 3 ? GREEN : RED;
    if (n === 9) color = colors[Math.floor(i / 3)];
    return dot(x, y, r, color);
  }).join('');
}

function stick(x, y, h, color) {
  const w = 6.5;
  return `<g><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="${color}"/>` +
    `<rect x="${x - w / 2 - 1}" y="${y - 1.2}" width="${w + 2}" height="2.4" rx="1" fill="${color}" stroke="#fff" stroke-width=".6"/>` +
    `<line x1="${x}" y1="${y - h / 2 + 3}" x2="${x}" y2="${y + h / 2 - 3}" stroke="#fff" stroke-width="1" opacity=".55"/></g>`;
}

const BAMBOO = {
  2: [[30, 21], [30, 59]],
  3: [[30, 21], [18, 59], [42, 59]],
  4: [[18, 21], [42, 21], [18, 59], [42, 59]],
  5: [[16, 21], [44, 21], [30, 40, 'r'], [16, 59], [44, 59]],
  6: [[14, 21], [30, 21], [46, 21], [14, 59], [30, 59], [46, 59]],
  7: [[30, 14, 'r'], [14, 42], [30, 42], [46, 42], [14, 66], [30, 66], [46, 66]],
  8: [[12, 21], [24, 21], [36, 21], [48, 21], [12, 59], [24, 59], [36, 59], [48, 59]],
  9: [[14, 14], [30, 14, 'r'], [46, 14], [14, 40], [30, 40, 'r'], [46, 40], [14, 66], [30, 66, 'r'], [46, 66]],
};

function bambooFace(n) {
  if (n === 1) {
    // A stylised bird on a bamboo shoot.
    return `<path d="M18 62 Q30 70 44 60" stroke="${GREEN}" stroke-width="5" fill="none" stroke-linecap="round"/>
<ellipse cx="30" cy="40" rx="13" ry="16" fill="${GREEN}"/>
<circle cx="31" cy="20" r="8" fill="${RED}"/>
<path d="M38 19 L46 21 L38 23 Z" fill="#e0a100"/>
<circle cx="33" cy="18" r="1.6" fill="#fff"/>
<path d="M18 36 Q8 30 12 48 Q18 46 22 44 Z" fill="${BLUE}"/>
<path d="M30 54 L24 70 M30 54 L36 70" stroke="${RED}" stroke-width="2.5"/>`;
  }
  const h = n === 7 || n === 9 ? 21 : 28;
  return BAMBOO[n].map(([x, y, r]) => stick(x, y, h, r ? RED : GREEN)).join('');
}

function charFace(n) {
  return `<text x="30" y="33" text-anchor="middle" font-size="27" fill="${INK}" ${CJK}>${NUMERALS[n - 1]}</text>
<text x="30" y="69" text-anchor="middle" font-size="27" fill="${RED}" ${CJK}>萬</text>`;
}

function label(text, color = INK) {
  return `<text x="5" y="12" font-size="10" font-weight="700" fill="${color}" font-family="system-ui,sans-serif">${text}</text>`;
}

function flower(n) {
  const colors = ['#e84a7f', '#7b4fd6', '#f2a51a', '#2a9fd6'];
  const c = colors[n - 1];
  let petals = '';
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    petals += `<ellipse cx="${30 + Math.sin(a) * 10}" cy="${36 - Math.cos(a) * 10}" rx="7" ry="9" fill="${c}" transform="rotate(${i * 72} ${30 + Math.sin(a) * 10} ${36 - Math.cos(a) * 10})"/>`;
  }
  return `<path d="M30 46 Q28 60 30 74" stroke="${GREEN}" stroke-width="3" fill="none"/>
<ellipse cx="38" cy="62" rx="7" ry="3.5" fill="${GREEN}" transform="rotate(-30 38 62)"/>
${petals}<circle cx="30" cy="36" r="5" fill="#ffd60a"/>${label(n, c)}`;
}

function season(n) {
  const art = {
    1: `<path d="M30 70 L30 40" stroke="${GREEN}" stroke-width="3"/><ellipse cx="22" cy="38" rx="9" ry="5" fill="#5cc26f" transform="rotate(-35 22 38)"/><ellipse cx="38" cy="32" rx="9" ry="5" fill="#5cc26f" transform="rotate(35 38 32)"/><circle cx="30" cy="22" r="6" fill="#ff8fab"/>`,
    2: `<circle cx="30" cy="40" r="11" fill="#ffb703"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((d) => `<line x1="30" y1="22" x2="30" y2="15" stroke="#fb8500" stroke-width="3" stroke-linecap="round" transform="rotate(${d} 30 40)"/>`).join('')}`,
    3: `<path d="M30 18 L36 32 L48 28 L42 42 L52 48 L36 52 L34 64 L30 58 L26 64 L24 52 L8 48 L18 42 L12 28 L24 32 Z" fill="#d9480f"/><path d="M30 58 L30 74" stroke="#7f4f24" stroke-width="2.5"/>`,
    4: `<g stroke="#3a86ff" stroke-width="3" stroke-linecap="round">${[0, 60, 120].map((d) => `<line x1="30" y1="22" x2="30" y2="58" transform="rotate(${d} 30 40)"/>`).join('')}</g><circle cx="30" cy="40" r="4" fill="#3a86ff"/>`,
  };
  const names = ['Sp', 'Su', 'Au', 'Wi'];
  return art[n] + label(names[n - 1], '#555');
}

function bigChar(ch, color) {
  return `<text x="30" y="56" text-anchor="middle" font-size="40" fill="${color}" ${CJK}>${ch}</text>`;
}

const cache = new Map();

/** Inner SVG markup for a face id. */
export function faceSVG(face) {
  if (cache.has(face)) return cache.get(face);
  const t = face[0];
  const n = Number(face.slice(1));
  let body = '';
  if (t === 'd') body = dotsFace(n);
  else if (t === 'b') body = bambooFace(n);
  else if (t === 'c') body = charFace(n) + label(n);
  else if (face === 'wE') body = bigChar('東', INK) + label('E');
  else if (face === 'wS') body = bigChar('南', INK) + label('S');
  else if (face === 'wW') body = bigChar('西', INK) + label('W');
  else if (face === 'wN') body = bigChar('北', INK) + label('N');
  else if (face === 'rR') body = bigChar('中', RED);
  else if (face === 'rG') body = bigChar('發', GREEN);
  else if (face === 'rW') body = `<rect x="12" y="14" width="36" height="52" rx="4" fill="none" stroke="${BLUE}" stroke-width="3"/><rect x="18" y="20" width="24" height="40" rx="2" fill="none" stroke="${BLUE}" stroke-width="1.5"/>`;
  else if (t === 'f') body = flower(n);
  else if (t === 's') body = season(n);
  const svg = `<svg viewBox="0 0 60 80" aria-hidden="true">${body}</svg>`;
  cache.set(face, svg);
  return svg;
}

const NAMES = { d: 'Dots', b: 'Bamboo', c: 'Characters' };
const HONORS = { wE: 'East wind', wS: 'South wind', wW: 'West wind', wN: 'North wind', rR: 'Red dragon', rG: 'Green dragon', rW: 'White dragon' };
export function faceName(face) {
  if (HONORS[face]) return HONORS[face];
  if (face[0] === 'f') return 'Flower ' + face[1];
  if (face[0] === 's') return 'Season ' + face[1];
  return `${face.slice(1)} of ${NAMES[face[0]]}`;
}
