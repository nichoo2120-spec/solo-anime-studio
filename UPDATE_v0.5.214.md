# Solo Anime Studio v0.5.214

## Distort / Perspective selected-brush preview

For small selections of editable brush strokes, the Distort and Perspective tools now preview the same projected stroke geometry that is written when the transform is applied. This fixes the severe dark triangular smear seen when dragging a corner on a thin ink line in v0.5.212.

Unchanged: brush presets and drawing engines, move, scale, rotate, skew, mesh warp, flip, pivot, tool icons, shortcuts, timeline, and saved project format. Larger or mixed-image selections continue to use their existing fast raster preview.

## Verification

The Windows build includes targeted browser checks for Distort preview-versus-commit fidelity, stroke re-selection and undo, as well as the existing transform-mode and warp-fidelity test suites.

Save your work before installing the update. Install it over the existing application without uninstalling; the update does not delete stored projects.
