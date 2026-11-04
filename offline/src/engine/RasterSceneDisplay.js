import { displayCleanInk } from './InkDisplay.js';
const same = (a, b) => a.project.id === b.project.id && a.project.width === b.project.width && a.project.height === b.project.height && a.renderer === b.renderer && a.revision === b.revision && a.layers.length === b.layers.length && a.layers.every((layer, i) => layer === b.layers[i]);
/** Cache only the bottom raster group. Editable/display-resolution ink and vector
 * layers stay in their existing path above it. A worker composites the exact
 * native pixels once; navigation never rerenders watercolor or repeats every
 * background-layer blend. One acknowledged bitmap at a time bounds transfers. */
export class RasterSceneDisplay {
    request;
    allArtwork;
    layerBitmap;
    entries = new Map();
    pending;
    wanted;
    worker;
    serial = 0;
    task;
    failed = false;
    disposed = false;
    presented;
    constructor(request, allArtwork = false, layerBitmap) {
        this.request = request;
        this.allArtwork = allArtwork;
        this.layerBitmap = layerBitmap;
    }
    group(p, renderer, stopLayerId) {
        if (this.failed || this.disposed || p.width * p.height > 16777216 || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined')
            return;
        const layers = [];
        for (let i = p.layers.length - 1; i >= 0; i--) {
            const layer = p.layers[i];
            if (layer.id === stopLayerId)
                break;
            if (!layer.visible || !layer.operations.length)
                continue;
            if (!this.allArtwork && (layer.kind === 'vector' || layer.operations.some(op => op.kind === 'vector' || op.kind === 'stroke' && displayCleanInk(op))))
                break;
            layers.push(layer);
        }
        if (!layers.length || !this.allArtwork && layers.length === 1 && p.width * p.height < 4194304)
            return;
        return { project: p, layers, renderer, revision: renderer.displayRevision, role: stopLayerId ? 'live' : 'idle' };
    }
    /** Prepare the navigation surface before the first wheel event. */
    warm(p, renderer) { const key = this.group(p, renderer); if (!key)
        return; this.wanted = key; const entry = this.entries.get(key.role); if (!entry || !same(entry.key, key))
        this.schedule(); }
    prepareSurface(surface, p, renderer) {
        const key = this.group(p, renderer);
        if (!key)
            return;
        this.wanted = key;
        const entry = this.entries.get(key.role);
        if (!entry || !same(entry.key, key)) {
            this.schedule();
            return;
        }
        if (this.presented?.entry !== entry || this.presented.surface !== surface) {
            surface.width = p.width;
            surface.height = p.height;
            surface.style.width = p.width + 'px';
            surface.style.height = p.height + 'px';
            surface.getContext('2d').drawImage(entry.levels[0].bitmap, 0, 0);
            this.presented = { entry, surface };
        }
        return new Set(key.layers.map(l => l.id));
    }
    /** Let the browser compositor move the stable preview. Re-rasterizing its
     * textured pixels in Canvas 2D on every tick defeats a fast JS render loop. */
    present(surface, p, renderer, view) { const ids = this.prepareSurface(surface, p, renderer); if (!ids)
        return; const c = Math.cos(view.rotation) * view.zoom, s = Math.sin(view.rotation) * view.zoom; surface.style.transform = `matrix(${c},${s},${-s},${c},${view.x},${view.y})`; return ids; }
    paint(ctx, p, renderer, stopLayerId) {
        // Editing pixels must use the same Canvas 2D layer-by-layer composite as the
        // forced reference redraw. The worker ImageBitmap differs by up to 7 RGBA
        // levels due to premultiplication/rounding. Its asynchronous arrival could
        // therefore change arbitrary background pixels halfway through a gesture.
        // Do not schedule or display a worker raster-group for the editing surface
        // until the worker and canonical paths have proven byte-for-byte parity.
        // Navigation still has its independent all-artwork thumbnail compositor.
        if (!this.allArtwork)
            return undefined;
        const key = this.group(p, renderer, stopLayerId);
        if (!key)
            return;
        const { layers } = key, entry = this.entries.get(key.role);
        this.wanted = key;
        if (entry && same(entry.key, key)) {
            const matrix = ctx.getTransform(), scale = Math.hypot(matrix.a, matrix.b);
            let level = entry.levels[0];
            for (const candidate of entry.levels)
                if (candidate.factor * scale <= 1 + 1e-7)
                    level = candidate;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(level.bitmap, 0, 0, level.bitmap.width * level.factor, level.bitmap.height * level.factor);
            ctx.restore();
            return new Set(layers.map(l => l.id));
        }
        this.schedule();
    }
    schedule() { if (this.pending || this.task || this.disposed || this.failed)
        return; this.task = setTimeout(() => { this.task = undefined; const key = this.wanted, entry = key ? this.entries.get(key.role) : undefined; if (key && (!entry || !same(entry.key, key)))
        void this.prepare(key); }, 0); }
    async prepare(key) {
        const token = ++this.serial, job = { key, token, timer: setTimeout(() => this.fail(), 20000) };
        this.pending = job;
        try {
            const worker = this.worker ??= new Worker(new URL('./rasterScene.worker.js', import.meta.url), { type: 'module' });
            worker.onmessage = event => this.received(event.data);
            worker.onerror = event => { event.preventDefault(); if (this.worker === worker)
                this.fail(); };
            worker.onmessageerror = () => { if (this.worker === worker)
                this.fail(); };
            worker.postMessage({ kind: 'begin', token, width: key.project.width, height: key.project.height });
            for (const layer of key.layers) {
                if (this.pending !== job)
                    return;
                const bitmap = await this.layerBitmap?.(layer, key.project, key.renderer) ?? await createImageBitmap(key.renderer.getDisplay(layer, key.project));
                if (this.pending !== job) {
                    bitmap.close();
                    return;
                }
                const accepted = await new Promise(resolve => { job.ack = resolve; worker.postMessage({ kind: 'layer', token, bitmap, opacity: layer.opacity, blend: layer.blend }, [bitmap]); });
                if (!accepted)
                    return;
            }
            if (this.pending === job)
                worker.postMessage({ kind: 'finish', token });
        }
        catch {
            if (this.pending === job)
                this.fail();
        }
    }
    received(message) {
        const job = this.pending;
        if (!job || job.token !== message.token) {
            message.levels?.forEach(level => level.bitmap.close());
            return;
        }
        if (message.kind === 'layer') {
            job.ack?.(true);
            job.ack = undefined;
            return;
        }
        if (message.kind === 'finish' && message.levels?.length) {
            clearTimeout(job.timer);
            this.pending = undefined;
            const old = this.entries.get(job.key.role);
            old?.levels.forEach(level => level.bitmap.close());
            this.entries.set(job.key.role, { key: job.key, levels: message.levels });
            this.request();
            this.schedule();
            return;
        }
        this.fail();
    }
    fail() { const job = this.pending; if (job) {
        clearTimeout(job.timer);
        job.ack?.(false);
    } this.pending = undefined; this.worker?.terminate(); this.worker = undefined; this.failed = true; this.request(); }
    status() { return { ready: this.entries.size, pending: !!this.pending, failed: this.failed, bytes: [...this.entries.values()].reduce((n, e) => n + e.levels.reduce((n, l) => n + l.bitmap.width * l.bitmap.height * 4, 0), 0) }; }
    clear() { if (this.task)
        clearTimeout(this.task); this.task = undefined; if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.ack?.(false);
    } this.pending = undefined; this.worker?.terminate(); this.worker = undefined; for (const e of this.entries.values())
        e.levels.forEach(level => level.bitmap.close()); this.entries.clear(); if (this.presented)
        this.presented.surface.width = this.presented.surface.height = 0; this.presented = undefined; this.wanted = undefined; this.failed = false; }
    dispose() { this.clear(); this.disposed = true; }
}
