# v0.5.186 Faster drawing in the infinite workspace

Studio keeps finished artwork cached while previewing the current stroke in the infinite workspace. This reduces the slowdown when painting over existing marks beyond the shot.

In the same simulated pen test, the 95th-percentile offscreen render time fell from 32 ms to 7 ms for Pencil and from 205 ms to 41 ms for Soft Paint.

The release checks now test that previews preserve finished artwork and match committed pixels. They also measure Pencil and Soft Paint rendering with the shot offscreen.
