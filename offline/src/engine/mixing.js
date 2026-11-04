import { strokeRasterBounds } from './paintCompositing.js';
const rgb = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
const hex = (c) => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
function paint([r, g, b]) { const w = Math.min(r, g, b); r -= w; g -= w; b -= w; const m = Math.max(r, g, b), y = Math.min(r, g); r -= y; g -= y; let yellow = y; if (b && g) {
    b /= 2;
    g /= 2;
} yellow += g; b += g; const k = m / (Math.max(r, yellow, b) || 1); return [r * k + w, yellow * k + w, b * k + w]; }
function display([r, y, b]) { const w = Math.min(r, y, b); r -= w; y -= w; b -= w; const m = Math.max(r, y, b); let g = Math.min(y, b); y -= g; b -= g; if (b && g) {
    b *= 2;
    g *= 2;
} r += y; g += y; const k = m / (Math.max(r, g, b) || 1); return [r * k + w, g * k + w, b * k + w]; }
export const mixPigment = (a, b, t) => { const x = paint(a), y = paint(b); return display(x.map((v, i) => v + (y[i] - v) * t)); };
/** Bounded snapshot at contact. Pointer movement never reads canvas pixels. */
export class Pickup {
    amount;
    data;
    w;
    h;
    sx;
    sy;
    count = 0;
    last;
    carry;
    constructor(source, amount) {
        this.amount = amount;
        const scale = Math.max(1, Math.sqrt(source.width * source.height / 262144)), c = document.createElement('canvas');
        this.w = c.width = Math.ceil(source.width / scale);
        this.h = c.height = Math.ceil(source.height / scale);
        this.sx = this.w / source.width;
        this.sy = this.h / source.height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, c.width, c.height);
        this.data = ctx.getImageData(0, 0, c.width, c.height).data;
        c.width = c.height = 0;
    }
    update(s, replay = false) {
        if (replay || this.count > s.points.length) {
            this.count = 0;
            this.last = undefined;
            this.carry = undefined;
            s.mixStops = [];
        }
        const base = rgb(s.color);
        for (let i = this.count; i < s.points.length; i++) {
            const p = s.points[i], distance = this.last ? Math.hypot(p.x - this.last.x, p.y - this.last.y) : s.size;
            if (this.last && distance < Math.max(2, s.size * .08) && i !== s.points.length - 1)
                continue;
            let alpha = 0;
            const color = [0, 0, 0];
            for (const [dx, dy] of [[0, 0], [-.22, 0], [.22, 0], [0, -.22], [0, .22]]) {
                const x = Math.floor((p.x + dx * s.size) * this.sx), y = Math.floor((p.y + dy * s.size) * this.sy);
                if (x < 0 || y < 0 || x >= this.w || y >= this.h)
                    continue;
                const k = (y * this.w + x) * 4, a = this.data[k + 3] / 255;
                alpha += a;
                for (let j = 0; j < 3; j++)
                    color[j] += this.data[k + j] / 255 * a;
            }
            const target = alpha ? mixPigment(base, color.map(v => v / alpha), this.amount * Math.sqrt(alpha / 5) * .92) : base, rate = this.carry ? 1 - Math.exp(-distance / Math.max(2, s.size * (alpha ? .25 : 1.8))) : 1;
            this.carry = this.carry ? mixPigment(this.carry, target, rate) : target;
            s.mixStops.push({ x: p.x, y: p.y, color: hex(this.carry) });
            this.last = p;
        }
        this.count = s.points.length;
    }
}
let surface, blended;
/** Color changes preserve the existing coverage, pressure and opacity. */
export function tintMix(ctx, s, region, state) {
    if (s.mixVersion === 2) {
        tintMixFast(ctx, s, region, state);
        return;
    }
    let stops = s.mixStops;
    if (!stops?.length || s.tool === 'eraser')
        return;
    const matrix = ctx.getTransform(), scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    if (!matrix.isIdentity) {
        stops = stops.map(p => ({ ...p, x: matrix.a * p.x + matrix.c * p.y + matrix.e, y: matrix.b * p.x + matrix.d * p.y + matrix.f }));
        region = undefined;
    }
    ctx.save();
    ctx.resetTransform();
    const c = surface ??= document.createElement('canvas');
    if (c.width !== ctx.canvas.width)
        c.width = ctx.canvas.width;
    if (c.height !== ctx.canvas.height)
        c.height = ctx.canvas.height;
    const x = region?.x ?? 0, y = region?.y ?? 0, w = region?.width ?? c.width, h = region?.height ?? c.height;
    if (!w || !h) {
        ctx.restore();
        return;
    }
    const cc = c.getContext('2d');
    const halo = Math.ceil(s.size * scale * .6 + 4);
    cc.save();
    cc.clearRect(0, 0, c.width, c.height);
    cc.fillStyle = stops[0].color;
    cc.fillRect(0, 0, c.width, c.height);
    cc.beginPath();
    cc.rect(x - halo, y - halo, w + halo * 2, h + halo * 2);
    cc.clip();
    cc.lineWidth = s.size * scale * 2.5 + 16;
    cc.lineCap = 'round';
    for (let i = 1; i < stops.length; i++) {
        const a = stops[i - 1], b = stops[i], pad = s.size * scale * 2 + 20;
        if (Math.max(a.x, b.x) + pad < x || Math.min(a.x, b.x) - pad > x + w || Math.max(a.y, b.y) + pad < y || Math.min(a.y, b.y) - pad > y + h)
            continue;
        const g = cc.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, a.color);
        g.addColorStop(1, b.color);
        cc.strokeStyle = g;
        cc.beginPath();
        cc.moveTo(a.x, a.y);
        cc.lineTo(b.x, b.y);
        cc.stroke();
    }
    cc.restore();
    const out = blended ??= document.createElement('canvas');
    if (out.width !== c.width)
        out.width = c.width;
    if (out.height !== c.height)
        out.height = c.height;
    const oc = out.getContext('2d');
    oc.save();
    oc.clearRect(0, 0, out.width, out.height);
    oc.filter = `blur(${Math.max(1, s.size * scale * .14)}px)`;
    oc.drawImage(c, 0, 0);
    oc.filter = 'none';
    oc.globalCompositeOperation = 'destination-in';
    oc.drawImage(ctx.canvas, 0, 0);
    oc.restore();
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(out, x, y, w, h, x, y, w, h);
    ctx.restore();
}
let fastColor, fastOutput;
export class MixColorRaster {
    canvas = document.createElement('canvas');
    key = '';
    stops = [];
    reset() { this.canvas.width = this.canvas.height = 0; this.key = ''; this.stops = []; }
}
/** Only newly drawn/changed gradient segments can recolor settled coverage.
 * Their true pen-coordinate bounds also include stabilizer lag and crossings. */
export function mixColorChangeRegion(old, next, size, width, height) {
    if (!old.length || !next.length || old[0].color !== next[0].color)
        return;
    // A constant colour plane has no changed pixels when a same-colour stop is
    // appended or moved. Alpha still updates through the geometry's dirty region.
    if (old.every(p => p.color === old[0].color) && next.every(p => p.color === old[0].color))
        return null;
    let prefix = 0;
    while (prefix < Math.min(old.length, next.length) && old[prefix].x === next[prefix].x && old[prefix].y === next[prefix].y && old[prefix].color === next[prefix].color)
        prefix++;
    if (prefix === old.length && prefix === next.length)
        return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const list of [old, next])
        for (let i = Math.max(0, prefix - 1); i < list.length; i++) {
            const p = list[i];
            left = Math.min(left, p.x);
            top = Math.min(top, p.y);
            right = Math.max(right, p.x);
            bottom = Math.max(bottom, p.y);
        }
    const pad = Math.ceil(size * 1.25 + 10), x = Math.max(0, Math.min(width, Math.floor(left - pad))), y = Math.max(0, Math.min(height, Math.floor(top - pad)));
    return { x, y, width: Math.max(0, Math.min(width, Math.ceil(right + pad)) - x), height: Math.max(0, Math.min(height, Math.ceil(bottom + pad)) - y) };
}
/** Smooth colour transport on a cropped plane. No full-canvas blur/readback is
 * needed: coverage is copied unchanged from the original pigment raster. */
function tintMixFast(ctx, s, region, state) {
    if (!s.mixStops?.length || s.tool === 'eraser')
        return;
    const matrix = ctx.getTransform(), scale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
    const stops = matrix.isIdentity ? s.mixStops : s.mixStops.map(p => ({ ...p, x: matrix.a * p.x + matrix.c * p.y + matrix.e, y: matrix.b * p.x + matrix.d * p.y + matrix.f }));
    const r = region ?? strokeRasterBounds({ ...s, transform: matrix.isIdentity ? undefined : [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] }, ctx.canvas.width, ctx.canvas.height), { x, y, width: w, height: h } = r;
    if (!w || !h)
        return;
    const color = state?.canvas ?? (fastColor ??= document.createElement('canvas')), out = fastOutput ??= document.createElement('canvas'), key = s.id + ':' + s.size + ':' + [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].join(',');
    let incremental = !!state && state.key === key && color.width === ctx.canvas.width && color.height === ctx.canvas.height && state.stops.length <= stops.length && state.stops.every((p, i) => p.x === stops[i].x && p.y === stops[i].y && p.color === stops[i].color);
    if (color.width !== ctx.canvas.width)
        color.width = ctx.canvas.width;
    if (color.height !== ctx.canvas.height)
        color.height = ctx.canvas.height;
    if (out.width < w || out.height < h || out.width * out.height > w * h * 4) {
        out.width = Math.ceil(w / 64) * 64;
        out.height = Math.ceil(h / 64) * 64;
    }
    const cc = color.getContext('2d');
    cc.save();
    if (!incremental) {
        cc.clearRect(0, 0, color.width, color.height);
        cc.fillStyle = stops[0].color;
        cc.fillRect(0, 0, color.width, color.height);
    }
    cc.lineWidth = s.size * scale * 2.5 + 16;
    cc.lineCap = 'round';
    for (let i = incremental ? Math.max(1, state.stops.length) : 1; i < stops.length; i++) {
        const a = stops[i - 1], b = stops[i];
        if (a.x === b.x && a.y === b.y)
            continue;
        const gradient = cc.createLinearGradient(a.x, a.y, b.x, b.y);
        gradient.addColorStop(0, a.color);
        gradient.addColorStop(1, b.color);
        cc.strokeStyle = gradient;
        cc.beginPath();
        cc.moveTo(a.x, a.y);
        cc.lineTo(b.x, b.y);
        cc.stroke();
    }
    cc.restore();
    if (state) {
        state.key = key;
        state.stops = stops.slice();
    }
    const oc = out.getContext('2d');
    oc.clearRect(0, 0, w, h);
    oc.globalCompositeOperation = 'source-over';
    oc.drawImage(color, x, y, w, h, 0, 0, w, h);
    oc.globalCompositeOperation = 'destination-in';
    oc.drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
    oc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(out, 0, 0, w, h, x, y, w, h);
    ctx.restore();
}
