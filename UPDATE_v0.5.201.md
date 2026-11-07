# Solo Anime Studio 0.5.201

Studio Ink and Contour Flow now create automatic thin–thick–thin passages with steady pen pressure or mouse input. Studio Ink is gentler; Contour Flow has stronger contrast.

- Flow contrast controls the strength; Flow spacing controls the distance between accents (with a minimum of three brush diameters).
- Pressure → width can be enabled to combine tablet pressure with automatic flow. Defaults use automatic flow without requiring pressure changes.
- Width phase is anchored to distance from pen-down, so extending a stroke does not move completed accents.
- Saved older strokes and existing custom copies retain their original appearance. The two stock brushes gain the corrected defaults while preserving customized size and other settings.

Validation: constant-input pixel-width measurements, live/pen-up/reopen stability, native/display parity, saved v0.5.200 pixel compatibility, preset migration and validation, and the existing desktop checks. This release does not claim to resolve the separately reported tablet drawing jerk.
