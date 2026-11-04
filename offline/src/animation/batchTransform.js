import { frameList, isLayerHeld } from './timeline.js';
import { boundsOf, selectable, transformedStroke } from '../engine/strokeSelection.js';
import { transformVector } from '../engine/vector.js';
export const MAX_BATCH_CELS = 120;
export function batchTransformCels(project, frameIds, layerIds, values) {
    const { dx, dy, scale } = values;
    const angle = values.angle ?? 0;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(scale) || !Number.isFinite(angle) || Math.abs(angle) > 180 || Math.abs(dx) > 4096 || Math.abs(dy) > 4096 || scale < 0.1 || scale > 3)
        return { project, changed: 0, reason: 'Move must be within 4096 px, Scale 10–300%, and Rotate -180–180°.' };
    if (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001 && Math.abs(scale - 1) < 0.00001 && Math.abs(angle) < 0.00001)
        return { project, changed: 0, reason: 'Enter a move or scale change first.' };
    const frames = frameList(project), byId = new Map(frames.map(f => [f.id, f]));
    const selectedFrames = [...new Set(frameIds)];
    const selectedLayers = [...new Set(layerIds)];
    if (selectedFrames.length < 2 || !selectedLayers.length)
        return { project, changed: 0, reason: 'Shift-click at least two drawing frames, then choose the layer to transform.' };
    if (selectedFrames.some(id => !byId.has(id)) || selectedLayers.some(id => !project.layers.some(l => l.id === id)))
        return { project, changed: 0, reason: 'Your selection includes a frame or layer that no longer exists.' };
    if (selectedFrames.length * selectedLayers.length > MAX_BATCH_CELS)
        return { project, changed: 0, reason: 'Select at most 120 frame/layer cells per batch to keep drawing responsive.' };
    if (selectedLayers.some(id => { const l = project.layers.find(x => x.id === id); return l.locked || !l.visible || l.reference; }))
        return { project, changed: 0, reason: 'Unlock and show the selected drawing layers first. Reference layers cannot be transformed.' };
    const chosenFrameIds = new Set(selectedFrames), chosenLayerIds = new Set(selectedLayers);
    const transformed = new Map();
    let changed = 0, operationCount = 0;
    // Validate ALL selected nonempty cels before changing any. Held, linked,
    // motion-bound or raster-containing drawings must not silently be damaged.
    for (const frameId of selectedFrames) {
        const frame = byId.get(frameId);
        for (const layerId of selectedLayers) {
            if (isLayerHeld(project, layerId, frameId) || project.animation?.celLinks?.[layerId]?.[frameId])
                return { project, changed: 0, reason: 'A selected cel is held or linked. Make it independent first (Option+K) to protect the other frames.' };
            const ops = frame.drawings[layerId] ?? [];
            if (!ops.length)
                continue;
            if (project.motionPlanning?.arcs.some(a => a.layerId === layerId && a.bindings?.some(b => b.frameId === frameId)))
                return { project, changed: 0, reason: 'A selected cel belongs to a Motion Path. Unbind that cel first so its path stays accurate.' };
            if (ops.some(o => !(o.kind === 'stroke' && o.tool === 'brush') && o.kind !== 'vector'))
                return { project, changed: 0, reason: 'This selected cel contains raster fill, erasing, or images. Batch Transform currently supports editable brush/vector strokes only.' };
            operationCount += ops.length;
            if (operationCount > 8000)
                return { project, changed: 0, reason: 'Too many strokes in one batch; select fewer frames to prevent lag.' };
            const visible = selectable({ ...project.layers.find(l => l.id === layerId), operations: ops }), b = boundsOf(visible);
            if (!b)
                continue;
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            const radians = angle * Math.PI / 180, co = Math.cos(radians) * scale, si = Math.sin(radians) * scale;
            const m = [co, si, -si, co, dx + cx - co * cx + si * cy, dy + cy - si * cx - co * cy];
            const next = ops.map(op => op.kind === 'stroke' ? transformedStroke(op, m) : op.kind === 'vector' ? transformVector(op, m) : op);
            if (!transformed.has(frameId))
                transformed.set(frameId, new Map());
            transformed.get(frameId).set(layerId, next);
            changed++;
        }
    }
    if (!changed)
        return { project, changed: 0, reason: 'There are no editable drawings in the selected frames and layers.' };
    if (!project.animation)
        return { project, changed: 0, reason: 'Enable the animation timeline first.' };
    const updated = project.animation.frames.map(frame => { const patches = transformed.get(frame.id); return !patches ? frame : { ...frame, drawings: { ...frame.drawings, ...Object.fromEntries(patches) } }; });
    const active = updated.find(f => f.id === project.animation.activeFrameId);
    const layers = active ? project.layers.map(layer => chosenLayerIds.has(layer.id) && chosenFrameIds.has(active.id) && transformed.get(active.id)?.has(layer.id) ? { ...layer, operations: active.drawings[layer.id] ?? [] } : layer) : project.layers;
    return { project: { ...project, animation: { ...project.animation, frames: updated }, layers }, changed };
}
