# Solo Anime Studio v0.5.240 — Paint / Blend switch on every brush

**Every paint brush can now blend.** Pencils, inks, paint, marker, dry, watercolour and colouring brushes all have a **Paint | Blend** switch in the brush panel (and in Brush Settings → **Blend**). Press **J** to switch.

- **Blend** adds no colour. The brush mixes the colours already on the canvas, using its **own tip, texture, grain, pressure and spacing** — a pencil blends grainy, a watercolour brush blends soft, a textured brush blends textured.
- **Blend settings** (saved with each brush, like Photoshop's Mixer Brush):
  - **Blend Amount** — how much the blend replaces the original.
  - **Colour Pickup** — how fast the brush picks up colour.
  - **Wetness** — how softly the picked colours bleed.
  - **Mix** — canvas colour versus the colour carried in the brush.
  - **Blend Flow** — how fast the blend builds up.
  - **Stretch** — how far colour is dragged before the brush runs dry.
  - **Paint Load** — optionally add some of your brush colour (0% = pure blending).
  - **Sample:** Current layer or All layers (the result still goes on the current layer).
  - **Clean brush after each stroke** on/off (off = the brush keeps the colour it ended with).
  - **Pen pressure changes blend**, **Protect transparency**.
  - Presets **Soft blend**, **Smudge**, **Wet mix**, and **Reset blend**.
- J can be changed in Settings → Keyboard (it is listed as "Brush Paint / Blend switch").

Paint mode is unchanged. Old drawings and every stroke drawn in Paint mode look exactly the same (byte-identical). Silk Blend and the Blender brushes keep their own settings.
