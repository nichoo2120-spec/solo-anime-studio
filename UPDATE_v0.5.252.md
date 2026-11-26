# Solo Anime Studio v0.5.252

## Brush workspace

- Use the compact brush bar to switch presets, adjust size and opacity, or swap between Paint and Blend. Drag the handle to dock the bar across the top or along the left edge. Click a number to type an exact value, or drag it to adjust.
- Open the brush picker from the preset name. It includes category tabs, search, previews, list and grid views, imports under **+**, and preset actions.
- Open **…** for brush-specific quick controls. Use the eye buttons in Full Brush Settings to choose which controls appear there for each brush.
- Press **F4** or choose **Full Brush Settings** to open the panel. Drag the header to move it, use the dock button to switch sides, or drag the lower corner to resize it. The panel includes a live preview.

## Applying the update

Extract this ZIP over the v0.5.251 source tree, keeping its folder structure. Run `npm ci` and `npm run build`. To refresh the prebuilt files used by **START SOLO ANIME STUDIO.bat**, run `npm run build:offline`.

## Verification

538 Vitest tests and 17 desktop update tests passed. Eight Vitest suites and the standard TypeScript build were blocked by missing dependencies in the restored workspace. The production bundle built with cached browser dependency modules. Browser checks and an end-to-end comparison of saved drawing output remain unverified.
