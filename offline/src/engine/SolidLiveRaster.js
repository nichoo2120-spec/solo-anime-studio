import { drawSolidInkV10 } from './solidInkV10.js';
/** The native fill batches and their ordering stay intact. Retain completed
 * batches on a display-resolution surface and restore only the changing tail. */
export class SolidLiveRaster {
    lastRegion;
    lastPaths;
    lastBuiltDabs = 0;
    lastReused = 0;
    stable;
    surface;
    key = '';
    id = '';
    count = 0;
    previous;
    paths;
    dirty;
    base;
    baseToken;
    matches(s) { return this.id === s.id; }
    clear() { for (const c of [this.stable, this.surface])
        if (c)
            c.width = c.height = 0; this.stable = this.surface = undefined; this.key = ''; this.id = ''; this.count = 0; this.previous = undefined; this.paths = undefined; this.dirty = undefined; this.lastRegion = undefined; this.lastPaths = undefined; this.base = undefined; this.baseToken = undefined; }
    paint(s, g, m, w, h, base, baseToken) {
        const { points: raw, ...settings } = s, key = JSON.stringify([settings, m.a, m.b, m.c, m.d, m.e, m.f, w, h]);
        const stable = this.stable ??= document.createElement('canvas'), surface = this.surface ??= document.createElement('canvas');
        const paths = [], info = { ends: [], states: [], previous: key === this.key && this.previous && this.paths ? { info: this.previous, paths: this.paths } : undefined };
        const scale = Math.hypot(m.a, m.b), quality = Math.max(1, Math.ceil(scale * 2 - 1e-6) / 2);
        drawSolidInkV10(surface.getContext('2d'), s, g, undefined, quality, paths, info);
        info.previous = undefined;
        const count = info.reused ?? 0;
        const reset = key !== this.key || count < this.count || stable.width !== w || stable.height !== h || base !== this.base || baseToken !== this.baseToken;
        if (reset) {
            stable.width = surface.width = w;
            stable.height = surface.height = h;
            this.count = 0;
            this.dirty = undefined;
            if (base)
                stable.getContext('2d').drawImage(base, 0, 0);
        }
        const sc = stable.getContext('2d');
        sc.setTransform(m);
        sc.fillStyle = s.color;
        for (let i = this.count; i < count; i++)
            sc.fill(paths[i]);
        this.count = count;
        if (reset) {
            const ctx = surface.getContext('2d');
            ctx.resetTransform();
            ctx.drawImage(stable, 0, 0);
        }
        const start = count ? Math.max(0, info.ends[count - 1] - 1) : 0, pad = s.size * Math.max(1, s.maxSize ?? 1) + 3;
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const p of (info.points ?? []).slice(start))
            for (const dx of [-pad, pad])
                for (const dy of [-pad, pad]) {
                    const x = m.a * (p.x + dx) + m.c * (p.y + dy) + m.e, y = m.b * (p.x + dx) + m.d * (p.y + dy) + m.f;
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);
                }
        const rect = { x: Math.max(0, Math.floor(left)), y: Math.max(0, Math.floor(top)), w: 0, h: 0 };
        rect.w = Math.max(0, Math.min(w, Math.ceil(right)) - rect.x);
        rect.h = Math.max(0, Math.min(h, Math.ceil(bottom)) - rect.y);
        const prior = this.dirty, x = Math.min(rect.x, prior?.x ?? rect.x), y = Math.min(rect.y, prior?.y ?? rect.y), R = Math.max(rect.x + rect.w, prior ? prior.x + prior.w : 0), B = Math.max(rect.y + rect.h, prior ? prior.y + prior.h : 0), ctx = surface.getContext('2d');
        ctx.resetTransform();
        if (R > x && B > y) {
            ctx.clearRect(x, y, R - x, B - y);
            ctx.drawImage(stable, x, y, R - x, B - y, x, y, R - x, B - y);
        }
        ctx.setTransform(m);
        ctx.fillStyle = s.color;
        for (let i = count; i < paths.length; i++)
            ctx.fill(paths[i]);
        ctx.resetTransform();
        this.lastBuiltDabs = info.builtDabs ?? 0;
        this.lastReused = count;
        this.lastPaths = { scale: quality, items: paths };
        this.lastRegion = reset ? undefined : { x, y, w: Math.max(0, R - x), h: Math.max(0, B - y) };
        this.dirty = rect;
        this.key = key;
        this.id = s.id;
        this.previous = info;
        this.paths = paths;
        this.base = base;
        this.baseToken = baseToken;
        return surface;
    }
}
