# Solo Anime Studio v0.5.160 — Step 1.1 cache correctness checkpoint (NOT a lag-fix release)

## What changed
- `src/engine/DrawingFrameCache.ts:38-40,43,62-75`: mark idle warm-up cache as untrusted for the first frame of a **new** drawing gesture. The first frame already requires a full redraw; it now invalidates warmed lower-prefix and upper-ink snapshots and rebuilds them from authoritative renderer output. Later frames of the same stroke keep the original incremental dirty-region caching. This is a **candidate** fix for the intermittent DPR 1 first-frame display mismatch; full browser parity was not available to confirm it.
- `tests/drawing-warmup-v160.test.ts`: three new Vitest assertions for the first frame, cached subsequent updates, and changed project snapshot at DPR 1 and DPR 2. **Not executed**, as Vitest could not be installed.
- `scripts/check-warmup-v160.cjs`: lightweight focused source-level validation, 10 successive runs each at DPR 1 and DPR 2, using mock canvases (not actual full-app browser parity).
- `package.json`: version `0.5.160`; add `npm run test:warm-cache` command.
- `CHANGES.md`: version change index.
- **No brush raster, paint, mix, project serialization, or tool-wheel code changed.** Mix mode and the Blender replacement have not started.

## Verification attempted, 31 Oct 2026
| Check | Result | Explanation |
|---|---|---|
| Source-level warm-cache smoke | PASS 20/20 | 10 consecutive mock cases per DPR 1/2; not browser-pixel parity |
| TypeScript isolated transpilation of changed source/test | PASS | Zero diagnostics from TypeScript transpileModule; not project type-check |
| `tsc --noEmit -p tsconfig.json` | BLOCKED | Missing `vite/client` type definition (`node_modules` absent) |
| `npm test` / Vitest | BLOCKED | `vitest: not found`; dependency installation fails (npm registry DNS `EAI_AGAIN`) |
| `npm run test:regression` | 61/63 | Two existing `performance-v157.cjs` and `performance-v158.cjs` SHA-256 source revision checks reject modified `DrawingFrameCache.ts`. Golden expectations were not altered. |
| `npm run build` | BLOCKED | Fails TypeScript validation because `vite/client` missing; `dist` remains older build |
| Full live-v-final parity x10, actual PNG goldens | NOT RUN | Missing dependencies; no attached `sas_harness.zip` |
| Performance harness: 2048x1152 DPR2 CPU4x 281 strokes + busy10 | NOT RUN | `sas_harness.zip` not supplied and build unavailable |

## Performance status (baseline data only; v158, not v160)
| Measure | v0.5.158 median-of-3 range | v0.5.160 measurement | Goal |
|---|---|---|---|
| p95 frame | 33–183 ms | NOT MEASURED | <= 20 ms |
| input latency p95 | 7–132 ms | NOT MEASURED | <= one frame |
| pen-up | 148–400 ms | NOT MEASURED | <= 50 ms |
| undo | 127–201 ms | NOT MEASURED | <= 50 ms |
| longest task | 155–647 ms | NOT MEASURED | <= 50 ms |
| per-move readbacks | 0 for most, pencil/solid 14–31 per stroke | NOT MEASURED | 0 per move |

## STOP: later work intentionally not started
This is the first correctness substep only, **not** a verified Step 1 pass. The instruction to proceed one step at a time means pen-up/undo/live raster optimisation and all Step 2 Mix-mode work must wait for full test verification. The old Blender brush remains visible, old-stroke loading is untouched, and the tool wheel remains present.

## Packaging note
The slim ZIP contains complete source, application assets, browser and unit tests, golden fixtures and previous compiled `dist`, but omits bulky **historical generated** `test-output/` screenshots and old `validation/` logs. The included `dist` is **not** rebuilt to v160; starting the app requires installing dependencies and compiling. Test logs from this attempt are in `validation/v160/`.
