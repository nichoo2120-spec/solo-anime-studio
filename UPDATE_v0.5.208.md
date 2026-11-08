# Solo Anime Studio v0.5.208

Brush Settings now configures the brush before you draw.

- Advanced → Brush thickness profile: enable it, click to add points, and drag points to shape thin/thick passages in future strokes. Supports Technical, G-Pen, Mapping, Brush Pen, Studio Ink and Contour Flow. Pressure and taper combine with the profile; the repeat distance is anchored from pen-down, with linked endpoints and a three-diameter minimum.
- Pen pressure keeps its graph. Add, move or delete interior points with a mouse or tablet; arrow keys also adjust points. Response changes move the graph immediately.
- Sliders, numeric values, tip handles, graphs and the rendered sample update during adjustment. Controls stay in the compact, collapsible panel.
- The separate Mouse velocity taper checkbox is removed. Previously saved stroke data is preserved.
- Brush Settings no longer sends you to select an existing stroke. The separate Stroke Select thickness editor remains available for existing artwork.

Validation: TypeScript, held-pointer UI previews, custom-preset persistence, invalid curve rejection, rendered thin/thick widths, and twelve simulated pen combinations across all six Ink brushes at small/large sizes. Profile strokes keep settled pixels stable, match on pen lift and match after reopening. Existing drawing and paint compatibility checks remain in the release pipeline. Real tablet latency/glitch resolution is not claimed by this settings update.
