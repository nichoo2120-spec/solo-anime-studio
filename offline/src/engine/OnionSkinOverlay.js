import { onionNeighbors, DEFAULT_ONION_SETTINGS } from '../animation/onionSkin.js';
import { sanitizeLightTablePins } from '../animation/lightTable.js';
import { frameList } from '../animation/timeline.js';
import { LayerRenderer, makeCanvas, context } from './renderer.js';
/** A separate, pointer-transparent canvas. No onion skin raster work happens in the
 * document's pen-move or stroke-render path; neighboring frames are prepared at idle.
 */
export class OnionSkinOverlay {
    isDrawing;
    surface;
    paintFrame = 0;
    hasContent = false;
    project;
    settings = { ...DEFAULT_ONION_SETTINGS };
    view = { x: 0, y: 0, zoom: 1, rotation: 0 };
    width = 1;
    height = 1;
    dpr = 1;
    ghosts = new Map();
    neighbors = [];
    pins = [];
    task;
    taskKind;
    generation = 0;
    disposed = false;
    signature = '';
    constructor(parent, project, isDrawing) {
        this.isDrawing = isDrawing;
        this.project = project;
        this.surface = document.createElement('canvas');
        this.surface.className = 'onion-skin-overlay';
        this.surface.setAttribute('aria-hidden', 'true');
        parent.appendChild(this.surface);
        this.update(project);
    }
    /** Avoid rerasterizing or repainting large pinned guides after ordinary pen commits.
     * The engine's document subscriber already calls update(project) for frame edits.
     */
    setPins(pins) {
        const next = sanitizeLightTablePins(this.project, pins);
        if (next.length === this.pins.length && next.every((pin, i) => {
            const old = this.pins[i];
            return pin.frameId === old.frameId && pin.opacity === old.opacity && pin.dx === old.dx && pin.dy === old.dy && pin.scale === old.scale && pin.angle === old.angle && pin.tint === old.tint;
        }))
            return;
        this.pins = next;
        this.update(this.project);
    }
    setSettings(settings) {
        const rebuild = this.settings.currentLayerOnly !== settings.currentLayerOnly;
        this.settings = settings;
        if (rebuild) {
            this.ghosts.clear();
            this.signature = '';
        }
        this.update(this.project);
        this.paint();
    }
    setView(view, width, height, dpr) {
        this.view = view;
        if (width !== this.width || height !== this.height || dpr !== this.dpr) {
            this.width = width;
            this.height = height;
            this.dpr = dpr;
            this.hasContent = false;
            this.surface.width = Math.max(1, Math.round(width * dpr));
            this.surface.height = Math.max(1, Math.round(height * dpr));
        }
        this.requestPaint();
    }
    update(project) {
        const lastNeighbors = this.neighbors;
        this.project = project;
        this.pins = sanitizeLightTablePins(project, this.pins);
        const frames = frameList(project);
        this.neighbors = [...onionNeighbors(project, this.settings).map(n => ({ ...n, color: n.color, dx: 0, dy: 0, scale: 1, angle: 0 })),
            ...this.pins.filter(pin => pin.frameId !== project.animation?.activeFrameId).map(pin => ({ frame: frames.find(f => f.id === pin.frameId), kind: 'pin', opacity: pin.opacity / 100, color: pin.tint === 'original' ? null : pin.tint === 'teal' ? '#53bdde' : '#e87986', dx: pin.dx, dy: pin.dy, scale: pin.scale, angle: pin.angle }))];
        // A changed frame id, layer visibility, or neighboring operation array requires
        // an updated ghost. Current-frame pen strokes do not affect this signature.
        const scoped = project.layers.filter(l => l.visible && !l.reference);
        const signature = [project.id, project.width, project.height, project.activeLayerId, this.settings.currentLayerOnly,
            ...scoped.map(l => `${l.id}:${l.opacity}:${l.blend ?? 'normal'}`)].join('|');
        if (signature === this.signature && lastNeighbors.length === this.neighbors.length &&
            this.neighbors.every((n, i) => n.frame === lastNeighbors[i].frame && n.kind === lastNeighbors[i].kind && n.opacity === lastNeighbors[i].opacity && n.color === lastNeighbors[i].color && n.dx === lastNeighbors[i].dx && n.dy === lastNeighbors[i].dy && n.scale === lastNeighbors[i].scale && n.angle === lastNeighbors[i].angle))
            return;
        if (signature !== this.signature) {
            this.signature = signature;
            this.ghosts.clear();
        }
        this.generation++;
        this.cancelTask();
        // Only reuse a cached neighboring cel when both its frame object and its layer
        // presentation remain unchanged. Cache holds only requested ghosts/pins (at most 10 onion ghosts plus pinned guides).
        const ids = new Set(this.neighbors.map(n => this.key(n)));
        for (const id of this.ghosts.keys())
            if (!ids.has(id))
                this.ghosts.delete(id);
        this.paint();
        this.schedule();
    }
    key(n) { return `${n.frame.id}:${n.kind}:${n.color ?? 'original'}`; }
    cancelTask() { if (this.task !== undefined) {
        if (this.taskKind === 'idle' && 'cancelIdleCallback' in window)
            window.cancelIdleCallback(this.task);
        else
            clearTimeout(this.task);
        this.task = undefined;
        this.taskKind = undefined;
    } }
    schedule() {
        if (this.disposed || !this.neighbors.some(n => this.ghosts.get(this.key(n))?.frame !== n.frame))
            return;
        const generation = this.generation;
        const render = () => {
            this.task = undefined;
            this.taskKind = undefined;
            if (this.disposed || generation !== this.generation)
                return;
            if (this.isDrawing()) {
                // Never queue another idle callback immediately during an active pen stroke.
                // A pending Light Table ghost waits quietly until a short pause in drawing.
                this.taskKind = 'timeout';
                this.task = window.setTimeout(render, 100);
                return;
            }
            void this.prepareOne(generation);
        };
        if (this.isDrawing()) {
            this.taskKind = 'timeout';
            this.task = window.setTimeout(render, 100);
        }
        else if ('requestIdleCallback' in window) {
            this.taskKind = 'idle';
            this.task = window.requestIdleCallback(render, { timeout: 300 });
        }
        else {
            this.taskKind = 'timeout';
            this.task = setTimeout(render, 32);
        }
    }
    async prepareOne(generation) {
        const neighbor = this.neighbors.find(n => this.ghosts.get(this.key(n))?.frame !== n.frame);
        if (!neighbor)
            return;
        const project = this.project, scoped = project.layers.filter(l => l.visible && !l.reference && (neighbor.kind === 'pin' || !this.settings.currentLayerOnly || l.id === project.activeLayerId));
        // No recomposition on frame hover, pen motion, or slider movement. This temporary
        // renderer cannot evict the active drawing engine's layer caches.
        const snapshot = { ...project, animation: undefined, layers: scoped.map(l => ({ ...l, operations: neighbor.frame.drawings[l.id] ?? [] })) };
        if (!snapshot.layers.some(l => l.operations.length)) {
            if (!this.disposed && generation === this.generation)
                this.ghosts.set(this.key(neighbor), { frame: neighbor.frame, signature: this.signature, canvas: makeCanvas(1, 1) });
        }
        else {
            const renderer = new LayerRenderer();
            try {
                await renderer.prepare(snapshot);
                if (this.disposed || generation !== this.generation)
                    return;
                if (this.isDrawing()) {
                    this.schedule();
                    return;
                }
                const original = renderer.composite(snapshot, { transparent: true, includeReferences: false });
                // Ten full-HD ghosts would consume ~80 MB even when the pen is idle.
                // Keep reference pins at full resolution, but bound each onion ghost to
                // 1024 px wide (a fast, lower-memory display-only texture).
                const ratio = neighbor.kind === 'pin' ? 1 : Math.min(1, 1024 / original.width);
                const w = Math.max(1, Math.round(original.width * ratio)), h = Math.max(1, Math.round(original.height * ratio));
                const needsCopy = neighbor.color !== null || ratio < 1;
                const tinted = needsCopy ? makeCanvas(w, h) : original;
                if (needsCopy) {
                    const ctx = context(tinted);
                    ctx.drawImage(original, 0, 0, w, h);
                    if (neighbor.color) {
                        ctx.globalCompositeOperation = 'source-in';
                        ctx.fillStyle = neighbor.color;
                        ctx.fillRect(0, 0, w, h);
                        ctx.globalCompositeOperation = 'source-over';
                    }
                }
                if (!this.disposed && generation === this.generation)
                    this.ghosts.set(this.key(neighbor), { frame: neighbor.frame, signature: this.signature, canvas: tinted });
            }
            catch (error) {
                console.warn('Onion skin preview unavailable:', error);
                if (!this.disposed && generation === this.generation)
                    this.ghosts.set(this.key(neighbor), { frame: neighbor.frame, signature: this.signature, canvas: makeCanvas(1, 1) });
            }
            finally {
                renderer.clear();
            }
        }
        if (!this.disposed && generation === this.generation) {
            this.paint();
            this.schedule();
        }
    }
    drawable() { return this.neighbors.some(n => { const ghost = this.ghosts.get(this.key(n)); return ghost?.frame === n.frame && ghost.canvas.width > 1; }); }
    requestPaint() { if (this.disposed || this.paintFrame || !this.hasContent && !this.drawable())
        return; this.paintFrame = requestAnimationFrame(() => { this.paintFrame = 0; this.paint(); }); }
    paint() {
        if (this.disposed)
            return;
        if (this.paintFrame) {
            cancelAnimationFrame(this.paintFrame);
            this.paintFrame = 0;
        }
        if (!this.hasContent && !this.drawable())
            return;
        const ctx = this.surface.getContext('2d');
        if (!ctx)
            return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.surface.width, this.surface.height);
        this.hasContent = false;
        if (!this.settings.enabled && !this.pins.length)
            return;
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.translate(this.view.x, this.view.y);
        ctx.rotate(this.view.rotation);
        ctx.scale(this.view.zoom, this.view.zoom);
        ctx.beginPath();
        ctx.rect(0, 0, this.project.width, this.project.height);
        ctx.clip();
        for (const n of this.neighbors) {
            const ghost = this.ghosts.get(this.key(n));
            if (!ghost || ghost.frame !== n.frame || ghost.canvas.width <= 1)
                continue;
            this.hasContent = true;
            ctx.globalAlpha = n.opacity;
            ctx.save();
            ctx.translate(n.dx + this.project.width / 2, n.dy + this.project.height / 2);
            ctx.rotate(n.angle * Math.PI / 180);
            ctx.scale(n.scale, n.scale);
            ctx.translate(-this.project.width / 2, -this.project.height / 2);
            ctx.drawImage(ghost.canvas, 0, 0, this.project.width, this.project.height);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    dispose() { if (this.paintFrame)
        cancelAnimationFrame(this.paintFrame); this.paintFrame = 0; this.disposed = true; this.generation++; this.cancelTask(); this.ghosts.clear(); this.surface.remove(); }
}
