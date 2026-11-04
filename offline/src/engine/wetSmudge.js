import { SmudgeRollback } from './SmudgeRollback.js';
import { finalGeometry } from './geometryCache.js';
import { paintSamples } from './paintPass.js';
import { paintDabs } from './paintDabs.js';
import { pressureResponse } from './strokeGeometry.js';
import { projectPoint } from './perspectiveWarp.js';
import { watercolorSeedFor } from '../core/paintTips.js';
import { smudgeDefaults } from '../core/smudge.js';
import { colorNibFootprint } from './colorNibs.js';
const N = 32, SIDE = 96, clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function hash(n, seed) { let h = Math.imul(n | 0, 374761393) ^ Math.imul(seed | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, seed) { const i = Math.floor(x), t = smooth(0, 1, x - i); return hash(i, seed) * (1 - t) + hash(i + 1, seed) * t; }
function insideDistance(x, y, shape) {
    let inside = false, distance = Infinity;
    for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
        const a = shape[j], b = shape[i], dx = b.x - a.x, dy = b.y - a.y, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1));
        distance = Math.min(distance, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
        if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)
            inside = !inside;
    }
    return inside ? distance : 0;
}
const signature = (s) => JSON.stringify({ ...s, points: undefined });
const same = (a, b) => a.x === b.x && a.y === b.y && a.radius === b.radius && a.angle === b.angle && a.arc === b.arc && a.level === b.level && a.pressure === b.pressure && a.speed === b.speed;
const union = (a, b) => { if (!a)
    return { ...b }; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }; };
/** Same affine/projective brush-contact convention as the classic smudge. */
export function contactMatrix(s, dab) {
    const r = dab.radius, co = Math.cos(dab.angle), si = Math.sin(dab.angle), m = s.transform ?? [1, 0, 0, 1, 0, 0];
    let a = r * (m[0] * co + m[2] * si), b = r * (m[1] * co + m[3] * si), c = r * (-m[0] * si + m[2] * co), d = r * (-m[1] * si + m[3] * co), e = m[0] * dab.x + m[2] * dab.y + m[4], f = m[1] * dab.x + m[3] * dab.y + m[5];
    if (s.perspective) {
        const p = projectPoint(dab, s.perspective), u = projectPoint({ x: dab.x + r * co, y: dab.y + r * si }, s.perspective), v = projectPoint({ x: dab.x - r * si, y: dab.y + r * co }, s.perspective);
        a = u.x - p.x;
        b = u.y - p.y;
        c = v.x - p.x;
        d = v.y - p.y;
        e = p.x;
        f = p.y;
    }
    return [a, b, c, d, e, f];
}
function bounds(m, W, H) {
    const [a, b, c, d, e, f] = m, px = Math.abs(a) + Math.abs(c) + 2, py = Math.abs(b) + Math.abs(d) + 2, x = Math.max(0, Math.floor(e - px)), y = Math.max(0, Math.floor(f - py)), right = Math.min(W, Math.ceil(e + px)), bottom = Math.min(H, Math.ceil(f + py));
    return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
}
function contacts(s) {
    const samples = paintSamples(finalGeometry(s), .18), out = paintDabs(s, samples);
    let k = 1;
    for (const q of out) {
        while (k < samples.points.length - 1 && samples.arc[k] < q.arc)
            k++;
        const a = samples.points[Math.max(0, k - 1)], b = samples.points[k] ?? a, t = clamp((q.arc - (samples.arc[k - 1] ?? 0)) / ((samples.arc[k] ?? 0) - (samples.arc[k - 1] ?? 0) || 1)), p = a.p + (b.p - a.p) * t, v = (a.v ?? .65) + ((b.v ?? .65) - (a.v ?? .65)) * t;
        q.pressure = s.pressure ? pressureResponse(p ** s.response, s.pressureCurve) : 1;
        q.speed = clamp((.85 - v) / .65);
    }
    return out;
}
/** A premultiplied, spatial paint reservoir travels with the nib. Alpha is
 * colour coverage; mass separately tracks how much wet paint remains. */
export class WetSmudgeGesture {
    retainRollback;
    base;
    work;
    signature;
    sample = canvas(N, N);
    pigment = canvas(N, N);
    stamp = canvas(SIDE, SIDE);
    nib = canvas(SIDE, SIDE);
    load = new Float32Array(N * N * 4);
    mass = new Float32Array(N * N);
    lane = new Float32Array(N);
    uptake = new Float32Array(N);
    old = [];
    processed = 0;
    previousArc = 0;
    loaded = false;
    affected;
    rollback = new SmudgeRollback();
    paint;
    seed;
    constructor(source, s, retainRollback = true) {
        this.retainRollback = retainRollback;
        this.signature = signature(s);
        this.seed = s.colorSeed ?? watercolorSeedFor(s.rasterSourceId ?? s.id);
        this.base = canvas(source.width, source.height);
        this.work = canvas(source.width, source.height);
        this.base.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0);
        this.work.getContext('2d', { willReadFrequently: true }).drawImage(source, 0, 0);
        this.paint = this.pigment.getContext('2d').createImageData(N, N);
        const nc = this.nib.getContext('2d'), image = nc.createImageData(SIDE, SIDE), nib = s.colorNib ?? 'bristle', soft = nib === 'round', shape = nib === 'round' || nib === 'bristle' ? undefined : colorNibFootprint(nib), streak = s.smearStreak ?? smudgeDefaults.smearStreak;
        for (let y = 0; y < SIDE; y++)
            for (let x = 0; x < SIDE; x++) {
                const u = (x + .5) * 2 / SIDE - 1, v = (y + .5) * 2 / SIDE - 1, r = Math.sqrt(u * u + (v / (soft ? 1 : .82)) ** 2), edge = soft ? Math.sqrt(smooth(0, .75, 1 - r)) : smooth(0, .22, 1 - r), fibre = 1 - streak * (soft ? .6 : .4) * (1 - noise(x * 1.7, this.seed + 71)), i = (y * SIDE + x) * 4;
                image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
                image.data[i + 3] = Math.round(255 * (shape ? smooth(0, .18, insideDistance(u, v, shape)) : edge) * fibre);
            }
        nc.putImageData(image, 0, 0);
        // Different bristles exchange paint at slightly different rates. Colour
        // lanes therefore come from the travelling load, rather than holes in a mask.
        for (let x = 0; x < N; x++)
            this.uptake[x] = soft ? 1 : 1 + 1.4 * streak * (noise(x * 2.37, this.seed + 331) - .5);
    }
    dispose() { for (const c of [this.base, this.work, this.sample, this.pigment, this.stamp, this.nib])
        c.width = c.height = 0; this.rollback.clear(); }
    matchesSource(ctx, s, dabs) {
        if (ctx.canvas.width !== this.base.width || ctx.canvas.height !== this.base.height)
            return false;
        let box = this.affected;
        for (const q of dabs) {
            const b = bounds(contactMatrix(s, q), ctx.canvas.width, ctx.canvas.height);
            if (b)
                box = union(box, b);
        }
        if (!box)
            return true;
        const a = this.base.getContext('2d').getImageData(box.x, box.y, box.width, box.height).data, b = ctx.getImageData(box.x, box.y, box.width, box.height).data;
        for (let i = 0; i < a.length; i++)
            if (a[i] !== b[i])
                return false;
        return true;
    }
    reset(prefix) {
        const wc = this.work.getContext('2d'), restored = this.rollback.restore(wc, prefix);
        if (restored) {
            const cp = restored.state;
            this.load.set(cp.load);
            this.mass.set(cp.mass);
            this.previousArc = cp.previousArc;
            this.loaded = cp.loaded;
            this.processed = restored.count;
            this.affected = cp.bounds ? { ...cp.bounds } : undefined;
        }
        else {
            if (this.affected) {
                const r = this.affected;
                wc.clearRect(r.x, r.y, r.width, r.height);
                wc.drawImage(this.base, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
            }
            this.load.fill(0);
            this.mass.fill(0);
            this.previousArc = 0;
            this.loaded = false;
            this.processed = 0;
            this.affected = undefined;
            this.rollback.clear();
        }
    }
    update(s, dabs = contacts(s)) {
        let prefix = 0;
        while (prefix < Math.min(this.old.length, dabs.length) && same(this.old[prefix], dabs[prefix]))
            prefix++;
        if (prefix < this.processed)
            this.reset(prefix);
        const wc = this.work.getContext('2d', { willReadFrequently: true }), sc = this.sample.getContext('2d', { willReadFrequently: true }), pc = this.pigment.getContext('2d'), tc = this.stamp.getContext('2d'), mix = s.mixAmount ?? .75, hold = s.holdLen ?? 3.5, pickup = s.pickupLen ?? .9, streak = s.smearStreak ?? .5, add = s.useSelectedColour ?? 0, selected = s.color.slice(1).match(/../g).map(x => parseInt(x, 16));
        const start = this.processed;
        for (let i = start; i < dabs.length; i++) {
            if (this.retainRollback && (i === start || i % 4 === 0)) {
                let region;
                for (let j = i; j < Math.min(dabs.length, (Math.floor(i / 4) + 1) * 4); j++) {
                    const r = bounds(contactMatrix(s, dabs[j]), this.work.width, this.work.height);
                    if (r)
                        region = union(region, r);
                }
                this.rollback.remember(this.work, i, { load: this.load.slice(), mass: this.mass.slice(), previousArc: this.previousArc, loaded: this.loaded, bounds: this.affected ? { ...this.affected } : undefined }, region);
            }
            const q = dabs[i], m = contactMatrix(s, q), [a, b, c, d, e, f] = m, det = a * d - b * c, r = bounds(m, this.work.width, this.work.height);
            if (q.radius > .001 && Math.abs(det) > 1e-8 && r) {
                const half = N * .5;
                sc.resetTransform();
                sc.clearRect(0, 0, N, N);
                sc.setTransform(half * d / det, -half * b / det, -half * c / det, half * a / det, half - half * (d * e - c * f) / det, half + half * (b * e - a * f) / det);
                sc.imageSmoothingEnabled = true;
                // Both sources are sampled before this dab. Premultiplied additive weights
                // keep transparent edges correct and avoid re-picking only fresh output.
                sc.globalCompositeOperation = 'source-over';
                sc.globalAlpha = .12;
                sc.drawImage(this.base, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
                sc.globalCompositeOperation = 'lighter';
                sc.globalAlpha = .88;
                sc.drawImage(this.work, r.x, r.y, r.width, r.height, r.x, r.y, r.width, r.height);
                sc.resetTransform();
                sc.globalAlpha = 1;
                sc.globalCompositeOperation = 'source-over';
                const under = sc.getImageData(0, 0, N, N).data, travel = Math.max(0, q.arc - this.previousArc), p = q.pressure, speed = q.speed, pick = mix * (1 - Math.exp(-travel / Math.max(1, s.size * pickup * (1 + .9 * speed)))), decay = Math.exp(-travel / Math.max(1, s.size * hold * (.60 + 1.10 * p) * (1 + .8 * speed))), give = 3.6 * (.16 + .84 * p) * (1 - .48 * speed) * (1 - Math.exp(-travel / Math.max(.5, s.size * .5))), colourAdd = add * (1 - Math.exp(-travel / Math.max(1, s.size * .5)));
                for (let x = 0; x < N; x++)
                    this.lane[x] = 1 - streak * .28 * (1 - noise(q.arc / 5.3 + x * 3.17, this.seed + 211));
                const paint = this.paint.data;
                for (let j = 0; j < under.length; j += 4) {
                    const alpha = under[j + 3] / 255, index = j / 4, pickLane = clamp(pick * this.uptake[index % N]), mass = this.loaded ? (this.mass[index] * (1 - pickLane) + alpha * pickLane) * decay : alpha;
                    this.mass[index] = mass;
                    for (let k = 0; k < 3; k++) {
                        const incoming = under[j + k] * alpha;
                        this.load[j + k] = this.loaded ? this.load[j + k] * (1 - pickLane) + incoming * pickLane : incoming;
                    }
                    const coverage = this.loaded ? this.load[j + 3] * (1 - pickLane) + alpha * pickLane : alpha;
                    this.load[j + 3] = coverage;
                    for (let k = 0; k < 3; k++) {
                        if (colourAdd && coverage > 0)
                            this.load[j + k] += (selected[k] * coverage - this.load[j + k]) * colourAdd;
                        paint[j + k] = coverage > 1e-7 ? Math.round(this.load[j + k] / coverage) : 0;
                    }
                    paint[j + 3] = Math.round(255 * mass * this.lane[index % N]);
                }
                if (s.colorNib === 'round') {
                    for (let y = 0; y < N; y++) {
                        let r = 0, g = 0, b = 0, a = 0;
                        for (let x = 0; x < N; x++) {
                            const j = (y * N + x) * 4;
                            r += this.load[j];
                            g += this.load[j + 1];
                            b += this.load[j + 2];
                            a += this.load[j + 3];
                        }
                        if (a > 1e-7)
                            for (let x = 0; x < N; x++) {
                                const j = (y * N + x) * 4, A = this.load[j + 3];
                                this.load[j] = this.load[j] * .55 + r / a * A * .45;
                                this.load[j + 1] = this.load[j + 1] * .55 + g / a * A * .45;
                                this.load[j + 2] = this.load[j + 2] * .55 + b / a * A * .45;
                                if (A) {
                                    paint[j] = Math.round(this.load[j] / A);
                                    paint[j + 1] = Math.round(this.load[j + 1] / A);
                                    paint[j + 2] = Math.round(this.load[j + 2] / A);
                                }
                            }
                    }
                }
                pc.putImageData(this.paint, 0, 0);
                tc.globalCompositeOperation = 'source-over';
                tc.globalAlpha = 1;
                tc.clearRect(0, 0, SIDE, SIDE);
                tc.drawImage(this.pigment, 0, 0, SIDE, SIDE);
                tc.globalCompositeOperation = 'destination-in';
                tc.drawImage(this.nib, 0, 0);
                tc.globalCompositeOperation = 'source-over';
                if (this.loaded && travel > 0 && q.level > 0) {
                    wc.save();
                    wc.setTransform(a, b, c, d, e, f);
                    wc.globalAlpha = clamp(give * q.level);
                    wc.globalCompositeOperation = s.blendPreserveAlpha ? 'source-atop' : 'source-over';
                    wc.drawImage(this.stamp, -1, -1, 2, 2);
                    wc.restore();
                }
                this.affected = union(this.affected, r);
                this.loaded = true;
            }
            this.previousArc = q.arc;
            this.processed = i + 1;
        }
        this.old = dabs;
    }
    present(ctx, s, region) {
        const x = Math.max(0, region.x), y = Math.max(0, region.y), w = Math.min(ctx.canvas.width, region.x + region.width) - x, h = Math.min(ctx.canvas.height, region.y + region.height) - y;
        if (w <= 0 || h <= 0)
            return;
        if (s.opacity === 1) {
            ctx.clearRect(x, y, w, h);
            ctx.drawImage(this.work, x, y, w, h, x, y, w, h);
            return;
        }
        const original = this.base.getContext('2d').getImageData(x, y, w, h), after = this.work.getContext('2d').getImageData(x, y, w, h).data, data = original.data, t = s.opacity;
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] / 255, b = after[i + 3] / 255, alpha = a * (1 - t) + b * t;
            for (let k = 0; k < 3; k++)
                data[i + k] = alpha ? Math.round((data[i + k] * a * (1 - t) + after[i + k] * b * t) / alpha) : 0;
            data[i + 3] = Math.round(alpha * 255);
        }
        ctx.putImageData(original, x, y);
    }
}
let live, canonical;
export function applyWetSmudge(ctx, _mask, s, _sourceX, _sourceY, region, base) {
    if (s.opacity <= 0 || s.flow === 0 || !s.points.length)
        return;
    const key = signature(s), dabs = contacts(s);
    let gesture;
    if (base) {
        if (!live || live.id !== s.id || live.source !== base || live.gesture.signature !== key || live.gesture.base.width !== base.width || live.gesture.base.height !== base.height) {
            live?.gesture.dispose();
            live = { id: s.id, source: base, gesture: new WetSmudgeGesture(base, s) };
        }
        gesture = live.gesture;
    }
    else if (live?.gesture.signature === key && live.gesture.matchesSource(ctx, s, dabs))
        gesture = live.gesture;
    else {
        canonical?.dispose();
        canonical = new WetSmudgeGesture(ctx.canvas, s, false);
        gesture = canonical;
    }
    gesture.update(s, dabs);
    gesture.present(ctx, s, region);
}
/** Test/debug reset also releases retained gesture canvases. */
export function resetWetSmudgeCaches() { live?.gesture.dispose(); canonical?.dispose(); live = undefined; canonical = undefined; }
