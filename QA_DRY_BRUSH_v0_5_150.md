# Solo Anime Studio v0.5.150 — Dry Brush repair QA

**Status: Partial bugfix / NOT approved as a full reference-match.**

## Changes made
- `src/engine/dryBristleV2.ts`: remove the 1-px forward-projecting flight splinters and last-tangent straight hairs; use short flecks/dots and path-anchored hair marks behind the tip, with bounded dirty regions. Stagger entry of individual bristles; stagger lift based on the existing taper width, with separate default v2 taper settings.
- `src/engine/StudioEngine.ts`: v2-only oval cursor (rotates with actual stroke direction) instead of chalk square outline.
- `src/core/brushes.ts`: v2 dry ink/paint *preset defaults only* set end taper to .12/.15. Old brush and v1 presets unchanged, and existing saved strokes retain their own settings.
- The v2 brush IDs, v1 renderer, old preset geometry, and existing non-dry brush behavior were not altered.

## Independent Canvas tests (not physical Wacom/browser tests)
- v2 direct rendering deterministic across repeated replay in 8 fixture cases: **0 changed pixels**.
- Live-vs-final matched for Ink/Paint at size 130 on straight and sine: **4/4, 0 changed pixels**.
- 6 legacy visual comparisons versus v0.5.148 (old Dry, old Ink v1, Paint v1; straight and sine) each: **0 changed pixels**. This is not the full 520+24 compatibility matrix.
- On straight-path samples at size 38, 60, 70, 130: **0 pixels beyond +0.3×size of the pen tip**, for Ink and Paint. A sharp backwards hook cannot be judged by that global projection rule because earlier legitimate stroke pixels are ahead of the *reversed* final tangent; the absence of *new* projected tails is enforced by the new path-anchored algorithm.
- No `lineTo` flying splinters, no ahead-of-pen extrapolation from the final tangent. Cursor is an ellipse in v2 source (visual browser validation not performed).
- A 2,400 px replay in this Skia harness: first/cold run about 170–195 ms, subsequent warmed runs about 48–54 ms. **Cold ≤120 ms is not met**; this environment is not the user's target Windows/browser system.
- Modified engine and StudioEngine code passed a strict targeted TypeScript check with a temporary `ImportMeta.env` ambient shim. A full npm build/Vitest and real Playwright UI tests were **not run** (dependencies/browser environment unavailable).

## Appearance metrics (size 130; 10 IDs; mean of slow straight & sine)
These represent a partial A–H check, not the full acceptance protocol.

| Metric | Target | Dry Ink | Dry Paint |
|---|---:|---:|---:|
| gx/gy | ≤ .36 | .42 FAIL | .40 FAIL |
| gap fraction | .10–.30 | .21 PASS | .14 PASS |
| perimeter/hull | 1.5–2.4 | 1.16 FAIL | 1.11 FAIL |
| tail/W | .6–2.6 | 1.15 PASS | 1.22 PASS |
| midtone | .28–.55 | .11 FAIL | .07 FAIL |
| last/first density | .55–1.0 | .90 PASS | .93 PASS |
| mean alpha/hull | .75–.85 | .82 PASS | .88 FAIL |
| streaks | 3–6 | 4.65 PASS | 3.35 PASS |
| thickness | 5–21 | 16.25 PASS | 25.23 FAIL |
| repeat peak | ≤ .22 | .21 (6/10) FAIL ID COUNT | .20 (8/10) PASS |
| flecks | 30–80 | 41.85 PASS | 25.05 FAIL |
| hairlines | ≥ 4 | 1.05 FAIL | 0 FAIL |
| taper | .33–.78 | .62 PASS | .44 PASS |

**Overall partial visual gate: Ink 8/13, Paint 6/13.** Smaller brushes still lack sufficient isolated flecks/hairs, and the reference's torn irregular edge is not matched. This build is intentionally not marked a full Phase 2.2 pass. The requested fallback to the v147 visual design would require a separate performance-compatible port; that has not been achieved here.

## Remaining actions before sign-off
1. Finish restoring A–H appearance targets, especially edge roughness, opacity/midtone, hairlines at size 38/70, and Paint thickness.
2. Verify 10 IDs, pressure response, slow/fast tests, 520+24 legacy hashes, 3 ms event p95, and ≤120 ms cold 2400px replay on the target rig.
3. Test actual cursor and stylus hook behavior in Chrome with Wacom. No package manager build artifacts (`dist`) are shipped, to prevent stale v149 rendering.
