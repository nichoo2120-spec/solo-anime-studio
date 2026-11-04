# Solo Anime Studio v0.5.167 — Paint/Mix brush workflow

This update changes the brush workflow so mixing is available as a mode on the active brush instead of as separate Blender brush presets.

## What changed

- Added a **Paint / Mix** toggle to Brush Studio.
- Added a **Paint / Mix** toggle path to the circular Tool Wheel area.
- Added keyboard behavior: press **B** to select Brush, and when Brush is already active press **B** again to switch between **Paint** and **Mix**.
- Hidden the stock blending presets from the normal preset lists:
  - Blender
  - Smudge Bristle
  - Blender Soft
  - Wet Mix
- Kept compatibility for old work:
  - old strokes made with those presets still render as before
  - old saved brush selections migrate to a matching normal brush + Mix mode
- Added Mix controls on normal brushes:
  - Mix strength
  - Pickup
  - Wetness
  - Streaks
  - Paint load
- Kept the old per-brush custom settings system and project loading flow.

## Source files touched

- `src/core/brushes.ts`
- `src/engine/StudioEngine.ts`
- `src/ui/App.tsx`
- `src/ui/BrushStudio.tsx`
- `src/ui/RadialToolbar.tsx`
- `src/styles.css`
- `src/core/buildInfo.ts`
- `package.json`

## Note

This archive is delivered as a **complete source project ZIP**.
If dependencies are not already installed on the target machine, run the normal studio launcher/build flow after extracting.
