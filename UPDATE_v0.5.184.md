# v0.5.184 Smoother Pencil and Soft Paint

Studio updates the layer preview around the current stroke instead of copying the entire layer whenever the Pencil or Soft Paint preview recalculates. This cuts the delay on large drawing surfaces, including the expanded workspace.

In a 1920 × 1080 test project with the workspace expanded, the 95th-percentile render time fell from 46 to 7 ms for Pencil and from 44 to 16 ms for Soft Paint. These measurements used simulated pen input.