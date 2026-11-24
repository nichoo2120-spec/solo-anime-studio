# Solo Anime Studio v0.5.241 — Tip shape, Dual brush and My brushes

Three new sections in **Brush Settings** (the dark panel, open it with the brush settings button):

- **Tip shape** — stretch and squeeze any paint brush like Photoshop's Brush Tip Shape:
  - **Roundness**, **Tip angle (shape)**, **Scale X**, **Scale Y**, **Flip X**, **Flip Y**.
  - **Angle follows stroke direction** (great for flat and calligraphy strokes).
  - **Pen tilt controls tip** (needs a pen that reports tilt).
  - **Live tip preview** shows the tip and a sample stroke as you move the sliders. **Reset shape** puts it back.
- **Dual brush** — merge two brushes into one:
  - Pick a **Second brush**; its tip and texture are stamped along the same line and merged with a **Dual brush mode** (Multiply, Darken, Overlay, Subtract, Lighten, Screen, Height).
  - **Second tip size**, **Second tip spacing**, **Scatter**, **Count**, **Merge amount**, with a live preview.
  - Type a short name and **Save as new brush** to keep the merged brush.
  - Works in Paint mode and in Blend mode (J), so blending brushes can be merged too.
- **My brushes** — create your own brush:
  - Type a short name (up to 24 letters) and **Create from current** (copies every current setting) or **New from scratch**.
  - Your brushes appear in the brush picker marked ★, and can be **Renamed**, **Duplicated** and **Deleted** (stock brushes can never be deleted).
  - They are saved with the app, inside saved projects and in backup export; importing a backup adds its custom brushes.

Brushes without Tip shape or Dual brush switched on work exactly as before, and old drawings look exactly the same (byte-identical). While Tip shape or Dual brush is on, the brush is drawn by the new stamp engine, so engine-only effects such as watercolour wet edges and ink smoothing are replaced by the stamped tip.
