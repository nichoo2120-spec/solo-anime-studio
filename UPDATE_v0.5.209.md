# Solo Anime Studio v0.5.209

Sharper, correctly proportioned brush settings.

- Pressure and brush-width graphs now draw in the panel's actual coordinate space. Handles stay round and curve widths stay consistent instead of stretching with the panel.
- Subtle grids and percentage guides make curve positions easier to read. Mouse, tablet, keyboard, add/delete/reset and live previews are preserved.
- The brush sample now renders at the displayed size and Windows pixel density. It no longer scales a fixed-size bitmap to fit the panel.
- The compact panel and drawing-canvas size are preserved.

Validated at 100%, 125%, 150% and 200% display scaling, with held-pointer updates, graph/preset persistence, compact layout and imported-texture checks. This is a settings display correction; the reported whole-drawing shake remains under investigation and is not claimed fixed here.
