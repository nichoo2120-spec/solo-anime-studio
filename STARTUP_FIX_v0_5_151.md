# Solo Anime Studio v0.5.151 — startup packaging repair

This fixes the startup crash in v0.5.150:
`ERR_MODULE_NOT_FOUND: build/sourceDigest.mjs`.

## Changes
- Restored `build/sourceDigest.mjs` needed by `scripts/start-studio.mjs` and `vite.config.ts`.
- Restored `build/sourceDigest.d.mts` needed by TypeScript to recognize the JavaScript helper.
- Updated package version and build label to v0.5.151.
- Added a built-in package completeness check.
- Kept v0.5.150 dry-brush source and settings unchanged.

## Starting on Windows
1. Extract the ZIP into its own folder.
2. Double-click `START SOLO ANIME STUDIO.bat`.
3. Keep the terminal open. The launcher installs dependencies on first use if needed.

Tested here: Node module import, digest computation, package paths, ZIP integrity.
Not tested here: full browser startup (Vite dependencies unavailable in current environment) and physical Wacom.
