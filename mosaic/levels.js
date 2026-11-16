// Pictures for Jewel Mosaic. '.' is empty background (no slot); every other
// character is a jewel colour from `pal`.
import { LEVELS as SMALL } from '../paint/levels.js';

const BIG = {
  strawberry: {
    name: 'Strawberry',
    pal: { g: '#2d6a4f', l: '#74c69d', r: '#e63946', y: '#ffe066', s: '#fff0f3' },
    art: [
      'sssslgssss',
      'sssglgggss',
      'ssrrglrrss',
      'srrrrrrrrs',
      'srryrrryrs',
      'srrrrrrrrs',
      'ssrryrrrss',
      'ssrrrrrrss',
      'sssrryrsss',
      'ssssrrssss',
    ],
  },
  icecream: {
    name: 'Ice cream',
    pal: { p: '#ffafcc', w: '#ffffff', m: '#52b788', y: '#e9c46a', o: '#bc6c25' },
    art: [
      '...pppp...',
      '..ppwppp..',
      '.ppppppmp.',
      '.pmpppppp.',
      '.pppppmpp.',
      '..yyyyyy..',
      '..yoyyoy..',
      '...yyyy...',
      '...yoyy...',
      '....yy....',
    ],
  },
  penguin: {
    name: 'Penguin',
    pal: { s: '#bde0fe', k: '#22223b', w: '#f8f9fa', b: '#4cc9f0', o: '#fb8500' },
    art: [
      'ssskkkksss',
      'sskkkkkkss',
      'skkwwwwkks',
      'skwbwwbwks',
      'skwwoowwks',
      'kkwwwwwwkk',
      'kkwwwwwwkk',
      'skwwwwwwks',
      'sskwwwwkss',
      'ssoossooss',
    ],
  },
  owl: {
    name: 'Owl',
    pal: { g: '#95d5b2', b: '#7f5539', w: '#fefae0', k: '#212529', o: '#f77f00', t: '#ddb892' },
    art: [
      'gbbggggbbg',
      'gbbbbbbbbg',
      'bwwwbbwwwb',
      'bwkwbbwkwb',
      'bwwwoowwwb',
      'bbbboobbbb',
      'bbttttttbb',
      'bbtbttbtbb',
      'gbttttttbg',
      'ggoggggogg',
    ],
  },
  sailboat: {
    name: 'Sailboat',
    pal: { s: '#a2d2ff', w: '#ffffff', r: '#e63946', b: '#7f4f24', n: '#1d3557', c: '#219ebc' },
    art: [
      'sssssbssss',
      'sssswbssss',
      'ssswwbrsss',
      'sswwwbrrss',
      'swwwwbrrrs',
      'sssssbssss',
      'nnnnnnnnnn',
      'snnnnnnnns',
      'cwccwccwcc',
      'cccccccccc',
    ],
  },
};

const small = Object.fromEntries(SMALL.map((l) => [l.name, l]));

export const LEVELS = [
  small.Heart, small.Mushroom, BIG.strawberry, small.Fish, BIG.icecream,
  small.Sunrise, BIG.penguin, small.House, BIG.owl, small.Butterfly,
  BIG.sailboat, small.Cat, small.Tree, small.Rocket, small.Rainbow,
].map(({ name, pal, art }) => ({ name, pal, art }));
