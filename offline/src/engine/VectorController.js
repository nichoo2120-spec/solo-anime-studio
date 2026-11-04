import { mirrorMatrix } from './symmetry.js';
import { activeLayer, editLayer, newLayer, uid } from '../core/model.js';
import { bounds, transformMatrix } from '../core/geometry.js';
import { createVector, createCleanFreehandVector, transformVector, vectorDistance, vectorCubics, adjustVectorSmoothness, drawVector } from './vector.js';
import { flattenCubic, intersectsPolygon } from './strokeGeometry.js';
import { gestureCorner, refineCapturedPath } from './strokeProcessing.js';
import { StreamingVectorInk } from './StreamingVectorInk.js';
/** Cheap, non-destructive spatial cleanup before editable Bezier fitting.
 * Protects expressive corners and the endpoints while suppressing tablet jitter. */
export function smoothFreehandSamples(points, amount) {
    if (amount <= 0 || points.length < 5)
        return points;
    const protectedPoints = new Set();
    for (let i = 1; i < points.length - 1; i++)
        if (gestureCorner(points, i))
            protectedPoints.add(i);
    let current = refineCapturedPath(points, Math.min(100, amount * .9), points, (list, i) => protectedPoints.has(i));
    const blend = Math.min(.52, Math.max(0, amount) / 100 * .34), passes = amount >= 75 ? 3 : amount >= 35 ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
        const next = current.map(p => ({ ...p }));
        for (let i = 1; i < current.length - 1; i++) {
            if (protectedPoints.has(i) || protectedPoints.has(i - 1) || protectedPoints.has(i + 1))
                continue;
            const a = current[i - 1], p = current[i], b = current[i + 1];
            const u = Math.hypot(p.x - a.x, p.y - a.y), v = Math.hypot(b.x - p.x, b.y - p.y);
            if (u < .01 || v < .01)
                continue;
            const cosine = ((p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)) / (u * v);
            if (cosine < .3)
                continue;
            const t = u / (u + v), tx = a.x + (b.x - a.x) * t, ty = a.y + (b.y - a.y) * t;
            next[i].x = p.x + (tx - p.x) * blend;
            next[i].y = p.y + (ty - p.y) * blend;
        }
        current = next;
    }
    return current;
}
export class VectorController {
    store;
    settings;
    request;
    notify;
    mirror;
    mode = 'freehand';
    width = 5;
    opacity = 1;
    pressure = true;
    smoothness = 65;
    stabilization = 12;
    minWidthPercent = 20;
    maxWidthPercent = 100;
    taperStart = 0;
    taperEnd = 0;
    selectedId = null;
    draft;
    drag;
    preview;
    liveInk;
    onSelect = () => { };
    constructor(store, settings, request, notify, mirror = () => ({ enabled: false, axis: 'vertical', center: .5 })) {
        this.store = store;
        this.settings = settings;
        this.request = request;
        this.notify = notify;
        this.mirror = mirror;
    }
    get drawing() { return !!this.drag; }
    get lastPressure() { return this.drag?.samples?.at(-1)?.p ?? this.draft?.nodes.at(-1)?.p ?? .5; }
    resolveInitialPressure(pressure) { const g = this.drag; if (!g?.samples?.length)
        return; g.samples[0] = { ...g.samples[0], p: pressure }; g.dirty = true; this.liveInk = undefined; }
    selected() { return activeLayer(this.store.getSnapshot()).operations.find(o => o.kind === 'vector' && o.id === this.selectedId); }
    select(id) { this.selectedId = id; this.onSelect(id); this.request(); }
    down(p, zoom, pen) {
        const doc = this.store.getSnapshot(), layer = activeLayer(doc);
        if (layer.locked || !layer.visible || layer.reference) {
            this.notify('Choose an unlocked, visible art layer to draw.');
            return;
        }
        if (layer.kind !== 'vector' && doc.layers.length >= 100) {
            this.notify('Projects support up to 100 layers.');
            return;
        }
        if (this.mode === 'edit' && layer.kind !== 'vector') {
            this.notify('Select a vector layer to edit its lines.');
            return;
        }
        const selected = this.selected();
        let handle;
        if (this.mode === 'edit' && selected) {
            for (let index = 0; index < selected.nodes.length && !handle; index++) {
                const n = selected.nodes[index];
                for (const kind of ['anchor', 'in', 'out']) {
                    const h = kind === 'anchor' ? n : n[kind];
                    if (Math.hypot(h.x - p.x, h.y - p.y) < 8 / zoom) {
                        handle = { index, kind };
                        break;
                    }
                }
            }
        }
        const hit = this.mode === 'edit' ? (handle ? selected : [...layer.operations].reverse().find(o => o.kind === 'vector' && vectorDistance(o, p) < 8 / zoom + o.width / 2)) : undefined;
        if (this.mode === 'edit' && !hit) {
            this.select(null);
            return;
        }
        const s = this.settings();
        this.drag = { layer: layer.kind === 'vector' ? layer : newLayer('Vector Lines', 'vector'), start: p, initial: hit, handle, newLayer: layer.kind !== 'vector', samples: this.mode === 'freehand' ? [{ ...p }] : undefined, zoom, settings: { smoothness: this.smoothness, stabilization: this.stabilization, width: this.width, opacity: this.opacity, color: s.color, minWidthPercent: this.minWidthPercent, maxWidthPercent: this.maxWidthPercent, taperStart: this.taperStart, taperEnd: this.taperEnd, pressureCurve: s.pressureCurve } };
        this.draft = hit ?? (this.mode === 'freehand' ? { ...createCleanFreehandVector(uid(), [p], this.width, s.color, this.pressure && pen), opacity: this.opacity, pressureCurve: s.pressureCurve, profileVersion: 5, minWidthPercent: this.minWidthPercent, maxWidthPercent: this.maxWidthPercent, taperStart: this.taperStart, taperEnd: this.taperEnd } : { ...createVector(uid(), p, p, false, this.width, s.color, this.pressure && pen), opacity: this.opacity, pressureCurve: s.pressureCurve, profileVersion: 5, minWidthPercent: this.minWidthPercent, maxWidthPercent: this.maxWidthPercent, taperStart: this.taperStart, taperEnd: this.taperEnd });
        if (hit)
            this.select(hit.id);
        else
            this.selectedId = null;
        this.updatePreview();
    }
    move(p, preview = true) {
        const g = this.drag;
        if (!g || !this.draft)
            return;
        const dx = p.x - g.start.x, dy = p.y - g.start.y;
        if (g.initial) {
            if (g.handle) {
                const nodes = g.initial.nodes.map(n => ({ ...n, in: { ...n.in }, out: { ...n.out } })), node = nodes[g.handle.index];
                if (g.handle.kind === 'anchor') {
                    node.x += dx;
                    node.y += dy;
                    node.in.x += dx;
                    node.in.y += dy;
                    node.out.x += dx;
                    node.out.y += dy;
                }
                else {
                    node[g.handle.kind].x += dx;
                    node[g.handle.kind].y += dy;
                }
                this.draft = { ...g.initial, nodes, sourceNodes: undefined };
            }
            else
                this.draft = transformVector(g.initial, [1, 0, 0, 1, dx, dy]);
        }
        else if (g.samples) {
            const last = g.samples[g.samples.length - 1];
            if (Math.hypot(p.x - last.x, p.y - last.y) < .025 && Math.abs(p.p - last.p) < .01)
                return;
            g.samples.push({ ...p });
            g.dirty = true; // collect every valid pen sample; defer expensive Bezier fitting until the next paint frame
        }
        else {
            const s = this.settings();
            this.draft = { ...createVector(this.draft.id, g.start, p, false, this.width, s.color, this.draft.pressure), opacity: this.opacity, pressureCurve: s.pressureCurve, profileVersion: 5, minWidthPercent: this.minWidthPercent, maxWidthPercent: this.maxWidthPercent, taperStart: this.taperStart, taperEnd: this.taperEnd };
        }
        if (preview) {
            if (g.samples && !g.initial)
                this.request();
            else
                this.updatePreview();
        }
    }
    moveSamples(samples) {
        const g = this.drag;
        if (!g)
            return;
        if (g.samples && !g.initial && this.draft) {
            for (const p of samples) {
                const last = g.samples.at(-1);
                if (Math.hypot(p.x - last.x, p.y - last.y) >= .025 || Math.abs(p.p - last.p) >= .01) {
                    g.samples.push({ ...p });
                }
            }
            g.dirty = true;
            this.request(); // The next paint updates only the unfinished near-pen section.
        }
        else {
            for (const p of samples)
                this.move(p, false);
            this.updatePreview();
        }
    }
    /** A late coalesced sample belongs at its original timestamp, not after the
     * current tip. Rebuild only this in-progress gesture from ordered capture. */
    replaceCapturedSamples(points) {
        const g = this.drag;
        if (!g?.samples || g.initial || !points.length)
            return;
        g.samples = [{ ...points[0] }];
        this.liveInk = undefined;
        this.moveSamples(points.slice(1));
        g.dirty = true;
    }
    /** Completed sections remain fixed. The live renderer and final saved line
     * share those same sections, without a whole-stroke refit on pen-up. */
    ink(points) {
        const g = this.drag;
        this.liveInk ??= new StreamingVectorInk({ ...g.settings, id: this.draft.id, pressure: this.draft.pressure });
        this.liveInk.update(points);
        return this.liveInk;
    }
    prepareRender(final = false) {
        const g = this.drag;
        if (!g?.dirty || !g.samples || !this.draft || !final)
            return;
        this.draft = this.ink(g.samples).snapshot();
        g.dirty = false;
        this.updatePreview(false);
    }
    renderLivePath(ctx, points) {
        const g = this.drag;
        if (!g?.settings || !this.draft || !points.length)
            return;
        this.ink(points).render(ctx);
    }
    up(p) {
        if (!this.drag || !this.draft)
            return;
        if (p.p <= 0)
            p = { ...p, p: this.drag.samples?.at(-1)?.p ?? this.draft.nodes.at(-1).p };
        this.move(p, false);
        if (this.drag.samples)
            this.drag.dirty = true;
        this.prepareRender(true);
        const g = this.drag, line = this.draft;
        const changed = g.initial ? JSON.stringify(g.initial.nodes) !== JSON.stringify(line.nodes) : g.samples ? g.samples.length > 0 : Math.hypot(line.nodes.at(-1).x - line.nodes[0].x, line.nodes.at(-1).y - line.nodes[0].y) > .1;
        this.cancel();
        if (changed) {
            const doc = this.store.getSnapshot(), sym = this.mirror();
            const reflection = mirrorMatrix(sym, doc);
            const mirrored = !g.initial && sym.enabled ? { ...transformVector(line, reflection), id: uid() } : null;
            const layer = { ...g.layer, operations: g.initial ? g.layer.operations.map(o => o.id === line.id ? line : o) : [...g.layer.operations, line, ...(mirrored ? [mirrored] : [])] };
            this.store.commit(g.newLayer ? { ...doc, version: 3, layers: [layer, ...doc.layers], activeLayerId: layer.id } : editLayer(doc, layer.id, { operations: layer.operations }), g.initial ? 'Edit vector geometry' : 'Draw vector line');
            this.select(line.id);
        }
    }
    cancel() { this.drag = undefined; this.draft = undefined; this.preview = undefined; this.liveInk = undefined; this.request(); }
    updatePreview(schedule = true) { const g = this.drag; if (!g || !this.draft)
        return; const sym = this.mirror(), doc = this.store.getSnapshot(), reflection = mirrorMatrix(sym, doc); const mirrored = !g.initial && sym.enabled ? transformVector(this.draft, reflection) : null; this.preview = { ...g.layer, operations: g.initial ? g.layer.operations.map(o => o.id === this.draft.id ? this.draft : o) : [...g.layer.operations, this.draft, ...(mirrored ? [{ ...mirrored, id: uid() }] : [])] }; if (schedule)
        this.request(); }
    layerPreview(layer) {
        // Keep saved vector layer cache stable during freehand capture.
        if (this.drag?.samples && !this.drag.initial)
            return layer;
        return this.preview?.id === layer.id ? this.preview : layer;
    }
    renderNewLayer(ctx) {
        const g = this.drag;
        if (g?.samples && !g.initial && this.draft) {
            // Draw the freehand preview directly in the document-space canvas.
            // v0.5.100's offscreen copy made live ink disappear on some setups.
            this.renderLivePath(ctx, g.samples);
            const sym = this.mirror(), doc = this.store.getSnapshot();
            if (sym.enabled) {
                ctx.save();
                ctx.transform(...mirrorMatrix(sym, doc));
                this.renderLivePath(ctx, g.samples);
                ctx.restore();
            }
            return;
        }
        if (g?.newLayer && this.draft)
            drawVector(ctx, this.draft);
    }
    commit(line, label) { const doc = this.store.getSnapshot(), layer = activeLayer(doc); if (layer.locked || !layer.visible) {
        this.notify('Unlock and show the vector layer before editing.');
        return;
    } this.store.commit(editLayer(doc, layer.id, { operations: layer.operations.map(o => o.id === line.id ? line : o) }), label); this.select(line.id); }
    style(patch) { const line = this.selected(); if (line)
        this.commit({ ...line, ...patch, profileVersion: line.profileVersion ?? 4 }, 'Edit vector style'); }
    smooth(amount) { const line = this.selected(); if (line)
        this.commit(adjustVectorSmoothness(line, amount), 'Vector smoothness'); }
    transform(dx, dy, scale, angle) { const line = this.selected(); if (!line)
        return; const b = bounds(line.nodes); this.commit(transformVector(line, transformMatrix(b.x + b.w / 2, b.y + b.h / 2, dx, dy, scale, angle * Math.PI / 180)), 'Transform vector line'); }
    delete() { const doc = this.store.getSnapshot(), layer = activeLayer(doc); if (!this.selectedId || layer.locked || !layer.visible)
        return; this.store.commit(editLayer(doc, layer.id, { operations: layer.operations.filter(o => o.id !== this.selectedId) }), 'Delete vector line'); this.select(null); }
    transformedLayer(layer, polygon, matrix) { return { ...layer, operations: layer.operations.map(o => o.kind === 'vector' && intersectsPolygon(vectorCubics(o).flatMap(c => flattenCubic(c)), polygon) ? transformVector(o, matrix) : o) }; }
    applyLasso(polygon, matrix) { const doc = this.store.getSnapshot(), layer = this.transformedLayer(activeLayer(doc), polygon, matrix); this.store.commit(editLayer(doc, layer.id, { operations: layer.operations }), 'Transform vector lines'); }
    renderHandles(ctx, zoom) { if (this.mode !== 'edit')
        return; const line = this.draft ?? this.selected(); if (!line)
        return; ctx.save(); ctx.strokeStyle = '#0b8c80'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1 / zoom; for (const n of line.nodes) {
        ctx.beginPath();
        ctx.moveTo(n.in.x, n.in.y);
        ctx.lineTo(n.x, n.y);
        ctx.lineTo(n.out.x, n.out.y);
        ctx.stroke();
        for (const h of [n.in, n.out]) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, 4 / zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.fillRect(n.x - 4 / zoom, n.y - 4 / zoom, 8 / zoom, 8 / zoom);
        ctx.strokeRect(n.x - 4 / zoom, n.y - 4 / zoom, 8 / zoom, 8 / zoom);
    } ctx.restore(); }
}
