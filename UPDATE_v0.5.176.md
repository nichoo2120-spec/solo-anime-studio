# Solo Anime Studio v0.5.176 — Opens faster

## What changed
- **The START .bat now opens the optimised app.** Before, the offline folder had about 190 separate, unminified files that the browser fetched one by one, and downloaded again on every launch. Now it loads one small optimised app file (same code, same tools), sent compressed. The browser keeps it in its cache, so the second and later launches are faster again.
- **Reopening your last project:** the app now reads only that project from browser storage, not every saved project first.
- **Big projects no longer freeze the window in one long block while opening.** Each layer is prepared in its own short step. The pixels are exactly the same (same drawing code, just split into steps).
- **Developer start (`npm run dev`)** pre-bundles React and the icons up front and prepares the main files early.
- New command: `npm run build:offline` rebuilds the offline app after a code change.

## What did not change
- No tool, panel or brush was removed or simplified. Brush pixels are byte-identical to v0.5.175.
- Same address (http://127.0.0.1:5211/), so your saved projects are still there.

## Known limit
- Opening a very big project still takes time: the app must redraw every stroke of every layer. With 10 busy layers this is about 2–3 seconds on a normal PC (longer on a slow one). The window now stays usable between layers. A saved-pixels cache would cut this, but it is not byte-exact yet, so it was not shipped.
