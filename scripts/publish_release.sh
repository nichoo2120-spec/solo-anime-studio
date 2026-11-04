#!/usr/bin/env bash
# Build + publish a new Solo Anime Studio release to GitHub Releases (auto-update source).
# Usage:  SAS_GH_TOKEN=github_pat_xxx  bash scripts/publish_release.sh [patch|minor|major|1.2.3|current]
#   "current" = publish the version already in package.json (no bump).
# The token: fine-grained, ONLY the solo-anime-studio repo, permission "Contents: Read and write".
# Needs Node 20+, curl, python3. Works on Linux/macOS/WSL (no Wine needed, see scripts/wine-shim).
# Where to publish is read from release.config.json (owner / repo) - the ONE place to set it.
set -euo pipefail
cd "$(dirname "$0")/.."
BUMP="${1:-patch}"
: "${SAS_GH_TOKEN:?Set SAS_GH_TOKEN to your fine-grained GitHub token for the solo-anime-studio repo}"
OWNER=$(python3 -c "import json;print(json.load(open('release.config.json'))['owner'])")
REPO=$(python3 -c "import json;print(json.load(open('release.config.json'))['repo'])")
API="https://api.github.com/repos/$OWNER/$REPO"
AUTH=(-H "Authorization: Bearer $SAS_GH_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

echo "== checking access to $OWNER/$REPO"
curl -fsS "${AUTH[@]}" "$API" >/dev/null || { echo "Cannot reach $OWNER/$REPO with this token (does the repo exist? is the token for this repo?)."; exit 1; }

if [ "$BUMP" != "current" ]; then
  echo "== bumping version ($BUMP)"
  npm version "$BUMP" --no-git-tag-version >/dev/null
  VER=$(node -p "require('./package.json').version")
  # keep the in-app version label in step with package.json
  node -e "const fs=require('fs'),f='src/core/buildInfo.ts',v='$VER',c=+v.split('.').pop();fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/version:'[^']*',correction:\d+/,\"version:'\"+v+\"',correction:\"+c))"
fi
VER=$(node -p "require('./package.json').version")
echo "   version: $VER"

echo "== guards + build (tsc, vitest, Windows installer)"
npx vitest run
npm run dist:win

EXE="release/SoloAnimeStudio-Setup-$VER.exe"
[ -f "$EXE" ] || { echo "Build did not produce $EXE"; exit 1; }
grep -q "url: SoloAnimeStudio-Setup-$VER.exe" release/latest.yml || { echo "latest.yml does not name $EXE"; exit 1; }

echo "== creating release v$VER (published, not draft)"
REL=$(curl -fsS "${AUTH[@]}" -X POST "$API/releases" \
  -d "{\"tag_name\":\"v$VER\",\"name\":\"Solo Anime Studio $VER\",\"body\":\"Solo Anime Studio $VER\",\"draft\":false,\"prerelease\":false}")
RID=$(echo "$REL" | python3 -c "import json,sys;print(json.load(sys.stdin)['id'])")
UP="https://uploads.github.com/repos/$OWNER/$REPO/releases/$RID/assets"
upload() { echo "   uploading $2 ($(du -h "$1" | cut -f1))"; curl -fsS "${AUTH[@]}" -H "Content-Type: $3" --data-binary @"$1" "$UP?name=$2" >/dev/null; }
upload "$EXE" "SoloAnimeStudio-Setup-$VER.exe" application/octet-stream
upload "$EXE.blockmap" "SoloAnimeStudio-Setup-$VER.exe.blockmap" application/octet-stream
upload release/latest.yml latest.yml text/yaml

echo "== done: https://github.com/$OWNER/$REPO/releases/tag/v$VER"
echo "   Installed copies download it by themselves and ask to restart."
echo "   Remember: git add -A && git commit -m \"v$VER\" && git push"
