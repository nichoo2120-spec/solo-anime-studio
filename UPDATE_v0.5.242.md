# Solo Anime Studio v0.5.242 — Every brush family now blends in its own style

Blend mode (press **J**, or Brush Settings → **Paint or Blend → Blend**) was rebuilt so each brush blends the way that kind of brush really would. The Blend settings now show **Blends like: …** for the current brush.

- **Watercolor** brushes blend like wet watercolor: a soft wet bleed that spreads past the stroke, transparent pigment mixing (red + blue gives violet, not grey), a darker wet edge / tide line, an uneven blooming edge, a cloudy wash and paper grain (stronger grain on Rough and Flat watercolor).
- **Dry** brushes give a rough, broken, grainy, scratchy drag with bristle gaps.
- **Pencils** smudge gently with paper grain.
- **Inks** make a crisp wet-ink smear that drags colour a long way (they no longer paint dark ink in Blend mode).
- **Airbrush** blends very soft and wide.
- **Oil / bristle / flat** brushes drag thick, buttery colour with soft bristle streaks.
- **Markers** give an even, transparent marker bleed.
- **Textured** paint blends through a canvas grain. **Soft** brushes blend smooth and soft.

Fixed:
- Ink brushes in Blend mode were drawn as solid ink instead of blending.
- Blending carried almost no colour (the brush reloaded every few pixels), so it barely blended.
- Blending could thin the paint and leave white halos at the edges. Blend now never makes paint more transparent.

The Blend settings (Amount, Pickup, Wetness, Mix, Flow, Stretch, Paint load, Protect alpha) all work with every family. Blend strokes made in v0.5.240/241 keep their old look exactly (byte-identical); only new strokes use the new family blending.
