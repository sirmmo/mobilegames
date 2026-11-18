# Mobile Games

Tile, gem and logic puzzle games that run in any mobile browser. Plain HTML, CSS and
JavaScript modules: no build step, no dependencies, works offline once loaded.

| Game | Folder | What it is |
| --- | --- | --- |
| **Mahjong Pairs** | `mahjong/` | Mahjong solitaire: remove matching pairs of free tiles. Layouts: Turtle, Pagoda, Butterfly, Pyramid. Every deal can be cleared. Undo, hint, shuffle, best times. |
| **Jewel Mosaic** | `mosaic/` | A jewel picture where every jewel starts in the wrong slot. Each slot shows the colour it needs; move jewels straight into free matching slots, or park them in a 4-slot tray to free space. *Groups* mode moves touching same-colour jewels together, keeping their shape. 15 pictures, undo, hints, progress saved. |
| **Crowns** | `queens/` | Queens logic puzzle: place one crown in every row, column and coloured region, with no two crowns touching (not even diagonally). 200 puzzles from 6×6 to 12×12, each with exactly one solution, ordered by size and difficulty. × notes, drag to mark, optional auto-marking, hints, best times. |
| **Prism Painter** | `paint/` | Match three where every cleared square gets painted. Fill the canvas to reveal a hidden pixel-art picture. 10 pictures, then harder repeats. |
| **Gemfall** | `gems/` | Match three with four modes: Classic (target score in limited moves), Blitz (90 seconds), Shift (slide whole rows and columns), Zen (endless). |

Special gems in the match-three games: a line of four makes a line gem (clears its
row or column), an L or T shape makes a bomb (clears 3×3), a line of five makes a
prism (swap it with a gem to clear every gem of that colour).

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # mahjong deals + queens puzzles checks (Node 16+)
node tools/gen-queens.mjs     # regenerate queens/puzzles.js (fixed seed)
```

## Layout

- `shared/` – styles, helpers, gem artwork and the match-three engine (`match3.js`) used by Gemfall and Prism Painter.
- `mahjong/game.js` – pure mahjong logic (free-tile rule, solvable dealer), tested in `tests/`.
- `sw.js` – offline cache. Bump `CACHE` when releasing changes.

Progress and best scores are stored in the browser's `localStorage`.
