# Solo Anime Studio v0.5.162 — Phase 1: portable raster cache check

**Phase status:** Source-path fix complete. No runtime rendering change. Phase 2 not started.

## Changes (file:line)

- `scripts/check-raster-v161.cjs:3`: replace absolute, machine-specific TypeScript module path with `require('typescript')`, resolving the package from the project devDependencies after a normal dependency install.
- `package.json:4`, `src/core/buildInfo.ts:2`: bump version to 0.5.162; no changes to render algorithms, UI, saved stroke formats, tools, or tool wheel.
- `tests/fixtures/performance-v162-revisions.json:1`, `tests/regression/performance-v157.cjs:3`, `tests/regression/performance-v158.cjs:1`, `tests/regression/performance-v161.cjs:3-11`, `tests/regression/performance-v162.cjs:1`: versioned SHA chain for the changed version metadata, keeping earlier frozen image/golden fixture files unchanged.
- `sas_harness/`: include the uploaded v161 browser/measurement harness inside the complete project for later phases.
- `exp/harness.ts`, `exp/mine.html`, `exp/dryBristle.ts`: include experiment pages from the uploaded harness as requested. No runtime app code was replaced.
- `CHANGES.md:1`, `UPDATE_v0.5.162.md:1`: source and validation record.

## Verification and limitations

- Previous independent browser run (v161 only): display parity 40/40; TypeScript, Vitest 391/391, regressions 64/64 and build passed, brush hashes byte-identical. These are **previous independent results**, not newly reproduced v162 browser checks.
- This checkpoint fixes only the Node module resolution path. `npm run test:raster-cache` will resolve TypeScript from the locally installed devDependencies. In environments without `node_modules`, it can also run with an explicitly configured `NODE_PATH` pointing to an installed TypeScript module for an isolated check.
- **Actual v162 checks:** 65/65 standalone regression checks PASS (`validation/v162/regression.log`); isolated RasterSceneDisplay checker 20/20 PASS (TypeScript resolved with a global `NODE_PATH` as a local test substitute for installed project dependencies); warm-cache checker 20/20 PASS; TypeScript syntax transpilation 3/3 PASS. These are not pixel-level browser checks.
- `npm install` is blocked here by DNS (`EAI_AGAIN registry.npmjs.org`), so a clean dependency install, full tsc/Vitest/Vite rebuild, Chromium parity and performance harness runs cannot be verified here. Old `dist/` assets are not a newly compiled v162 build.
- Do **not** interpret the isolated smoke check as pixel-exact compositor equivalence or a performance pass. Performance recovery remains Phase 2.
- No Mix-mode changes in this release.
