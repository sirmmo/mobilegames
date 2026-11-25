#!/bin/sh
# Builds each game for Wavedash (https://wavedash.com) and uploads it as a new build:
#   sh tools/wavedash.sh            every game
#   sh tools/wavedash.sh queens     one game: gems, mahjong, mosaic, paint or queens
# Each game is its own Wavedash game, configured in wavedash/<game>/wavedash.toml. This fills its
# upload_dir, wavedash/<game>/build/: the game's page as index.html, with its files, shared/ and
# the icon (no hub, no offline copy, no tests or tools). With the `wavedash` CLI on PATH it then
# runs `wavedash build push` there (WAVEDASH_TOKEN from the environment); without it, or with
# WAVEDASH_DRY_RUN=1, it only says what it would push. Publishing a build is a separate step.
# The game id: WAVEDASH_GAME_ID_<GAME> (e.g. WAVEDASH_GAME_ID_QUEENS), else WAVEDASH_GAME_ID
# when pushing one game, else game_id in the game's wavedash.toml.
set -e
cd "$(dirname "$0")/.."
GAMES="gems mahjong mosaic paint queens"
only=${1:-all}
case " all $GAMES " in
  *" $only "*) ;;
  *) echo "unknown game '$only': one of $GAMES, or all" >&2; exit 2 ;;
esac

# Edits a file in place with sed (the same on GNU and BSD).
edit() { f=$1; shift; sed "$@" "$f" > "$f.tmp" && mv "$f.tmp" "$f"; }

# Every relative path the build's pages and scripts name must be in it; none may start at /.
check() {
  b=$1
  [ -f "$b/index.html" ] || { echo "$b/index.html is missing" >&2; exit 1; }
  bad=$(find "$b" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' \) ! -path '*/vendor/*' ! -name '*.min.js' |
    while read -r f; do
      d=$(dirname "$f")
      { grep -oE '(src|href)="[^"]*"' "$f" | sed -E 's/^(src|href)="//; s/"$//'
        grep -oE "(from|import\\() *['\"]\\.{1,2}/[^'\"]*['\"]" "$f" | sed -E "s/^(from|import\\() *['\"]//; s/['\"]\$//"
      } | while read -r r; do
        case $r in '' | '#'* | *'://'* | '//'* | data:* | mailto:* | javascript:* | *'$'* | *'{'*) continue ;; /*) echo "$f: $r starts at /"; continue ;; esac
        p=${r%%[?#]*}
        [ -z "$p" ] || [ -e "$d/$p" ] || echo "$f: $r is not in the build"
      done
    done)
  [ -z "$bad" ] || { echo "$bad" >&2; exit 1; }
}

# The variable that holds a game's id, and the id: game_id <game> <folder of its wavedash.toml>.
id_var() { echo "WAVEDASH_GAME_ID_$(echo "$1" | tr 'a-z-' 'A-Z_')"; }
game_id() {
  eval "id=\${$(id_var "$1"):-}"
  [ -n "$id" ] || [ "$only" = all ] || id=${WAVEDASH_GAME_ID:-}
  [ -n "$id" ] || id=$(sed -n 's/^game_id *= *"\([^"]*\)".*/\1/p' "$2/wavedash.toml")
  echo "$id"
}

# Uploads one build: push <game> <folder of its wavedash.toml> <its upload_dir>.
push() {
  slug=$1 conf=$2 build=$3
  check "$build"
  id=$(game_id "$slug" "$conf")
  msg=${WAVEDASH_MESSAGE:-"$slug $(git rev-parse --short HEAD 2>/dev/null || echo local)"}
  size=$(du -sh "$build" | cut -f1)
  if command -v wavedash >/dev/null 2>&1 && [ -z "${WAVEDASH_DRY_RUN:-}" ]; then
    case $id in '' | SET-ME) echo "$slug: no Wavedash game id: set $(id_var "$slug") or game_id in $conf/wavedash.toml" >&2; exit 1 ;; esac
    [ -n "${WAVEDASH_TOKEN:-}" ] || echo "$slug: WAVEDASH_TOKEN is not set; the CLI uses its own login, if any" >&2
    echo "$slug: pushing $build ($size) to Wavedash game $id"
    (cd "$conf" && WAVEDASH_GAME_ID=$id wavedash build push -m "$msg")
  else
    echo "$slug: would push $build ($size) to Wavedash game ${id:-SET-ME}: cd $conf && wavedash build push -m \"$msg\""
  fi
}

# The game's folder becomes the build's root: paths lose their ../, the way back to the hub and
# the offline copy (sw.js, manifest) go. Mosaic borrows Prism Painter's pictures.
stage() {
  g=$1 b=wavedash/$1/build
  rm -rf "$b"
  mkdir -p "$b/shared"
  cp "$g"/* "$b/"
  cp shared/* "$b/shared/"
  cp icon.svg "$b/"
  if [ "$g" = mosaic ]; then mkdir -p "$b/paint" && cp paint/levels.js "$b/paint/"; fi
  for f in "$b"/*.html "$b"/*.js "$b"/*.css; do
    [ -f "$f" ] || continue
    edit "$f" -e 's#<a class="icon-btn" href="\.\./" aria-label="All games">‹</a>#<span class="icon-btn" aria-hidden="true" style="visibility: hidden"></span>#' \
      -e '/<link rel="manifest" href="\.\.\/manifest.webmanifest">/d' \
      -e "/^registerSW('\.\.\/sw\.js');\$/d" \
      -e 's#\.\./#./#g'
  done
}

for g in $GAMES; do
  [ "$only" = all ] || [ "$only" = "$g" ] || continue
  stage "$g"
  push "$g" "wavedash/$g" "wavedash/$g/build"
done
