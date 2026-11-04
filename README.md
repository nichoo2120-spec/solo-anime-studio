# Solo Anime Studio — v0.5.172

## Open the application (Windows)

Extract the ZIP, then double-click **START SOLO ANIME STUDIO.bat**. It launches the precompiled current Studio immediately, without npm install, Vite, an internet connection or a rebuild. Keep the terminal open during your session. Node.js LTS still must be installed.

The app normally opens at `http://127.0.0.1:5211/`, at the same fixed local address as earlier versions, so local project storage remains accessible. Close older Studio windows before starting this version.

This copy includes the **Paint / Mix** option for normal brushes, the B key toggle, and the Tool Wheel Mix option. **v0.5.172 mixes with each normal brush’s real stroke geometry and texture**, without secretly switching to a generic Blender brush. New mixing uses the off-thread stroke renderer when supported; original Paint rendering has not been modified. Existing Blender strokes in saved projects remain supported. Open and save test projects carefully; retain a backup of important work.

`npm start` launches the same precompiled local version. For development work, `npm run dev` still needs dependencies installed. See `UPDATE_v0.5.172.md` for details, test limits and known remaining brush-lag issues.


**v0.5.172 startup repair:** fixed the missing stylesheet module import in the precompiled browser entry. CSS is included from `offline/index.html` rather than imported as JavaScript. The Windows launcher now identifies itself as v0.5.172 and validates the browser import graph before claiming READY. If the app does not appear, the browser shows a startup error instead of staying blank.

**v0.5.176 Opens faster:** The START .bat now loads one optimised app file instead of ~190 separate files, cached by the browser between launches. The last project reopens without reading every saved project, and big projects open layer by layer instead of freezing. Pixels unchanged. See `UPDATE_v0.5.176.md`.

**v0.5.175 Less lag:** After pen-up, undo and redo of pencil and solid-colour strokes, only the strip of screen that the stroke covers is redrawn instead of the whole canvas. Pixels are exactly the same as a full redraw (tested). Ink, smudge, mix and blend strokes still use the full redraw.

**v0.5.174 Scene camera:** New CAMERA tab: a real scene camera with keys, easing, multiplane depth, safe areas, field guide, and PNG-sequence export through the camera. Brush pixels are unchanged.

**v0.5.173 Mix repair:** The ink display now yields to Mix for new strokes; Mix v2 increases the effective local mixing radius. v1 saved strokes keep their previous renderer. Mix requires existing colours on the same selected layer.

---

## Desktop app, building and releasing (for Codex / developers)

Solo Anime Studio is a React + Vite + TypeScript web app. A **thin Electron layer** turns the normal
Vite build (`dist/`) into a Windows desktop app with an installer and auto-update. Do not mix app
code into the Electron layer; keep working in `src/` like before.

Packaging files (keep them, change rarely):

| File | What it does |
|---|---|
| `electron/main.cjs` | Desktop shell. Serves `dist/` from the fixed origin `app://soloanimestudio` (projects in IndexedDB/localStorage stay put across updates), no menu bar, unsaved-changes dialog, auto-update. |
| `electron/preload.cjs` | Exposes `window.soloDesktop` = `{ version, checkForUpdates() }` (optional for the web app). |
| `electron-builder.config.cjs` | Installer settings: appId `com.nicholas.soloanimestudio`, NSIS, Start menu + desktop shortcuts, file name `SoloAnimeStudio-Setup-${version}.exe` (dashes only, so `latest.yml` matches the GitHub asset name). |
| `release.config.json` | The ONE place for where updates come from: GitHub `nichoo2120-spec/solo-anime-studio`. |
| `scripts/dist-win.cjs` | `npm run dist:win`: `npm run build` then electron-builder. |
| `scripts/wine-shim/` | Lets Linux build the Windows installer without Wine. |
| `scripts/publish_release.sh` | Bump version, test, build, upload a **published (not draft)** GitHub Release. |

Commands:

```bash
npm install                 # once
npm run dev                 # browser dev server (127.0.0.1:5211 style dev, unchanged)
npx tsc -b && npx vitest run && npm run test:regression   # guards - must all pass
npm run dist:win            # -> release/SoloAnimeStudio-Setup-<version>.exe, .exe.blockmap, latest.yml
SAS_GH_TOKEN=github_pat_... bash scripts/publish_release.sh patch   # release a new version
```

Rules for every change:
1. Bump the version: `package.json` `version` AND `src/core/buildInfo.ts` (`version`, `correction`).
   `publish_release.sh patch` does both. Auto-update only happens when the version goes UP.
2. If you edit a file that a regression guard hashes, add a row to the newest
   `tests/fixtures/performance-v1xx-revisions.json` ledger (see `tests/revision-ledger-v174.cjs`).
3. Never commit tokens. The release token is passed only as the `SAS_GH_TOKEN` environment variable.
4. A release must contain 3 files with exactly these names: `SoloAnimeStudio-Setup-X.Y.Z.exe`,
   `SoloAnimeStudio-Setup-X.Y.Z.exe.blockmap`, `latest.yml`, and must be **published** (not draft).
5. The repo should be **public**; a private repo would need a token inside the app for updates.
