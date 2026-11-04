# Solo Anime Studio v0.5.169 — Instant Offline Start

## What is fixed

This release contains a **precompiled copy of the current v0.5.169 Studio source**, including the Paint/Mix toggle introduced in v0.5.167. Launching it no longer triggers npm install, Vite, TypeScript compilation or network downloads.

### Windows start

1. Extract the entire ZIP into a new folder.
2. Double-click `START SOLO ANIME STUDIO.bat`.
3. Keep the small terminal window open while drawing. The browser should open at the printed `http://127.0.0.1:5211/` address. Close older Studio servers first; it intentionally does not switch ports because that would hide locally saved projects.

**Requirement:** Node.js installed (same as previous versions). No internet or npm dependency install is required for normal drawing startup. `npm start` also starts offline mode. Development mode still requires the usual dependencies.

## What is preserved

- Current source application and Paint/Mix brush controls.
- Old project format and old Blender-stroke rendering code.
- Tool Wheel and its Paint/Mix slot.
- Drawing engine algorithms are byte-identical to v0.5.168.

## Packaging details

`offline/src` contains the current code converted from TypeScript into native browser ES modules ahead of time. `offline/vendor.js` contains the React 19 and UI icon runtime needed by those modules. The older v159 application contained within that vendor runtime is **not mounted or used as the displayed application**. No old compiled app is substituted for the v169 source.

## Verification and known limitations

- Offline asset server checked on a machine with **no node_modules**. All tested resources were served correctly.
- All relative ES module imports resolved and the current `App` module imported with React 19.
- Real Windows startup and full Chromium interactions could not be checked in this environment due to browser navigation restrictions.
- This is a **startup fix**, not proof that the existing drawing or blending lag is fixed. Tool/brush responsiveness still requires measurement on the target device.
- Offline assets are not minified; for performance tuning a fully optimised production Vite build is still recommended when dependencies become available.
