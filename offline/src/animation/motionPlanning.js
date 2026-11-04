import { uid } from '../core/model.js';
import { frameList, currentFrameIndex, enableIndependentLayers, isLayerHeld } from './timeline.js';
import { selectable, boundsOf, transformedStroke } from '../engine/strokeSelection.js';
import { transformVector } from '../engine/vector.js';
export const MAX_NOTES = 240, MAX_ARCS = 12, MAX_ARC_POINTS = 30, MAX_MOTION_DOTS = 16;
const blank = () => ({ version: 1, notes: [], arcs: [] });
function metadata(project) { return project.motionPlanning ?? blank(); }
export function currentTimingNote(project) {
    const frame = frameList(project)[currentFrameIndex(project)];
    return metadata(project).notes.find(note => note.frameId === frame.id)?.text ?? '';
}
export function setCurrentTimingNote(project, text) {
    const value = text.slice(0, 240), baseProject = project.animation ? project : enableIndependentLayers(project), existing = metadata(baseProject), frameId = frameList(baseProject)[currentFrameIndex(baseProject)].id;
    const previous = existing.notes.find(n => n.frameId === frameId);
    if ((previous?.text ?? '') === value)
        return project;
    const notes = existing.notes.filter(n => n.frameId !== frameId);
    if (value) {
        if (notes.length >= MAX_NOTES)
            return project;
        notes.push({ id: previous?.id ?? uid(), frameId, text: value });
    }
    return { ...baseProject, motionPlanning: { ...existing, notes } };
}
export function createMotionArc(project, name, layerId = project.activeLayerId) {
    const baseProject = project.animation ? project : enableIndependentLayers(project), base = metadata(baseProject);
    if (base.arcs.length >= MAX_ARCS || !baseProject.layers.some(l => l.id === layerId))
        return project;
    return { ...baseProject, motionPlanning: { ...base, arcs: [...base.arcs, { id: uid(), name: name.trim().slice(0, 60) || 'Motion path', layerId, points: [], mode: 'auto' }] } };
}
/** New paths default to Auto; saved pre-v0.5.37 arcs remain manual until enabled. */
export function motionPathMode(arc) { return arc.mode === 'auto' ? 'auto' : 'independent'; }
export function setMotionPathMode(project, id, mode) {
    if (mode !== 'auto' && mode !== 'independent')
        return project;
    const base = metadata(project), arc = base.arcs.find(a => a.id === id);
    if (!arc || arc.mode === mode)
        return project;
    return { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id === id ? { ...a, mode } : a) } };
}
export function removeMotionArc(project, id) {
    const base = metadata(project), arcs = base.arcs.filter(a => a.id !== id);
    return arcs.length === base.arcs.length ? project : { ...project, motionPlanning: { ...base, arcs } };
}
export function setMotionArcPoint(project, arcId, frameId, x, y) {
    if (![x, y].every(Number.isFinite) || Math.abs(x) > 100000 || Math.abs(y) > 100000)
        return project;
    const base = metadata(project), arc = base.arcs.find(a => a.id === arcId);
    if (!arc || !frameList(project).some(f => f.id === frameId))
        return project;
    if (!arc.points.some(pt => pt.frameId === frameId) && arc.points.length >= MAX_ARC_POINTS)
        return project;
    const points = [...arc.points.filter(pt => pt.frameId !== frameId), { frameId, x, y }];
    const order = new Map(frameList(project).map((frame, i) => [frame.id, i]));
    points.sort((a, b) => (order.get(a.frameId) ?? 0) - (order.get(b.frameId) ?? 0));
    return { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id === arcId ? { ...a, points } : a) } };
}
export function removeMotionArcPoint(project, arcId, frameId) {
    const base = metadata(project), arc = base.arcs.find(a => a.id === arcId);
    if (!arc || !arc.points.some(p => p.frameId === frameId))
        return project;
    return { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id === arcId ? { ...a, points: a.points.filter(pt => pt.frameId !== frameId) } : a) } };
}
/** Animator-first setup: one selected subject, range, and Create Path click.
 * Every frame on a subject-only layer can be bound without guessing. If the layer
 * also has other artwork, only matching stroke IDs are accepted on other frames;
 * unrelated artwork must NEVER be silently enrolled as the selected hand.
 * Adds the path, safe bindings, and its key positions in a single Undo operation.
 * No path analysis runs during normal pen input.
 */
export function createQuickMotionPath(project, start, end, selectedIds) {
    const frames = frameList(project), layer = project.layers.find(l => l.id === project.activeLayerId);
    const sourceId = project.animation?.activeFrameId ?? frames[0]?.id;
    const sourceIndex = frames.findIndex(f => f.id === sourceId);
    if (!layer || layer.locked || !layer.visible || layer.reference)
        return { project, bound: 0, skipped: 0, reason: 'Choose a visible, unlocked drawing layer first.' };
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= frames.length || end <= start || end - start >= MAX_ARC_POINTS || sourceIndex < start || sourceIndex > end)
        return { project, bound: 0, skipped: 0, reason: 'Choose a range of at least two frames that includes the currently selected frame.' };
    const sourceOps = selectable({ ...layer, operations: frames[sourceIndex].drawings[layer.id] ?? [] });
    const selectedSet = new Set(selectedIds);
    const selected = sourceOps.filter(o => selectedSet.has(o.id));
    if (!selected.length)
        return { project, bound: 0, skipped: 0, reason: 'Press S and select the ball or hand on the current frame first.' };
    // When the artist selected the entire drawing layer, its content is explicitly
    // treated as the subject on each frame. Otherwise ONLY stable ID matches qualify.
    const subjectOnly = selected.length === sourceOps.length;
    const bindings = [];
    const measured = [];
    let skipped = 0;
    for (let i = start; i <= end; i++) {
        const frame = frames[i];
        if (isLayerHeld(project, layer.id, frame.id) || project.animation?.celLinks?.[layer.id]?.[frame.id]) {
            skipped++;
            continue;
        }
        const ops = selectable({ ...layer, operations: frame.drawings[layer.id] ?? [] });
        const chosen = subjectOnly ? ops : ops.filter(o => selectedSet.has(o.id));
        if (!chosen.length) {
            skipped++;
            continue;
        }
        const bounds = boundsOf(chosen);
        if (!bounds) {
            skipped++;
            continue;
        }
        bindings.push({ frameId: frame.id, operationIds: chosen.map(o => o.id) });
        measured.push({ frameId: frame.id, x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2, index: i });
    }
    if (bindings.length < 2)
        return { project, bound: 0, skipped, reason: 'At least two independently drawn frames are needed. For a hand mixed with body strokes, give the hand its own layer, or use Advanced to select it on each frame.' };
    const first = measured[0], last = measured[measured.length - 1];
    const middle = measured.reduce((best, p) => Math.abs(p.index - (first.index + last.index) / 2) < Math.abs(best.index - (first.index + last.index) / 2) ? p : best, first);
    const anchors = [first, ...middle.frameId === first.frameId || middle.frameId === last.frameId ? [] : [middle], last];
    const path = { id: uid(), name: 'Motion Path ' + (metadata(project).arcs.length + 1), layerId: layer.id, points: anchors.map(({ frameId, x, y }) => ({ frameId, x, y })), bindings, mode: 'auto' };
    const base = metadata(project);
    if (base.arcs.length >= MAX_ARCS)
        return { project, bound: 0, skipped, reason: 'Too many motion paths. Delete an unused path first.' };
    const setup = { ...project, motionPlanning: { ...base, arcs: [...base.arcs, path] } };
    // Initial adjustment is part of the same Undo step as Create Path. Afterwards,
    // dragging any point or the curve updates all bound frames on pointer release.
    const aligned = alignBoundDrawingsToArc(setup, path.id);
    return { project: aligned.project, bound: bindings.length, skipped };
}
/** Restrict path movement to explicit selected strokes on one frame and one layer.
 * A per-frame binding stores only IDs, not geometry or raster snapshots. */
export function bindArcStrokes(project, arcId, frameId, operationIds) {
    const arc = metadata(project).arcs.find(a => a.id === arcId), frame = frameList(project).find(f => f.id === frameId);
    if (!arc || !frame || !operationIds.length || isLayerHeld(project, arc.layerId, frameId))
        return project;
    if (project.animation?.celLinks?.[arc.layerId]?.[frameId])
        return project;
    const layer = project.layers.find(l => l.id === arc.layerId);
    if (!layer || layer.locked || !layer.visible || layer.reference)
        return project;
    const selected = new Set(operationIds);
    const ids = selectable({ ...layer, operations: frame.drawings[arc.layerId] ?? [] }).filter(o => selected.has(o.id)).map(o => o.id);
    if (!ids.length || ids.length > 1500)
        return project;
    const bindings = [...(arc.bindings ?? []).filter(b => b.frameId !== frameId), { frameId, operationIds: ids }];
    if (bindings.length > MAX_ARC_POINTS)
        return project;
    return { ...project, motionPlanning: { ...metadata(project), arcs: metadata(project).arcs.map(a => a.id === arcId ? { ...a, bindings } : a) } };
}
/** Faster option when the animated ball/character has its own layer.
 * Excludes hold cells and linked drawings; no other layer is touched. */
export function bindArcLayerRange(project, arcId, start, end) {
    const arc = metadata(project).arcs.find(a => a.id === arcId), frames = frameList(project);
    if (!arc || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= frames.length || end - start >= MAX_ARC_POINTS)
        return project;
    const layer = project.layers.find(l => l.id === arc.layerId);
    if (!layer || layer.locked || !layer.visible || layer.reference)
        return project;
    let next = project;
    for (let i = start; i <= end; i++) {
        const f = frames[i];
        if (isLayerHeld(project, arc.layerId, f.id) || project.animation?.celLinks?.[arc.layerId]?.[f.id])
            continue;
        const ids = selectable({ ...layer, operations: f.drawings[arc.layerId] ?? [] }).map(op => op.id);
        if (ids.length)
            next = bindArcStrokes(next, arcId, f.id, ids);
    }
    return next;
}
export function unbindArcFrame(project, arcId, frameId) {
    const base = metadata(project), arc = base.arcs.find(a => a.id === arcId);
    if (!arc?.bindings?.some(b => b.frameId === frameId))
        return project;
    return { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id !== arcId ? a : { ...a, bindings: arc.bindings.filter(b => b.frameId !== frameId) }) } };
}
/** Baseline curve through the existing frame anchors. Smoothly bent by free control dots.
 * All motion computation happens on explicit path editing/overlay, never during pen input. */
function motionRange(arc, frameIds) {
    const order = new Map(frameIds.map((id, i) => [id, i]));
    const times = arc.points.map(p => order.get(p.frameId)).filter((v) => v !== undefined).sort((a, b) => a - b);
    return times.length >= 2 && times[0] < times.at(-1) ? { start: times[0], end: times.at(-1) } : null;
}
function motionBaseAtTime(arc, frameIds, time) {
    const order = new Map(frameIds.map((id, i) => [id, i]));
    const pts = arc.points.map(pt => ({ ...pt, t: order.get(pt.frameId) })).filter((p) => p.t !== undefined).sort((a, b) => a.t - b.t);
    if (pts.length < 2 || time < pts[0].t || time > pts.at(-1).t)
        return null;
    const exact = pts.find(p => p.t === time);
    if (exact)
        return { x: exact.x, y: exact.y };
    let j = 0;
    while (j < pts.length - 2 && pts[j + 1].t < time)
        j++;
    const p = pts[j], q = pts[j + 1], span = q.t - p.t;
    if (span <= 0)
        return null;
    const u = (time - p.t) / span;
    const slope = (at, axis) => {
        if (at === 0)
            return (pts[1][axis] - pts[0][axis]) / (pts[1].t - pts[0].t);
        if (at === pts.length - 1) {
            const last = pts.length - 1;
            return (pts[last][axis] - pts[last - 1][axis]) / (pts[last].t - pts[last - 1].t);
        }
        return (pts[at + 1][axis] - pts[at - 1][axis]) / (pts[at + 1].t - pts[at - 1].t);
    };
    const calc = (axis) => (2 * u ** 3 - 3 * u ** 2 + 1) * p[axis] + (u ** 3 - 2 * u ** 2 + u) * span * slope(j, axis) + (-2 * u ** 3 + 3 * u ** 2) * q[axis] + (u ** 3 - u ** 2) * span * slope(j + 1, axis);
    return { x: calc('x'), y: calc('y') };
}
export function motionTargetAtTime(arc, frameIds, time) {
    const base = motionBaseAtTime(arc, frameIds, time), range = motionRange(arc, frameIds);
    if (!base || !range || !arc.controlDots?.length)
        return base;
    let x = base.x, y = base.y;
    // Each dot bends nearby frames without pulling every frame or introducing a sharp corner.
    const radius = Math.max(1.2, (range.end - range.start) / 2.25);
    for (const dot of arc.controlDots) {
        const dotTime = range.start + dot.fraction * (range.end - range.start);
        const distance = Math.abs(time - dotTime) / radius;
        if (distance >= 1)
            continue;
        const strength = (1 - distance * distance) ** 2;
        x += dot.dx * strength;
        y += dot.dy * strength;
    }
    return { x, y };
}
export function motionTargetAtFrame(project, arc, frameId) {
    const ids = frameList(project).map(f => f.id), t = ids.indexOf(frameId);
    return t < 0 ? null : motionTargetAtTime(arc, ids, t);
}
export function motionControlDotPosition(arc, frameIds, dot) {
    const range = motionRange(arc, frameIds);
    return range ? motionTargetAtTime(arc, frameIds, range.start + dot.fraction * (range.end - range.start)) : null;
}
/** Nearby point on the visible curve for a single canvas click (not a pen-stream operation). */
export function closestMotionCurvePosition(arc, frameIds, x, y) {
    const range = motionRange(arc, frameIds);
    if (!range || ![x, y].every(Number.isFinite))
        return null;
    const steps = Math.max(64, Math.ceil((range.end - range.start) * 30));
    let best = { fraction: 0, distance: Infinity };
    for (let i = 0; i <= steps; i++) {
        const fraction = i / steps, point = motionTargetAtTime(arc, frameIds, range.start + fraction * (range.end - range.start));
        if (!point)
            continue;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < best.distance)
            best = { fraction, distance };
    }
    return best;
}
/** Add a free curve dot without moving any drawings. Its offset starts at zero. */
export function addMotionControlDot(project, arcId, x, y) {
    const base = metadata(project), arc = base.arcs.find(a => a.id === arcId);
    if (!arc || !Number.isFinite(x) || !Number.isFinite(y) || (arc.controlDots?.length ?? 0) >= MAX_MOTION_DOTS)
        return { project };
    const near = closestMotionCurvePosition(arc, frameList(project).map(f => f.id), x, y);
    if (!near || near.fraction <= 0.015 || near.fraction >= 0.985)
        return { project };
    if (arc.controlDots?.some(dot => Math.abs(dot.fraction - near.fraction) < 0.025))
        return { project };
    const dot = { id: uid(), fraction: near.fraction, dx: 0, dy: 0 };
    return { project: { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id === arcId ? { ...a, controlDots: [...(a.controlDots ?? []), dot].sort((a, b) => a.fraction - b.fraction) } : a) } }, dotId: dot.id };
}
function commitControlDotChange(project, arcId, dots, activeFrameId) {
    const base = metadata(project), arc = base.arcs.find(a => a.id === arcId);
    if (!arc)
        return { project, moved: 0 };
    const next = { ...project, motionPlanning: { ...base, arcs: base.arcs.map(a => a.id === arcId ? { ...a, controlDots: dots } : a) } };
    if (motionPathMode(arc) === 'auto' && arc.bindings?.some(b => isLayerHeld(next, arc.layerId, b.frameId) || next.animation?.celLinks?.[arc.layerId]?.[b.frameId]))
        return { project, moved: 0 };
    return alignBoundDrawingsToArc(next, arcId, motionPathMode(arc) === 'independent' ? activeFrameId : undefined);
}
export function moveMotionControlDot(project, arcId, dotId, dx, dy, activeFrameId) {
    if (![dx, dy].every(Number.isFinite) || Math.hypot(dx, dy) < 0.0001)
        return { project, moved: 0 };
    const arc = metadata(project).arcs.find(a => a.id === arcId), dot = arc?.controlDots?.find(d => d.id === dotId);
    if (!arc || !dot || Math.abs(dot.dx + dx) > 100000 || Math.abs(dot.dy + dy) > 100000)
        return { project, moved: 0 };
    return commitControlDotChange(project, arcId, arc.controlDots.map(d => d.id === dotId ? { ...d, dx: d.dx + dx, dy: d.dy + dy } : d), activeFrameId);
}
export function removeMotionControlDot(project, arcId, dotId, activeFrameId) {
    const arc = metadata(project).arcs.find(a => a.id === arcId);
    if (!arc?.controlDots?.some(d => d.id === dotId))
        return { project, moved: 0 };
    return commitControlDotChange(project, arcId, arc.controlDots.filter(d => d.id !== dotId), activeFrameId);
}
/** Guide render uses same motionTargetAtTime as alignment. Without extra dots, retain the
 * original exact cubic segments, preserving appearance and fast legacy behavior. */
export function motionBezierSegments(arc, frameIds) {
    const order = new Map(frameIds.map((id, i) => [id, i]));
    const pts = arc.points.map(pt => ({ ...pt, t: order.get(pt.frameId) })).filter((p) => p.t !== undefined).sort((a, b) => a.t - b.t);
    if (pts.length < 2)
        return [];
    if (arc.controlDots?.length) {
        const segments = [];
        const steps = Math.max(12, Math.ceil((pts.at(-1).t - pts[0].t) * 12));
        const span = pts.at(-1).t - pts[0].t, dt = span / steps;
        const targets = Array.from({ length: steps + 1 }, (_, i) => motionTargetAtTime(arc, frameIds, pts[0].t + i * dt));
        for (let i = 0; i < steps; i++) {
            const a = targets[i], b = targets[i + 1], before = targets[Math.max(i - 1, 0)], after = targets[Math.min(i + 2, steps)];
            const tangentA = { x: (b.x - before.x) / (i === 0 ? 1 : 2), y: (b.y - before.y) / (i === 0 ? 1 : 2) };
            const tangentB = { x: (after.x - a.x) / (i + 2 > steps ? 1 : 2), y: (after.y - a.y) / (i + 2 > steps ? 1 : 2) };
            segments.push({ a, c1: { x: a.x + tangentA.x / 3, y: a.y + tangentA.y / 3 }, c2: { x: b.x - tangentB.x / 3, y: b.y - tangentB.y / 3 }, b });
        }
        return segments;
    }
    const tangent = (j, axis) => {
        const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
        return b.t !== a.t ? (b[axis] - a[axis]) / (b.t - a.t) : 0;
    };
    return pts.slice(1).map((b, i) => {
        const a = pts[i], h = b.t - a.t;
        return { a: { x: a.x, y: a.y }, c1: { x: a.x + h * tangent(i, 'x') / 3, y: a.y + h * tangent(i, 'y') / 3 }, c2: { x: b.x - h * tangent(i + 1, 'x') / 3, y: b.y - h * tangent(i + 1, 'y') / 3 }, b: { x: b.x, y: b.y } };
    });
}
/** Single immutable, undoable project operation; only strokes explicitly bound to
 * this arc are moved. Any locked layer, held cel or linked cel blocks the apply. */
export function alignBoundDrawingsToArc(project, arcId, onlyFrameId) {
    const arc = metadata(project).arcs.find(a => a.id === arcId), frames = project.animation?.frames;
    if (!arc || !frames || !arc.bindings?.length || arc.points.length < 2)
        return { project, moved: 0 };
    const layer = project.layers.find(l => l.id === arc.layerId);
    if (!layer || layer.locked || !layer.visible || layer.reference)
        return { project, moved: 0 };
    // All-or-nothing: never partially adjust one actor if other cels are held/linked.
    for (const binding of arc.bindings) {
        if (onlyFrameId && binding.frameId !== onlyFrameId)
            continue;
        if (isLayerHeld(project, arc.layerId, binding.frameId) || project.animation?.celLinks?.[arc.layerId]?.[binding.frameId])
            return { project, moved: 0 };
    }
    const bindings = new Map(arc.bindings.filter(b => !onlyFrameId || b.frameId === onlyFrameId).map(b => [b.frameId, new Set(b.operationIds)]));
    let moved = 0;
    const updated = frames.map(frame => {
        const ids = bindings.get(frame.id), target = motionTargetAtFrame(project, arc, frame.id);
        if (!ids || !target)
            return frame;
        const operations = frame.drawings[arc.layerId] ?? [];
        const source = selectable({ ...layer, operations }).filter(o => ids.has(o.id));
        const bounds = boundsOf(source);
        if (!bounds)
            return frame;
        const dx = target.x - (bounds.x + bounds.w / 2), dy = target.y - (bounds.y + bounds.h / 2);
        if (Math.hypot(dx, dy) < 0.0001)
            return frame;
        const matrix = [1, 0, 0, 1, dx, dy];
        const next = operations.map(op => !ids.has(op.id) ? op : op.kind === 'stroke' && op.tool === 'brush' ? transformedStroke(op, matrix) : op.kind === 'vector' ? transformVector(op, matrix) : op);
        moved++;
        return { ...frame, drawings: { ...frame.drawings, [arc.layerId]: next } };
    });
    if (!moved)
        return { project, moved: 0 };
    const active = updated.find(f => f.id === project.animation.activeFrameId);
    return { project: { ...project, animation: { ...project.animation, frames: updated }, layers: project.layers.map(l => l.id === arc.layerId ? { ...l, operations: active.drawings[l.id] } : l) }, moved };
}
/** Editing the path immediately adjusts selected artwork on pen-up / input confirm.
 * Auto: all bound frames; Independent: only the point's drawing frame.
 * The metadata + all artwork changes are a single immutable Undo operation.
 * No calculation is performed in the normal brush-stroke path. */
export function editMotionPath(project, arcId, frameId, x, y) {
    const next = setMotionArcPoint(project, arcId, frameId, x, y);
    if (next === project)
        return { project, moved: 0 };
    const arc = next.motionPlanning?.arcs.find(a => a.id === arcId);
    if (!arc || arc.points.length < 2 || !arc.bindings?.length)
        return { project: next, moved: 0 };
    const result = alignBoundDrawingsToArc(next, arcId, motionPathMode(arc) === 'independent' ? frameId : undefined);
    // Never save a path change that claims to move a protected held/linked cel.
    if (motionPathMode(arc) === 'auto' && arc.bindings.some(b => isLayerHeld(next, arc.layerId, b.frameId) || next.animation?.celLinks?.[arc.layerId]?.[b.frameId]))
        return { project, moved: 0 };
    return result;
}
/** When the artist uses Stroke Select -> Move/Freeform on an already bound
 * hand/ball, make that edit a path key. In Auto mode the other frames follow.
 * Reject partial selection of a bound group and preserve all unrelated layers.
 * Called ONLY after an explicit transform, never for ordinary pen drawing. */
export function followBoundSelectionTransform(before, after, selectedIds) {
    const frameId = after.animation?.activeFrameId;
    if (!frameId || !selectedIds.length || !before.motionPlanning)
        return after;
    const selected = new Set(selectedIds);
    for (const arc of before.motionPlanning.arcs) {
        const binding = arc.bindings?.find(b => b.frameId === frameId);
        if (!binding || !binding.operationIds.every(id => selected.has(id)))
            continue;
        if (isLayerHeld(after, arc.layerId, frameId) || after.animation?.celLinks?.[arc.layerId]?.[frameId])
            continue;
        const layer = after.layers.find(l => l.id === arc.layerId);
        if (!layer || layer.locked || !layer.visible || layer.reference)
            continue;
        const ops = selectable(layer).filter(op => binding.operationIds.includes(op.id));
        if (ops.length !== binding.operationIds.length)
            continue;
        const bounds = boundsOf(ops);
        if (!bounds)
            continue;
        const x = bounds.x + bounds.w / 2, y = bounds.y + bounds.h / 2;
        // Do not auto-spread a pure scale/rotation if its center did not move.
        const oldOps = before.layers.find(l => l.id === arc.layerId)?.operations ?? [];
        const oldBounds = boundsOf(selectable({ ...layer, operations: oldOps }).filter(op => binding.operationIds.includes(op.id)));
        if (!oldBounds || Math.hypot(x - (oldBounds.x + oldBounds.w / 2), y - (oldBounds.y + oldBounds.h / 2)) < 0.0001)
            continue;
        return editMotionPath(after, arc.id, frameId, x, y).project;
    }
    return after;
}
/** Measure visible artwork for the current layer. Never stores or alters pixels.
 * Bounding-box center is deliberately predictable and editable, not a pose detector.
 */
export function activeLayerArtworkCenter(project) {
    const layer = project.layers.find(l => l.id === project.activeLayerId);
    if (!layer || !layer.operations.length)
        return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (p) => { if (!Number.isFinite(p.x) || !Number.isFinite(p.y))
        return; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); };
    for (const op of layer.operations) {
        if (op.kind === 'stroke') {
            for (const p of op.points)
                visit(p);
        }
        else if (op.kind === 'vector') {
            for (const n of op.nodes)
                visit(n);
        }
        else if (op.kind === 'image') {
            visit({ x: op.x, y: op.y });
            visit({ x: op.x + op.width, y: op.y + op.height });
        }
    }
    return minX === Infinity ? null : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
export function validateMotionPlanning(project) {
    const p = project.motionPlanning;
    if (p === undefined)
        return true;
    if (!p || p.version !== 1 || !Array.isArray(p.notes) || !Array.isArray(p.arcs) || p.notes.length > MAX_NOTES || p.arcs.length > MAX_ARCS)
        return false;
    const frames = new Set(frameList(project).map(f => f.id)), layers = new Set(project.layers.map(l => l.id));
    const noteIDs = new Set(), noteFrames = new Set(), arcIDs = new Set();
    for (const n of p.notes) {
        if (!n || typeof n.id !== 'string' || !n.id || noteIDs.has(n.id) || typeof n.text !== 'string' || !n.text.trim() || n.text.length > 240 || !frames.has(n.frameId) || noteFrames.has(n.frameId))
            return false;
        noteIDs.add(n.id);
        noteFrames.add(n.frameId);
    }
    for (const a of p.arcs) {
        if (!a || typeof a.id !== 'string' || !a.id || arcIDs.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 60 || !layers.has(a.layerId) || !Array.isArray(a.points) || a.points.length > MAX_ARC_POINTS)
            return false;
        if (a.mode !== undefined && a.mode !== 'auto' && a.mode !== 'independent')
            return false;
        if (a.controlDots !== undefined) {
            if (!Array.isArray(a.controlDots) || a.controlDots.length > MAX_MOTION_DOTS)
                return false;
            const ids = new Set();
            for (const d of a.controlDots) {
                if (!d || typeof d.id !== 'string' || !d.id || ids.has(d.id) || typeof d.fraction !== 'number' || d.fraction <= 0 || d.fraction >= 1 || ![d.dx, d.dy].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000))
                    return false;
                ids.add(d.id);
            }
        }
        arcIDs.add(a.id);
        const pointFrames = new Set();
        if (a.bindings !== undefined) {
            if (!Array.isArray(a.bindings) || a.bindings.length > MAX_ARC_POINTS)
                return false;
            const boundFrames = new Set();
            for (const b of a.bindings) {
                if (!b || !frames.has(b.frameId) || boundFrames.has(b.frameId) || !Array.isArray(b.operationIds) || !b.operationIds.length || b.operationIds.length > 1500 || new Set(b.operationIds).size !== b.operationIds.length || b.operationIds.some(id => typeof id !== 'string' || !id || id.length > 120))
                    return false;
                boundFrames.add(b.frameId);
            }
        }
        for (const pt of a.points) {
            if (!pt || !frames.has(pt.frameId) || pointFrames.has(pt.frameId) || ![pt.x, pt.y].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100000))
                return false;
            pointFrames.add(pt.frameId);
        }
    }
    return true;
}
/** Keep old animation drawings and unrelated notes untouched when a cel is deleted. */
export function pruneMotionPlanning(project) {
    if (!project.motionPlanning)
        return project;
    const valid = new Set(frameList(project).map(f => f.id)), original = project.motionPlanning;
    const notes = original.notes.filter(n => valid.has(n.frameId));
    const arcs = original.arcs.map(a => ({ ...a, points: a.points.filter(pt => valid.has(pt.frameId)), ...(a.bindings ? { bindings: a.bindings.filter(b => valid.has(b.frameId)) } : {}) }));
    return notes.length === original.notes.length && arcs.every((a, i) => a.points.length === original.arcs[i].points.length && (a.bindings?.length ?? 0) === (original.arcs[i].bindings?.length ?? 0)) ? project : { ...project, motionPlanning: { ...original, notes, arcs } };
}
