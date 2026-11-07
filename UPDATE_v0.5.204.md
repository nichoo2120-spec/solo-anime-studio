# Solo Anime Studio 0.5.204

Advanced settings can now import PNG, JPG or WebP images up to 10 MB as brush grain for the six editable Ink brushes. Images become compact 64x64 repeating luminance tiles, combined with the existing brush texture while retaining the chosen drawing colour. Strength, scale, invert and removal controls are included. Imported grain is disabled in Mix mode and does not yet apply to paint-material or fixed pencil brushes.

The texture is embedded in the preset and each new stroke, so saved drawings reopen without the original file. Existing artwork is unchanged. The display renderer correctly falls back for imported grain; custom Technical Pen nibs also avoid the native round-line shortcut.

Validation: actual rendered pixel differences for image, strength, scale and inversion; zero-strength equivalence, embedded project replay, invalid image/settings rejection, UI reload/removal, and local simulated-pen stability at pen-up/reopen. Existing full desktop and compatibility tests remain enabled.

The separately requested width-point editor remains unfinished and is not part of this texture-import release.
