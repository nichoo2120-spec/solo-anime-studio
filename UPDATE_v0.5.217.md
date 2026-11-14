# Solo Anime Studio v0.5.217

Earlier editable ink remains sharp when later Mix, paint, or image edits are present on the same layer. Previously the last native paint edit could force every earlier stroke through an enlarged page bitmap, making reopened artwork look softer than new ink. Native edits still use their canonical pixels where they actually change the layer; unaffected ink keeps its display-resolution contours. Live native previews use the same approach, with dirty-footprint restoration and cached settled frames.

Studio Ink and Contour Flow now transform their original clean ink outlines. Stretch, skew, rotation, distort, and perspective retain source pressure, taper, and thick/thin phase instead of repainting the brush along a stretched centreline. Bounds and high-DPI display use those projected outlines. Captured pen samples remain editable and unchanged. Textured, image-grain, and pressure-opacity strokes retain their existing transform renderer.

Validation: TypeScript; 20 transform fidelity cases across both brushes with automatic flow and custom width profiles; exact affine commits, repeated edits, JSON reopen, and native/display consistency; four mixed-layer sharpness and IndexedDB reopen cases, cached-frame checks, and live Mix stability; existing high-DPI pen-up/reopen regression; Windows release checks. Local saved-project investigation stayed local; no personal artwork is included in the regression fixtures.

Use Check for updates in Studio to install this release.
