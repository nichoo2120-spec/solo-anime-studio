# Solo Anime Studio v0.5.210

Sharper display of brush thickness profiles.

Width-profile Ink strokes were excluded from the display-resolution ink renderer. Enlarged or high-DPI views therefore showed a scaled page bitmap, causing pixel-wide steps and soft-looking thin edges. Clean profile ink now uses the same screen-resolution path renderer as other clean Ink strokes.

The navigation and sharp-view workers also retain the profile and custom tip instead of treating Technical Pen profiles as a uniform native stroke. Brush settings, captured points, document dimensions and native PNG export are preserved.

Validation: all six Ink profiles at 125%, 200% and 400% display scales; profile shape retained in the main renderer and workers; identical native export before/after display; twelve standard pen cases and six additional high-DPI pen cases with zero settled-prefix, pen-lift or reopen pixel changes. Existing ink and paint compatibility remains in release CI.

This corrects the display of clean profile ink. Intentional brush grain, soft painting materials, and the pixel limits of imported bitmap images remain part of those materials.
