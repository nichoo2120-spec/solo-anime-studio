# Solo Anime Studio 0.5.205

One feature: thick/thin points for a selected existing ink stroke.

Use Stroke Select (S) to select one Ink stroke, then open Advanced · Thick/thin points in the inspector. Click near the preview line to add points, drag an outer handle or enter a thickness percentage (5–200%), and adjust an interior point's position. Apply thickness makes one undoable change. Cancel discards the preview; removing applied width points restores the stroke's original width behaviour.

The stroke centreline, original pressure/taper/texture and saved affine transform remain intact. Supports the six editable engine-10 Ink brushes, including previously transformed strokes. Photos, paint strokes, erasers, dots and perspective-warped strokes are not supported. Locked/reference layers, stale selections and pending transforms are guarded.

Validation measures a 20px line locally reduced to 6px and increased to 36px, unchanged points/transforms, thicker-stroke selection bounds, save/reopen, undo/redo, exact removal, lock/stale/pending-transform guards, and actual UI add/drag/cancel/apply/keyboard interaction. Existing desktop and old-artwork compatibility checks remain enabled.

Reusable width profiles, other advanced controls, combining brushes and creating brushes are not included in this release.
