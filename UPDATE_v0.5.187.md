# Solo Anime Studio v0.5.187

Drawing performance improvements for Solid Paint and Soft Paint.

- The infinite workspace reuses unchanged parts of the active stroke instead of repainting its whole length on each pen movement. Live tile memory remains bounded and is discarded when the stroke ends.
- Paint finishing and subsequent previews restore only the affected region of the layer when the existing drawing matches. Other brushes retain the previous rendering path.
- Pixel comparisons cover live versus committed paint across tile boundaries, several brush sizes, and large-page save/reopen. Existing infinite-workspace checks cover erasing, undo/redo, crossing the shot edge and camera export.

On the same local simulated-pen test, long offscreen Soft Paint strokes improved from approximately 48 ms to 6 ms at the 95th percentile. Large legacy pages still have occasional first-contact and finishing spikes; this release reduces those costs but does not claim to eliminate every source of lag. Tablet hardware and project size affect the result.

Update from Studio with Ctrl+Shift+U, then Install and restart.
