# Solo Anime Studio v0.5.168 — fast startup repair

**Problem found:** v0.5.167 was source-only (no compiled dist or node_modules), so the old Windows launcher first installed npm dependencies, then ran a full TypeScript build and Vite production build, and only then launched a browser. It looked stuck on opening the app.

**Change:** The default Windows launcher now uses `scripts/fast-start.mjs`. It starts a local Vite development server directly from the current source. It does NOT build the release bundle first. Once Vite is ready it opens the browser on the correct port. This fixes the unnecessary full rebuild on every launch and ensures it uses the v0.5.168 source rather than a stale dist.

**One-time requirement:** Node.js and project npm dependencies must exist. If dependencies are absent, the launcher will try to reuse an installed `node_modules` from an adjacent Solo Anime Studio version. Otherwise it runs a network install with bounded retry/timeout settings and shows an explicit error if that fails. First-time dependency downloads cannot be skipped. The launcher cannot run offline unless dependencies are already installed.

**Note about performance:** This is a startup-path repair, not a drawing-engine optimization. Development-mode Vite may have different runtime characteristics than the optimized production bundle. Painting and Mix brush code from v0.5.167 is not changed here.

**Manual alternative:** With dependencies installed, open a terminal in the extracted folder and run `npm run dev -- --open`.

**Validation limitations:** This build includes the full source but no precompiled production bundle, because the build dependencies are unavailable in the packaging environment.

## Checks run in the packaging environment

- `node --check` fast-start and existing launcher scripts: passed.
- `npm run test:fast-start`: two isolated startup scenarios passed (no dependencies needed for this test).
- TypeScript syntax transpilation of five touched source files: passed.
- Full browser tests, production build, Paint/Mix golden hashes and actual Windows startup: **not run**, because Vite and related packages are missing from this environment, and registry DNS resolution is blocked.
