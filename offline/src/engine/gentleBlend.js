import { paintSamples } from './paintPass.js';
import { paintDabs } from './paintDabs.js';
import { finalGeometry } from './geometryCache.js';
const clamp = (v) => Math.max(0, Math.min(1, v));
const surface = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const union = (a, b) => {
    if (!a)
        return { ...b };
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};
const eq = (a, b) => a.x === b.x && a.y === b.y && a.radius === b.radius && a.arc === b.arc && a.angle === b.angle && a.level === b.level;
/** Incrementally diffuses existing colours within a soft round footprint.
 * Unlike a carried-pigment brush, moving over a flat colour cannot create
 * a continuous coloured streak extending out of the brush footprint.
 */
export class GentleBlendGesture {
    target;
    base;
    sampled = surface(1, 1);
    tiny = surface(1, 1);
    softened = surface(1, 1);
    dabs = [];
    processed = 0;
    affected;
    signature;
    constructor(target, base, s) {
        this.target = target;
        this.base = base;
        this.signature = JSON.stringify({ ...s, points: undefined });
    }
    matches(target, base, s) {
        return this.target === target && this.base === base && this.signature === JSON.stringify({ ...s, points: undefined });
    }
    reset() {
        if (this.affected && this.base) {
            const r = this.affected, c = this.target.getContext('2d');
            c.clearRect(r.x, r.y, r.width, r.height);
            c.drawImage(this.base, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
        }
        const restored = this.affected;
        this.processed = 0;
        this.affected = undefined;
        return restored;
    }
    update(ctx, s) {
        const next = paintDabs(s, paintSamples(finalGeometry(s), .18));
        let common = 0;
        while (common < Math.min(this.dabs.length, next.length) && eq(this.dabs[common], next[common]))
            common++;
        // The fitted tail sometimes changes on pointer-up. Recompute from the
        // unchanged source rather than leaving overlapping old smears in the result.
        let changed;
        if (common < this.processed)
            changed = this.reset();
        const amount = clamp(s.mixAmount ?? .44) * clamp(s.opacity) * clamp(s.flow ?? 1);
        if (amount <= 0) {
            this.dabs = next;
            this.processed = next.length;
            return changed;
        }
        for (let i = this.processed; i < next.length; i++) {
            const dab = next[i], radius = Math.max(.1, dab.radius), pad = Math.max(4, Math.ceil(radius * .24));
            const x = Math.max(0, Math.floor(dab.x - radius - pad)), y = Math.max(0, Math.floor(dab.y - radius - pad));
            const right = Math.min(ctx.canvas.width, Math.ceil(dab.x + radius + pad)), bottom = Math.min(ctx.canvas.height, Math.ceil(dab.y + radius + pad));
            const w = right - x, h = bottom - y;
            if (w < 2 || h < 2)
                continue;
            const r = { x, y, width: w, height: h };
            changed = union(changed, r);
            this.affected = union(this.affected, r);
            if (!amount || dab.level <= 0)
                continue;
            if (this.sampled.width !== w)
                this.sampled.width = w;
            if (this.sampled.height !== h)
                this.sampled.height = h;
            const src = this.sampled.getContext('2d');
            src.clearRect(0, 0, w, h);
            src.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
            // 2-pass resampling is a small, bounded local blur. It uses Canvas drawImage
            // rather than getImageData and never reads the whole page per pointer move.
            const down = Math.max(3, Math.min(12, radius * .31));
            const tw = Math.max(2, Math.ceil(w / down)), th = Math.max(2, Math.ceil(h / down));
            if (this.tiny.width !== tw)
                this.tiny.width = tw;
            if (this.tiny.height !== th)
                this.tiny.height = th;
            const tc = this.tiny.getContext('2d');
            tc.clearRect(0, 0, tw, th);
            tc.imageSmoothingEnabled = true;
            tc.imageSmoothingQuality = 'high';
            tc.drawImage(this.sampled, 0, 0, w, h, 0, 0, tw, th);
            if (this.softened.width !== w)
                this.softened.width = w;
            if (this.softened.height !== h)
                this.softened.height = h;
            const sc = this.softened.getContext('2d');
            sc.clearRect(0, 0, w, h);
            sc.imageSmoothingEnabled = true;
            sc.imageSmoothingQuality = 'high';
            sc.drawImage(this.tiny, 0, 0, tw, th, 0, 0, w, h);
            // Only change colours inside the nib. Outside the footprint, and on fully
            // transparent pixels when alpha-lock is selected, nothing is deposited.
            sc.globalCompositeOperation = 'destination-in';
            const cx = dab.x - x, cy = dab.y - y, grad = sc.createRadialGradient(cx, cy, radius * .12, cx, cy, radius);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(.6, 'rgba(255,255,255,.87)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            sc.fillStyle = grad;
            sc.fillRect(0, 0, w, h);
            sc.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.globalAlpha = amount * clamp(dab.level) * .50;
            ctx.globalCompositeOperation = s.blendPreserveAlpha === false ? 'source-over' : 'source-atop';
            ctx.drawImage(this.softened, x, y);
            ctx.restore();
        }
        this.dabs = next;
        this.processed = next.length;
        return changed;
    }
}
let live;
/** Dirty rectangle is the newly processed part, not the entire drag so far. */
export function applyGentleBlend(ctx, _mask, s, _x, _y, _r, base) {
    if (s.opacity <= 0 || s.flow === 0 || !s.points.length)
        return;
    if (!live || live.stroke !== s.id || !live.gesture.matches(ctx.canvas, base, s)) {
        live = { stroke: s.id, target: ctx.canvas, base, gesture: new GentleBlendGesture(ctx.canvas, base, s) };
    }
    return live.gesture.update(ctx, s);
}
export function resetGentleBlend() { live = undefined; }
