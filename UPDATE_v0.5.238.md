# Solo Anime Studio v0.5.238 — Silk Blend brush

**New: Silk Blend**, a brand-new blending brush. It replaces the Mix brush that was removed in v0.5.237. It is written from scratch (new code, new look, new name).

## What it does
- Picks up colour from the **selected layer only** and drags it smoothly into the next colour. It never adds your brush colour.
- **4 modes:** Soft (smooth gradient), Wet (drags and melts colours), Smudge (pulls colour along and fades out), Dry (rough, broken blend with paper grain and bristle streaks).
- **Sliders:** Size, Opacity, Blend Strength, Colour Pickup, Wetness, Smoothing, Spacing, Texture. All are saved with the brush.
- **Presets:** Silk Soft, Silk Wet, Silk Dry, plus a Reset button.
- **Pen pressure** changes size and blend strength.
- Clean edges on transparent paper (no grey or dark halos). No dots or gaps on fast strokes.

## Where to find it
- Toolbar: the new Silk Blend button next to Brush.
- Tool wheel: the SILK switch at the bottom, or put Silk Blend in any wheel slot (wheel options).
- Keyboard: **B** selects the Brush. Press **B again** to switch to Silk Blend, and again to go back to your brush.
- Brush panel: Category Paint, Family Blend, Preset Silk Blend.

## Safety
- One stroke = one undo step. Only the small area around the stroke is redrawn.
- Live drawing runs in the blend worker, so the drawing thread does not do the blending.
- Old drawings and all other brushes look exactly the same as before (byte-identical). The v0.5.236 Mix renderer is kept, so old Mix strokes still open unchanged.
