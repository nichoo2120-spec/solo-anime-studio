const canvas = (width, height) => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
export const workerBlendEligible = (s) => s.tool !== 'eraser' && (!!s.nativeMixVersion || (s.coloringEngine === 1 && s.brushTip === 'color-blender' && (s.coloringAppearanceVersion === 3 || s.smudgeVersion === 2)));
/** Keep the existing browser Canvas pigment calculations off the input thread.
 * One update is in flight; newer input coalesces instead of building a backlog.
 * Canonical export/reload stays synchronous and never receives provisional data. */
export class LiveBlendWorker {
    request;
    worker;
    job;
    token = 0;
    serial = 0;
    failed = false;
    failures = 0;
    surface = canvas(1, 1);
    dirty;
    constructor(request) {
        this.request = request;
    }
    warm() {
        if (this.worker || this.failed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined')
            return;
        try {
            const w = this.worker = new Worker(new URL('./liveBlend.worker.js', import.meta.url), { type: 'module' });
            w.onmessage = e => this.receive(e.data);
            w.onerror = e => { e.preventDefault(); this.fail(); };
            w.onmessageerror = () => this.fail();
        }
        catch {
            this.fail();
        }
    }
    available() { return !!this.worker && !this.failed; }
    fail() { this.failures++; this.failed = true; this.worker?.terminate(); this.worker = undefined; this.cancel(); this.request(); }
    /** A hung worker must not disable Mix for the remainder of the application.
     * Retry on a NEW pen gesture, with a two-failure circuit breaker to avoid
     * repeatedly spawning a broken worker during the same editing session. */
    retryForNewGesture() { if (!this.failed || this.failures >= 2)
        return; this.failed = false; this.warm(); }
    cancel() { const j = this.job; if (j) {
        if (j.timer)
            clearTimeout(j.timer);
        j.resolve?.(undefined);
    } this.job = undefined; this.dirty = undefined; this.token++; this.worker?.postMessage({ kind: 'cancel', token: this.token }); this.surface.width = this.surface.height = 0; }
    dispose() { this.cancel(); this.worker?.terminate(); this.worker = undefined; }
    matches(s, source) { return !!this.job && this.job.id === s.id && this.job.source === source && !this.failed; }
    takeRegion(s) { if (this.job?.id !== s.id)
        return undefined; const r = this.dirty ?? { x: 0, y: 0, width: 0, height: 0 }; this.dirty = undefined; return r; }
    preview(s, source, geometry) {
        this.warm();
        if (!this.worker || this.failed || !workerBlendEligible(s))
            return undefined;
        const signature = JSON.stringify({ ...s, points: undefined });
        if (!this.job || this.job.id !== s.id || this.job.source !== source || this.job.signature !== signature) {
            this.cancel();
            const token = ++this.token, j = { token, id: s.id, source, signature, ready: false, inFlight: false };
            this.job = j;
            this.surface.width = source.width;
            this.surface.height = source.height;
            this.surface.getContext('2d').drawImage(source, 0, 0);
            createImageBitmap(source).then(bitmap => { if (this.job !== j) {
                bitmap.close();
                return;
            } this.worker.postMessage({ kind: 'begin', token, width: source.width, height: source.height, base: bitmap }, [bitmap]); j.ready = true; this.flush(j); }).catch(() => this.fail());
        }
        const j = this.job;
        if (j.geometry !== geometry) {
            j.geometry = geometry;
            j.queued = { stroke: s, final: false };
            this.flush(j);
        }
        return this.surface;
    }
    finish(s) {
        const j = this.job;
        if (!j || j.id !== s.id || this.failed)
            return undefined;
        const preview = this.surface, done = new Promise(resolve => { j.resolve = resolve; });
        j.queued = { stroke: s, final: true };
        this.flush(j);
        return { preview, done };
    }
    flush(j) { if (this.job !== j || !j.ready || j.inFlight || !j.queued)
        return; const q = j.queued; j.queued = undefined; j.inFlight = true; const serial = ++this.serial; this.worker.postMessage({ kind: 'update', token: j.token, serial, stroke: q.stroke, final: q.final }); j.timer = setTimeout(() => this.fail(), 5000); }
    receive(reply) {
        const j = this.job;
        if (!j || reply.token !== j.token) {
            reply.bitmap?.close();
            return;
        }
        if (j.timer)
            clearTimeout(j.timer);
        j.timer = undefined;
        j.inFlight = false;
        if (reply.error || !reply.bitmap || !reply.region) {
            reply.bitmap?.close();
            this.fail();
            return;
        }
        const r = reply.region, c = this.surface.getContext('2d');
        c.clearRect(r.x, r.y, r.width, r.height);
        c.drawImage(reply.bitmap, r.x, r.y);
        reply.bitmap.close();
        const old = this.dirty;
        if (old) {
            const x = Math.min(old.x, r.x), y = Math.min(old.y, r.y);
            this.dirty = { x, y, width: Math.max(old.x + old.width, r.x + r.width) - x, height: Math.max(old.y + old.height, r.y + r.height) - y };
        }
        else
            this.dirty = r;
        if (reply.final) {
            const result = this.surface;
            this.surface = canvas(1, 1);
            this.job = undefined;
            j.resolve?.(result);
        }
        else
            this.flush(j);
        this.request();
    }
}
