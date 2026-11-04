# Solo Anime Studio v0.5.165 — saving-stall mitigation

## Evidence from the 1 November 2026 screen recording

At 127.0.0.1:5211, v0.5.164 shows the status **Saving…** throughout a 16.7-second recording. Canvas artwork does not visibly change, but some brush controls are still responsive. The chosen brush is **Coloring > Blender**, 32% opacity (which is a blending rather than ordinary colour-depositing preset). This is not proof that autosave caused the brush lag, but it exposes a storage operation that can monopolize memory and/or leave the status hanging.

## Source changes

- `src/core/persistence.ts`: upgrade IndexedDB from schema 2 to schema 3; create the compound `by-project-saved-at` metadata index. After saving, traverse **keys only** of the current project's snapshots and delete all but the latest 10. Previously `rawSnapshots()` loaded and cloned **every stored snapshot's full artwork** just to remove old ones. The snapshot browser now retrieves only the selected project's records. Existing project and snapshot object stores are retained in the migration. This does not modify brush rendering, strokes, canvases, or tool-wheel code.
- `src/core/AutosaveWriter.ts`: if a worker save stalls for 30 seconds, reject it with a clear error and free the worker instead of holding `Saving…` indefinitely. Clear watchdogs after successful saves. Existing last successful saves are never intentionally overwritten by this fallback.
- `tests/phase2b-large-audio-storage.cjs`: model the IndexedDB compound index and verify repeated saves keep the newest project and ten recovery snapshots while preserving audio deduplication.
- `tests/regression/performance-v165.cjs`: protect the new retention and timeout path.
- `package.json`, `src/core/buildInfo.ts`: set version 0.5.165.

## What has **not** been verified

- The recording alone cannot prove that saving is the only cause of the pointer issue.
- Full Chromium app pixel parity, 20 ms frame/50 ms pen-up/50 ms undo targets and a new real-device Wacom check are **not verified** here.
- The complete build requires npm dependencies, which are not present in this container and cannot be fetched because the npm registry is unreachable. `dist` in this ZIP is the previous compiled bundle; the Windows launcher must rebuild the updated source.
- Blend/Paint algorithms and the editable UI are untouched. Mix mode is not started.

## Use

Back up the previous project and any `.solo.json` exports before upgrading. Close *all* other Solo Anime Studio browser tabs when opening the upgraded app for the first time because an open v2 IndexedDB connection can block the v3 migration. Extract the **complete ZIP** in a separate folder and launch `START SOLO ANIME STUDIO.bat`. Check that the version badge says 0.5.165.
