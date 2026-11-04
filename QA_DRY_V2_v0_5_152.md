# Solo Anime Studio v0.5.152 — Dry V2 repair candidate

This is a source-code-only update to the v0.5.151 branch. It is **not** a completed appearance/performance sign-off.

## Changes
- Replaced the end-of-stroke shared taper with **per-bristle lift distances** and a ragged dry runout, without extrapolating ink forward of the pen.
- Increased staggered start contacts and reduced the fixed parallel channel spacing.
- Varied each strand's load and paper skip along the path; reduced the over-strong lateral jitter that made jagged polygonal hairs.
- Moved tiny in-flight flecks into the painted footprint instead of floating beside the tip.
- Fixed a real live-preview cache bug: rows with unchanged positions but changed tip distance must have their mass regenerated. Updated the stable preview cache's committed prefix too.
- Kept the v0.5.151 rotating oval dry brush cursor. No other brush engines modified.

## Checks actually run
- `tsc --noEmit src/engine/dryBristleV2.ts --target ES2022 --module esnext --moduleResolution bundler --lib ES2022,DOM --skipLibCheck`: PASS.
- TS transpilation: zero diagnostics.
- Skia Canvas rendered straight and sine strokes for Dry Ink and Dry Paint.
- Incremental straight Dry Ink rendering: direct 33743 occupied alpha pixels; one-pass live 33743; two-pass live 33743; many incremental passes 33743. This is a pixel-count smoke check, not a full per-pixel parity assertion.
- A previous version of this patch passed actual pixel parity in straight/sine synthetic tests; later visual tweaks need full parity regression rerun.
- Source-digest module import: PASS, launcher helper present.
- `build/sourceDigest.mjs` and `.d.mts` retained.

## Outstanding: DO NOT mark the brush finished
- Reference still has a more organic, dense ink body and more realistic hair-like dry taper. The v152 render is less spear-shaped but still shows structured channels.
- Chromium access to local file and local HTTP test pages was **blocked** here, so full real-browser/Playwright and Wacom tests are NOT verified.
- Cold 2400px Skia Canvas benchmark: Dry Ink **229 ms**, Dry Paint **168 ms**, versus target <=120 ms. FAIL in this environment. Browser timing not established.
- Full 10-id A-H targets, exact legacy 520-hash / 24-v1 hash tests, pressure / fast slow grids, small-size fleck/hair counts: NOT RUN here; unverified.
- Full app build was not run because installed npm packages are absent in the supplied source archive. A normal launcher may install them on the user's PC.

Source v151 has been kept otherwise unchanged; older v1 render source code was not edited. The attached `Dry_V2_v152_Render_Review.png` is an independent Skia preview, not a screenshot of Solo Anime Studio running in the browser.
