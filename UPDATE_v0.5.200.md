# Solo Anime Studio v0.5.200

Two new presets are available in Brush Studio → Ink:

- **Studio Ink** — a round, opaque nib with gentle pressure changes and a longer taper for clean sketching and linework.
- **Contour Flow** — a round nib with a stronger pressure curve, finer light passages and shorter taper for expressive thin–thick–thin contours. Mouse velocity taper is enabled by default: slower mouse movement is thicker and faster movement is thinner. Turn it off in Pressure limits and mouse taper for constant mouse width. Pen input uses actual pressure.

Both new brush identities use live refinement revision 3, exact captured endpoints and the continuous round native ink sweep at small as well as large sizes. Their completed curve is not refitted on pen-up. Pressure, taper and brush identity remain editable saved stroke data. Existing brush defaults and saved stroke renderers are unchanged; library restoration adds the two presets without resetting the selected brush.

Validation: typecheck; preset migration and pressure/geometry unit coverage; simulated pen input through the real drawing engine; stable settled artwork, identical pen-up artwork and exact saved reopen at the tested view; native/display nib parity at several sizes including zero-width pressure passages; actual renderer swatch PNG; UI selection and restored preset preference. The Windows workflow includes these checks and the existing drawing, tabs and Mix checks. Historical compatibility replays the old baseline's exact recorded cases independently of new catalog additions.

The samples demonstrate rendering and simulated input, not a physical-tablet test or proof that the previously reported whole-screen glitch is resolved.
