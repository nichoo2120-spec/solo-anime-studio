/** Phase 2 / Tool 1: real editable drawing frames, without exposure/playback machinery.
 * Operation arrays are structurally shared; frame navigation does NOT rasterize or duplicate pixels.
 */
import { uid } from '../core/model.js';
export const MAX_DRAWING_FRAMES = 240;
/** The number of timeline ticks a single drawing is visible. Default 1 for old projects. */
export const MAX_FRAME_HOLD = 24;
export function frameHold(frame) { return frame.hold ?? 1; }
/** A small linear scan over at most 240 cels, not an image/raster operation. */
export function frameExposureStart(project, index) {
    return frameList(project).slice(0, index).reduce((sum, frame) => sum + frameHold(frame), 1);
}
export function totalExposureFrames(project) {
    return frameList(project).reduce((sum, frame) => sum + frameHold(frame), 0);
}
export function currentExposureRange(project) {
    const index = currentFrameIndex(project), hold = frameHold(frameList(project)[index]), start = frameExposureStart(project, index);
    return { start, end: start + hold - 1, hold };
}
/** Dragging on the screen changes exposure duration, not the image size or cel order. */
export const HOLD_PIXELS_PER_FRAME = 10;
export function holdFromDrag(initialHold, deltaX) {
    if (!Number.isFinite(deltaX))
        return initialHold;
    return Math.max(1, Math.min(MAX_FRAME_HOLD, initialHold + Math.round(deltaX / HOLD_PIXELS_PER_FRAME)));
}
/** Metadata-only cel timing edit, also supporting a cel that is not selected. */
export function setDrawingFrameHoldById(project, id, hold) {
    if (!Number.isInteger(hold) || hold < 1 || hold > MAX_FRAME_HOLD)
        return project;
    const p = prepared(project), a = p.animation, index = !project.animation && id === 'legacy-first-frame' ? 0 : a.frames.findIndex(frame => frame.id === id);
    if (index < 0 || frameHold(a.frames[index]) === hold)
        return project;
    const frames = [...a.frames], frame = frames[index];
    frames[index] = { ...frame, ...(hold === 1 ? {} : { hold }) };
    if (hold === 1)
        delete frames[index].hold;
    return { ...p, animation: { ...a, frames } };
}
/** Change only exposure metadata, never stroke arrays or the visible drawing. */
export function setDrawingFrameHold(project, hold) {
    return setDrawingFrameHoldById(project, frameList(project)[currentFrameIndex(project)].id, hold);
}
export function hasIndependentLayers(project) { return !!project.animation?.layerHolds; }
export function isLayerHeld(project, layerId, frameId) {
    return !!project.animation?.layerHolds?.[layerId]?.held.includes(frameId);
}
export function layerKeyStart(project, layerId, index) {
    const frames = frameList(project);
    while (index > 0 && isLayerHeld(project, layerId, frames[index].id))
        index--;
    return index;
}
export function layerKeyEnd(project, layerId, index) {
    const frames = frameList(project);
    let end = index;
    while (end + 1 < frames.length && isLayerHeld(project, layerId, frames[end + 1].id))
        end++;
    return end;
}
/** Build visible frame drawings from held keys, preserving frame identity if unchanged.
 * The same Operation[] reference is shared across a hold (not duplicated or rasterized).
 */
function resolveHolds(frames, tracks) {
    if (!Object.keys(tracks).length)
        return frames;
    let changed = false;
    const last = {};
    const heldSets = Object.fromEntries(Object.entries(tracks).map(([id, t]) => [id, new Set(t.held)]));
    const result = frames.map((frame, index) => {
        let drawings = frame.drawings;
        for (const [layerId, track] of Object.entries(tracks)) {
            const isHeld = index > 0 && heldSets[layerId].has(frame.id);
            const source = isHeld ? (last[layerId] ?? frame.drawings[layerId] ?? []) : (track.stash[frame.id] ?? frame.drawings[layerId] ?? []);
            if (drawings[layerId] !== source) {
                if (drawings === frame.drawings)
                    drawings = { ...drawings };
                drawings[layerId] = source;
            }
            last[layerId] = source;
        }
        if (drawings !== frame.drawings) {
            changed = true;
            return { ...frame, drawings };
        }
        return frame;
    });
    return changed ? result : frames;
}
export function enableIndependentLayers(project) {
    if (hasIndependentLayers(project))
        return project;
    const p = prepared(project);
    return { ...p, animation: { ...p.animation, layerHolds: {} } };
}
/** Extend/shorten ONE layer's cel without altering other layers or global timing.
 * Target is an inclusive frame index. Crossing another key preserves that artwork
 * in stash so shortening can restore it exactly.
 */
export function setLayerHoldEnd(project, layerId, startId, endIndex) {
    if (!project.layers.some(l => l.id === layerId))
        return project;
    const p = enableIndependentLayers(project), a = p.animation, frames = a.frames;
    const start = frames.findIndex(f => f.id === startId);
    if (start < 0 || !Number.isInteger(endIndex) || endIndex < start || endIndex >= frames.length)
        return project;
    const existing = a.layerHolds[layerId] ?? { held: [], stash: {} };
    if (existing.held.includes(startId))
        return project;
    const oldEnd = layerKeyEnd(p, layerId, start);
    if (endIndex === oldEnd)
        return project;
    const held = new Set(existing.held), stash = { ...existing.stash };
    for (let i = start + 1; i <= Math.max(oldEnd, endIndex); i++) {
        const f = frames[i];
        if (i <= endIndex) {
            if (!held.has(f.id)) {
                stash[f.id] = f.drawings[layerId] ?? [];
                held.add(f.id);
            }
        }
        else if (held.delete(f.id)) { /* Restore the original cel and un-stash it. */ }
    }
    const restored = [...frames];
    for (let i = endIndex + 1; i <= oldEnd; i++) {
        const id = frames[i].id;
        if (id in stash) {
            restored[i] = { ...restored[i], drawings: { ...restored[i].drawings, [layerId]: stash[id] } };
            delete stash[id];
        }
    }
    const tracks = { ...a.layerHolds, [layerId]: { held: [...held], stash } };
    const resolved = resolveHolds(restored, tracks);
    const active = resolved.find(f => f.id === a.activeFrameId);
    return { ...p, animation: { ...a, frames: resolved, layerHolds: tracks }, layers: p.layers.map(l => l.id === layerId ? { ...l, operations: active.drawings[l.id] ?? [] } : l) };
}
/** Turn a held position into an independent drawing. Duplicate the visible artwork
 * for an editable new key, or create a completely blank key. */
export function insertLayerKey(project, layerId, frameId, duplicate = true) {
    if (!isLayerHeld(project, layerId, frameId))
        return project;
    const a = project.animation, frames = a.frames, index = frames.findIndex(f => f.id === frameId);
    if (index < 0)
        return project;
    const old = a.layerHolds[layerId], held = old.held.filter(id => id !== frameId), stash = { ...old.stash };
    const source = duplicate ? [...(frames[index].drawings[layerId] ?? [])] : [];
    delete stash[frameId];
    const tracks = { ...a.layerHolds, [layerId]: { held, stash } };
    const updated = [...frames];
    updated[index] = { ...updated[index], drawings: { ...updated[index].drawings, [layerId]: source } };
    const resolved = resolveHolds(updated, tracks), active = resolved.find(f => f.id === a.activeFrameId);
    return { ...project, animation: { ...a, frames: resolved, layerHolds: tracks }, layers: project.layers.map(l => l.id === layerId ? { ...l, operations: active.drawings[l.id] ?? [] } : l) };
}
function frameFromLayers(project) {
    return { id: uid(), drawings: Object.fromEntries(project.layers.map(layer => [layer.id, layer.operations])) };
}
export function frameList(project) {
    return project.animation?.frames ?? [{ id: 'legacy-first-frame', drawings: Object.fromEntries(project.layers.map(l => [l.id, l.operations])) }];
}
export function currentFrameIndex(project) {
    if (!project.animation)
        return 0;
    return Math.max(0, project.animation.frames.findIndex(f => f.id === project.animation.activeFrameId));
}
/** Ensure that a recorded drawing commit also updates the current cel, with no copying of pixels. */
export function syncActiveFrame(project) {
    const timeline = project.animation;
    if (!timeline)
        return project;
    const validIds = new Set(project.layers.map(l => l.id));
    const activeIndex = currentFrameIndex(project);
    const frames = timeline.frames;
    const layerTracks = timeline.layerHolds;
    const tracks = layerTracks ? Object.fromEntries(Object.entries(layerTracks).filter(([id]) => validIds.has(id))) : undefined;
    const heldSets = tracks ? Object.fromEntries(Object.entries(tracks).map(([id, t]) => [id, new Set(t.held)])) : undefined;
    // Capture the visible active frame's edits in its source key, so editing held
    // artwork updates the SAME drawing throughout the hold (not a phantom copy).
    let changed = false;
    const newFrames = [...frames];
    const active = frames[activeIndex];
    const keyChanges = {};
    for (const layer of project.layers) {
        if (layer.operations !== active.drawings[layer.id]) {
            const anchor = tracks ? layerKeyStart(project, layer.id, activeIndex) : activeIndex;
            keyChanges[layer.id] = layer.operations;
            const frame = newFrames[anchor];
            newFrames[anchor] = { ...frame, drawings: { ...frame.drawings, [layer.id]: layer.operations } };
            changed = true;
        }
    }
    // An edit to ANY member of an explicitly linked group updates its other keys.
    // Only changed active layers are visited; frame flipping never duplicates art.
    const links = timeline.celLinks;
    if (links) {
        for (const [layerId, ops] of Object.entries(keyChanges)) {
            const anchor = tracks ? layerKeyStart(project, layerId, activeIndex) : activeIndex;
            const group = links[layerId]?.[frames[anchor].id];
            if (!group)
                continue;
            for (const [frameId, groupId] of Object.entries(links[layerId])) {
                if (groupId !== group)
                    continue;
                const idx = frames.findIndex(f => f.id === frameId);
                if (idx < 0 || idx === anchor || isLayerHeld(project, layerId, frameId))
                    continue;
                const frame = newFrames[idx];
                if (frame.drawings[layerId] !== ops) {
                    newFrames[idx] = { ...frame, drawings: { ...frame.drawings, [layerId]: ops } };
                    changed = true;
                }
            }
        }
    }
    for (let i = 0; i < frames.length; i++) {
        const frame = newFrames[i];
        let drawings = frame.drawings;
        for (const layer of project.layers) {
            let value = drawings[layer.id];
            if (heldSets && i > 0 && heldSets[layer.id]?.has(frame.id))
                value = newFrames[i - 1].drawings[layer.id] ?? [];
            else if (value === undefined)
                value = [];
            // Key edits are only fed through the anchor; held frames follow it.
            if (drawings[layer.id] !== value) {
                if (drawings === frame.drawings)
                    drawings = { ...drawings };
                drawings[layer.id] = value;
            }
        }
        for (const id of Object.keys(drawings))
            if (!validIds.has(id)) {
                if (drawings === frame.drawings)
                    drawings = { ...drawings };
                delete drawings[id];
            }
        if (drawings !== frame.drawings) {
            newFrames[i] = { ...frame, drawings };
            changed = true;
        }
    }
    const activeFinal = newFrames[activeIndex];
    const refreshedLayers = project.layers.some(l => l.operations !== activeFinal.drawings[l.id]) ?
        project.layers.map(l => l.operations === activeFinal.drawings[l.id] ? l : { ...l, operations: activeFinal.drawings[l.id] ?? [] }) : project.layers;
    const tracksChanged = !!tracks && Object.keys(tracks).length !== Object.keys(layerTracks).length;
    // Remove link metadata for deleted frames/layers or newly held keys.
    let cleanedLinks = timeline.celLinks;
    let linksChanged = false;
    if (cleanedLinks) {
        const frameIds = new Set(newFrames.map(f => f.id));
        for (const [layerId, map] of Object.entries(timeline.celLinks)) {
            const entries = validIds.has(layerId) ? Object.entries(map).filter(([id]) => frameIds.has(id) && !(tracks?.[layerId]?.held.includes(id))) : [];
            const counts = new Map();
            for (const [, group] of entries)
                counts.set(group, (counts.get(group) ?? 0) + 1);
            const kept = entries.filter(([, group]) => (counts.get(group) ?? 0) > 1);
            if (kept.length !== Object.keys(map).length) {
                if (!linksChanged) {
                    cleanedLinks = { ...cleanedLinks };
                    linksChanged = true;
                }
                if (kept.length)
                    cleanedLinks[layerId] = Object.fromEntries(kept);
                else
                    delete cleanedLinks[layerId];
            }
        }
        if (linksChanged && !Object.keys(cleanedLinks).length)
            cleanedLinks = undefined;
    }
    return changed || tracksChanged || linksChanged || refreshedLayers !== project.layers ? { ...project, layers: refreshedLayers, animation: { ...timeline, frames: changed ? newFrames : frames, ...(tracks ? { layerHolds: tracks } : {}), celLinks: linksChanged ? cleanedLinks : timeline.celLinks } } : project;
}
function prepared(project) {
    if (project.animation)
        return syncActiveFrame(project);
    const first = frameFromLayers(project);
    return { ...project, animation: { version: 1, frames: [first], activeFrameId: first.id } };
}
function showFrame(project, id) {
    const timeline = project.animation;
    const frame = timeline.frames.find(f => f.id === id);
    if (!frame)
        return project;
    return { ...project, animation: { ...timeline, activeFrameId: id }, layers: project.layers.map(layer => ({ ...layer, operations: frame.drawings[layer.id] ?? [] })) };
}
export function selectDrawingFrame(project, id) {
    const preparedProject = prepared(project);
    if (preparedProject.animation.activeFrameId === id)
        return project.animation ? project : preparedProject;
    return showFrame(preparedProject, id);
}
export function addDrawingFrame(project) {
    const p = prepared(project), timeline = p.animation;
    if (timeline.frames.length >= MAX_DRAWING_FRAMES)
        return project;
    const index = currentFrameIndex(p);
    const frame = { id: uid(), drawings: Object.fromEntries(p.layers.map(l => [l.id, timeline.layerHolds && l.id !== p.activeLayerId ? p.layers.find(x => x.id === l.id).operations : []])) };
    const tracks = timeline.layerHolds ? Object.fromEntries([...Object.entries(timeline.layerHolds).map(([id, t]) => [id, { ...t }]), ...p.layers.filter(l => l.id !== p.activeLayerId && !timeline.layerHolds?.[l.id]).map(l => [l.id, { held: [], stash: {} }])]) : undefined;
    if (tracks)
        for (const layer of p.layers)
            if (layer.id !== p.activeLayerId) {
                tracks[layer.id] = { ...tracks[layer.id], held: [...tracks[layer.id].held, frame.id] };
            }
    return showFrame({ ...p, animation: { ...timeline, frames: [...timeline.frames.slice(0, index + 1), frame, ...timeline.frames.slice(index + 1)], ...(tracks ? { layerHolds: tracks } : {}) } }, frame.id);
}
export function duplicateDrawingFrame(project) {
    const p = prepared(project), timeline = p.animation;
    if (timeline.frames.length >= MAX_DRAWING_FRAMES)
        return project;
    const index = currentFrameIndex(p);
    const source = timeline.frames[index];
    // New array container but share immutable operation objects with original frame.
    const frame = { id: uid(), drawings: Object.fromEntries(Object.entries(source.drawings).map(([id, ops]) => [id, [...ops]])), ...(frameHold(source) > 1 ? { hold: frameHold(source) } : {}) };
    let tracks = timeline.layerHolds;
    if (tracks) {
        tracks = { ...tracks };
        for (const layer of p.layers)
            if (layer.id !== p.activeLayerId) {
                const old = tracks[layer.id] ?? { held: [], stash: {} };
                tracks[layer.id] = { ...old, held: [...old.held, frame.id] };
            }
    }
    return showFrame({ ...p, animation: { ...timeline, frames: [...timeline.frames.slice(0, index + 1), frame, ...timeline.frames.slice(index + 1)], ...(tracks ? { layerHolds: tracks } : {}) } }, frame.id);
}
export function deleteDrawingFrame(project) {
    const p = prepared(project), timeline = p.animation;
    if (timeline.frames.length <= 1)
        return project;
    const index = currentFrameIndex(p), frames = timeline.frames.filter((_, i) => i !== index);
    const next = frames[Math.min(index, frames.length - 1)];
    let tracks = timeline.layerHolds;
    if (tracks) {
        tracks = Object.fromEntries(Object.entries(tracks).map(([id, t]) => [id, { held: t.held.filter(fid => fid !== timeline.frames[index].id), stash: Object.fromEntries(Object.entries(t.stash).filter(([fid]) => fid !== timeline.frames[index].id)) }]));
        // The first frame must always contain a real cel on every layer.
        for (const track of Object.values(tracks))
            track.held = track.held.filter(fid => fid !== frames[0].id);
    }
    const resolved = tracks ? resolveHolds(frames, tracks) : frames;
    return showFrame({ ...p, animation: { ...timeline, frames: resolved, ...(tracks ? { layerHolds: tracks } : {}) } }, next.id);
}
export function adjacentFrame(project, delta) {
    const frames = frameList(project), i = currentFrameIndex(project), target = frames[Math.max(0, Math.min(frames.length - 1, i + delta))];
    return selectDrawingFrame(project, target.id);
}
