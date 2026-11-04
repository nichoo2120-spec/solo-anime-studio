# Solo Anime Studio v0.5.175 — Less lag after pen-up, undo and redo

## What changed
- After you lift the pen, undo or redo a pencil or solid-colour stroke, the app now redraws only the strip of screen that stroke covers, not the whole canvas.
- If nothing changed since that redraw, the next frame paints nothing at all.
- Pixels are exactly the same as a full redraw. A new test checks every such frame against a full redraw (difference 0).

## What did not change
- Brush output is byte-identical to v0.5.174. No tool was removed or simplified.
- Ink (clean ink display), smudge, mix and blend strokes, vector layers, rotated view, selections, transforms, mirror and camera keys still use the full redraw, because a partial redraw is not exact for them.

## Not done in this version
- A cache of the layers above the active layer: not byte-exact on 8-bit canvas, so not shipped.
- Fewer pixel readbacks for pencil/solid: not done.
