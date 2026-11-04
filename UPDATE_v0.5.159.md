# Solo Anime Studio v0.5.159 — limited cache correctness patch

## Changed
- `src/engine/DrawingFrameCache.ts`: only reuse the captured lower-layer prefix if it belongs to the same immutable project snapshot, in addition to the prior view, layer, revision, and dimension guards. This addresses one possible stale-frame reuse path at first pen-down.
- `package.json`: version is now `0.5.159`.

## Verification status
- **Not verified in browser.** The supplied ZIP omits `sas_harness` and its busy projects; the environment cannot obtain dependencies from the npm registry, so tsc, vitest, the browser parity loops, build, and performance benchmark could not run.
- The other reported performance bottlenecks are **not fixed**: p95 33–183 ms versus 20 ms; pen-up 148–400 ms versus 50 ms; undo 127–201 ms versus 50 ms; longest task 155–647 ms versus 50 ms. These are baseline v158 measurements, **not new v159 results**.
- This is a conservative source patch and **not** a completed performance release. The bundled `dist` is still the original v158 build and has **not** been rebuilt. Install dependencies and rebuild before testing.
- No brush rendering code was modified, but byte-for-byte visual parity still requires actual browser verification.

## Required follow-up
Use the `sas_harness` files from the report, install dependencies, run the parity scripts and benchmark 30 brush/size configurations. Focus next on preventing full-composites at pen-up/undo and reducing live ink/dry raster work per animation frame, without changing canonical pixels.
