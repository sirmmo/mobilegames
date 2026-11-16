// SVG gem artwork. Each colour also has a distinct shape so the games stay
// playable for colour-blind players. Artwork lives in one invisible sprite;
// gems reference it with <use>, which keeps the DOM light.

export const GEM_COLORS = [
  { name: 'ruby',     base: '#ff4d6d', light: '#ffb3c1', dark: '#a4133c' },
  { name: 'amber',    base: '#ff9f1c', light: '#ffd29a', dark: '#b35c00' },
  { name: 'topaz',    base: '#ffd60a', light: '#fff3a3', dark: '#a68a00' },
  { name: 'emerald',  base: '#2ec27e', light: '#a8f0c8', dark: '#0b6b3f' },
  { name: 'sapphire', base: '#3a86ff', light: '#b3d0ff', dark: '#0b3fa0' },
  { name: 'amethyst', base: '#b15cff', light: '#e2c2ff', dark: '#5e1a9e' },
  { name: 'pearl',    base: '#e8ecf4', light: '#ffffff', dark: '#8a93a8' },
];

const SHAPES = [
  '<circle cx="50" cy="50" r="38"/>',
  '<rect x="15" y="15" width="70" height="70" rx="14"/>',
  '<path d="M50 10 L90 84 Q92 88 87 88 L13 88 Q8 88 10 84 Z"/>',
  '<path d="M50 8 L90 50 L50 92 L10 50 Z"/>',
  '<path d="M50 9 L86 30 L86 70 L50 91 L14 70 L14 30 Z"/>',
  '<path d="M50 8 L61 37 L92 38 L68 57 L76 88 L50 70 L24 88 L32 57 L8 38 L39 37 Z"/>',
  '<path d="M35 10 L65 10 L90 35 L90 65 L65 90 L35 90 L10 65 L10 35 Z"/>',
];

const SHINE = '<ellipse cx="38" cy="32" rx="14" ry="8" fill="#fff" opacity=".55" transform="rotate(-25 38 32)"/>';

function buildSprite() {
  let defs = '';
  let symbols = '';
  GEM_COLORS.forEach((c, i) => {
    defs += `<radialGradient id="gem-grad-${i}" cx="35%" cy="30%" r="75%">
<stop offset="0" stop-color="${c.light}"/><stop offset=".45" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/>
</radialGradient>`;
    symbols += `<symbol id="gem-${i}" viewBox="0 0 100 100">
<g fill="url(#gem-grad-${i})" stroke="${c.dark}" stroke-width="3" stroke-linejoin="round">${SHAPES[i]}</g>${SHINE}</symbol>`;
  });
  defs += `<linearGradient id="gem-grad-prism" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#ff4d6d"/><stop offset=".2" stop-color="#ff9f1c"/>
<stop offset=".4" stop-color="#ffd60a"/><stop offset=".6" stop-color="#2ec27e"/>
<stop offset=".8" stop-color="#3a86ff"/><stop offset="1" stop-color="#b15cff"/>
</linearGradient>`;
  symbols += `<symbol id="gem-prism" viewBox="0 0 100 100">
<circle cx="50" cy="50" r="40" fill="url(#gem-grad-prism)" stroke="#fff" stroke-width="4"/>
<circle cx="50" cy="50" r="15" fill="#fff" opacity=".85"/>${SHINE}</symbol>`;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `<defs>${defs}</defs>${symbols}`;
  document.body.prepend(svg);
}

let built = false;
function ensureSprite() {
  if (!built) { buildSprite(); built = true; }
}

/** Markup for gem `color` (0-6), or the prism gem when color is 'prism'. */
export function gemSVG(color) {
  ensureSprite();
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#gem-${color}"/></svg>`;
}
