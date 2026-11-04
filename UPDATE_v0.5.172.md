# Solo Anime Studio v0.5.172 — offline launch repair

## Confirmed v171 failure

`offline/src/main.js` was compiled from the source entry without removing the Vite-only statement `import './styles.css'`. The shipped archive only contained `offline/styles.css`; the nonexistent `/src/styles.css` module could not be loaded, preventing the browser from executing the application entry.

## Changes

- Removed the invalid CSS module import from **precompiled** `offline/src/main.js`. The existing `offline/index.html` stylesheet link loads `/styles.css` correctly. The editable source file `src/main.tsx` retains its valid CSS import for developer/Vite builds.
- Added a brief startup status and browser-level load error display so a failed launch isn't an unexplained blank screen.
- Updated the Windows `.bat` title/header and compiled/source versions to 0.5.172.
- Added a browser JavaScript dependency preflight in `scripts/launch-offline.mjs` to detect missing files and non-JS imports before reporting READY.
- Preserved the v171 native Mix implementation, all existing brush renderers, tool wheel, projects, tests and compiled application assets (other than startup entry and version).

## Verification limits

ZIP integrity and all browser JavaScript import paths were checked, as were an actual local HTTP launch, file responses, and startup error detection. This environment prevents Chromium navigation to local HTTP addresses (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), so an end-to-end Windows browser launch is **not yet verified**. Node.js must be installed; no npm install is required.

## Use

Extract into a **new** folder. Close other Solo Anime Studio black-terminal windows, then double-click `START SOLO ANIME STUDIO.bat`. The fixed local address is `http://127.0.0.1:5211/` and the badge should display 0.5.172. If the address does not open automatically, type it manually into Chrome with the black terminal still open. If the terminal reports port 5211 in use, close the old Studio server first. Keep backups of your projects.
