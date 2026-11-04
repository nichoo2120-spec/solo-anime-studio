# Solo Anime Studio v0.5.174 — Scene camera + tool check

## What was wrong
- v0.5.173 had **no real scene camera**. The "camera" was only the view you draw in (pan, zoom, rotate the canvas). You could not key a camera move, add parallax, see a camera frame, or export through a camera.
- Two speed fixes from the v0.5.162 review were missing: the editing-scene snapshot (smoother pan/zoom on big scenes) and the tool-wheel offset next to an open panel.
- 7 old unit tests and 11 old regression scripts were failing. They still checked the old Blender preset and old file hashes from before v0.5.166.

## What is new
**Scene camera (new CAMERA tab in the right panel)**
- Click "Add scene camera". Turn it on or off with the checkbox. The checkbox only turns the camera on; your drawing is never changed.
- Truck (X), pedestal (Y), zoom (push in / pull out) and roll. Type a number to set a key on the current frame.
- Keys on any frame, with ease: linear, ease in, ease out, ease in-out, hold. Prev/Next key, frame scrubber, delete key, reset.
- Multiplane depth for each layer. 0 moves with the camera. A bigger number is farther away and moves less, like a background. A negative number is nearer and moves more.
- On-canvas overlay showing the camera frame, the action-safe (90%) and title-safe (80%) areas, a field guide and the centre cross. Drag the frame edge to truck the camera.
- A live preview through the camera.
- PNG sequence export has an "Export through scene camera" option. The manifest lists the camera.
- Saved in the project file and restored on load. Undo/redo works. Deleting a layer also removes its depth.

**Other fixes**
- Ported the v0.5.162 editing-scene snapshot and the tool-wheel offset.
- Old tests now match the v0.5.166 default Blender (smudge v3, round nib). No preset was changed.
- Old hash guards use one shared ledger (`tests/revision-ledger-v174.cjs` + `tests/fixtures/performance-v174-revisions.json`). Any unrecorded edit still fails.
- Rebuilt the offline folder (new and changed files plus styles.css). The new check is `scripts/check-offline-v174.cjs`.

## Not changed
- Brush and Mix pixels are byte-identical to v0.5.173. Checked on 696 render cases plus live strokes.
- No tool or feature removed.

## Still missing (camera)
- No true 3D tilt or perspective. Depth is 2.5D multiplane only.
- Zoom and roll are set with numbers, not on-canvas handles. Drag the frame to truck.
- Single PNG export and video do not use the camera yet. Only the PNG sequence does.
