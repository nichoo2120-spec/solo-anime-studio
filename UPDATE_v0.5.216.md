# Solo Anime Studio v0.5.216

Brush Settings shows one natural curved sample in every section. Removed the artificial repeated wiggles previously added in Smoothing; the selected brush supplies its own thickness, texture, taper, and smoothing through the existing drawing engine.

The preview continues updating during slider movement. Blender thumbnails start each redraw as a fresh sample, so switching settings sections cannot discard their blending effect. Existing drawing behavior and saved artwork are unchanged.

Validation: TypeScript; 192 section consistency checks across all 32 presets; 32 distinct brush samples; rendered centreline check rejecting repeated waves; brush switching; 143 existing preview checks; 11 continuous-drag checks with distinct rendered frames before pointer release; Windows release checks.

Use Check for updates in Studio to install this release.
