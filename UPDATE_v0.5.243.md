# Solo Anime Studio v0.5.243 — No more dark border on watercolor and Blend strokes

The dark border line (the darker wet edge / tide line) around blended and watercolor strokes is gone:

- **Blend mode (J)** with any watercolor brush: blends soft, wet and transparent with no dark outline.
- **Silk Wet**: no dark outline.
- **Normal watercolor brushes** (Smooth, Rough, Soft Wet, Flat, Gradient, including Wet Mix): no dark wet edge.
- No lighter rim or halo takes its place. Watercolor still looks soft, cloudy and transparent.

**One brush keeps the edge:** the new stock brush **Watercolor Edge** (Paint brushes, next to the other watercolors). It paints a soft wet watercolor stroke with a darker wet edge. Brush Settings → watercolor → **Edge darkness** controls how dark it is (0% = no edge, 100% = strongest). The same slider is on every watercolor brush and starts at 0%.

Old drawings look exactly the same as before (byte-identical); only new strokes use the new look. Removing the edge pass costs nothing (see the speed check).
