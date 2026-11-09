# Solo Anime Studio v0.5.215

## Repeatable stroke selection
- For editable brush strokes, Stroke Select now performs its hit-test against the original pen geometry in the stroke's local coordinates. Repeated scaling, moving, perspective edits and reopening no longer cause numeric drift from repeatedly transforming and re-inverting flattened Bézier paths.
- The same editable stroke IDs are retained; no additional raster conversion is introduced in ordinary brush transforms.

## Sharp drawing after reopening
- Clean ink that has been transformed using perspective now redraws at the actual screen pixel resolution after reopening or zooming, instead of enlarging the document bitmap.
- Screen-space and project-resolution renderers share a single pressure-bearing projective geometry conversion, keeping the saved and display curves consistent.
- Navigation-only workers fall back to the existing preview path for projective ink so they cannot mistakenly render it at its original position. Settled views use the sharp ink path.

## Regression coverage
- Real pointer selection/deselection through six successive affine and perspective edits, plus IndexedDB save and reopening.
- Sharp 4× redraw after an IndexedDB roundtrip; both pre-save and reopened output must be identical at the same zoom.
- Existing ink, selection, transformation, animation and Windows installer tests still run.

**Note:** Mesh Warp and traditional pixel-lasso transforms are separate bitmap-based operations. This update does not silently convert bitmap results back into individual strokes.

Save your drawing before installing. No stored project deletion or automatic downgrade is included.
