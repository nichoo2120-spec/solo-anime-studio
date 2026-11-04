import { paintNoise } from './paintingTips.js';
import { watercolorMaterial, waterSmooth } from './watercolorMaterial.js';
import { pressureResponse } from './strokeGeometry.js';
const behaviors = {
    wash: { cloudX: 0.018, cloudY: 0.025, wet: .8, cloud: .65, granules: .10, dry: 0, drag: .16, settle: .28, directional: .1 },
    round: { cloudX: 0.033, cloudY: 0.047, wet: .38, cloud: .46, granules: .24, dry: 0, drag: .22, settle: .38, directional: .2 },
    dagger: { cloudX: 0.019, cloudY: 0.11, wet: .25, cloud: .4, granules: .18, dry: .22, drag: .32, settle: .24, directional: .72 },
    cats: { cloudX: 0.026, cloudY: 0.052, wet: .58, cloud: .56, granules: .20, dry: 0, drag: .19, settle: .28, directional: .35 },
    liner: { cloudX: 0.012, cloudY: 0.09, wet: .16, cloud: .20, granules: .07, dry: 0, drag: .12, settle: .14, directional: .7 },
    paper: { cloudX: 0.065, cloudY: 0.07, wet: .32, cloud: .38, granules: .32, dry: .08, drag: .24, settle: .46, directional: .1 },
    dry: { cloudX: 0.025, cloudY: 0.14, wet: .06, cloud: .3, granules: .24, dry: .9, drag: .5, settle: .12, directional: 1 },
    bloom: { cloudX: 0.02, cloudY: 0.023, wet: 1, cloud: .8, granules: .10, dry: 0, drag: .10, settle: .45, directional: 0 },
};
export const pigmentBehavior = (s) => behaviors[watercolorMaterial(s).id];
/** v is the existing persisted normalized velocity channel. Capturing it for
 * watercolor never enables velocity-width taper or replaces tablet pressure. */
export function watercolorVelocity(distance, ms, previous = .65) {
    if (ms <= 0 || distance <= 0)
        return previous;
    const target = Math.max(.15, Math.min(1, 1 / (1 + distance / ms * .65))), blend = 1 - Math.exp(-distance / 9);
    return previous + (target - previous) * blend;
}
export function movementLoad(s, p) { const b = pigmentBehavior(s), v = p.v ?? .65; return Math.max(.45, Math.min(1.12, 1 + (v - .65) * b.drag)); }
/** A spatial index bounds work to the changed occupied region. The carrier is
 * arc length + signed cross-stroke distance, in document units. Extending end
 * coordinates avoids printing a constant stripe at each segment cap. Adjacent
 * projections are blended at turns/crossings; no individual dab is textured. */
export function strokePigment(s, samples) {
    const profile = pigmentBehavior(s), material = watercolorMaterial(s).id, seed = s.watercolorSeed ?? 0, ox = (seed & 65535) * .173 + 31, oy = (seed >>> 16) * .197 + 79;
    const cell = Math.max(24, s.size), pad = s.size * .82 + 12, bins = new Map(), segments = [];
    // The carrier needs a bounded spatial approximation, not every tablet event.
    const indices = [0];
    let last = 0;
    const step = Math.max(2, s.size * .08);
    for (let i = 1; i < samples.points.length; i++) {
        const a = samples.points[last], b = samples.points[i];
        if (i === samples.points.length - 1 || Math.hypot(b.x - a.x, b.y - a.y) >= step || Math.abs(b.p - a.p) > .08 || Math.abs((b.v ?? .65) - (a.v ?? .65)) > .08) {
            indices.push(i);
            last = i;
        }
    }
    for (let n = 1; n < indices.length; n++) {
        const i = indices[n], j = indices[n - 1], a = samples.points[j], b = samples.points[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
        if (l < .0001)
            continue;
        const previous = segments.at(-1), curve = previous ? Math.max(0, 1 - (previous.dx * dx + previous.dy * dy) / (previous.l * l)) : 0;
        const q = { a, b, dx, dy, l, arc: samples.arc[j], span: samples.arc[i] - samples.arc[j], curve };
        segments.push(q);
        for (let by = Math.floor((Math.min(a.y, b.y) - pad) / cell); by <= Math.floor((Math.max(a.y, b.y) + pad) / cell); by++)
            for (let bx = Math.floor((Math.min(a.x, b.x) - pad) / cell); bx <= Math.floor((Math.max(a.x, b.x) + pad) / cell); bx++) {
                const k = bx + ':' + by, list = bins.get(k);
                if (list)
                    list.push(q);
                else
                    bins.set(k, [q]);
            }
    }
    if (!segments.length) {
        const a = samples.points[0] ?? { x: 0, y: 0, p: 1 }, angle = (s.tipAngle ?? 0) * Math.PI / 180, q = { a, b: a, dx: Math.cos(angle), dy: Math.sin(angle), l: 1, arc: 0, span: 0, curve: 0 };
        segments.push(q);
    }
    const origin = segments[0].a, axisX = segments[0].dx / segments[0].l, axisY = segments[0].dy / segments[0].l;
    const scale = Math.max(.6, Math.min(1.8, Math.sqrt(s.size / 65))), angle = (s.tipAngle ?? 0) * Math.PI / 180, tipX = Math.cos(angle), tipY = Math.sin(angle), texture = s.textureStrength ?? 0;
    const evaluate = (q, x, y, t, out) => {
        const tx = q.dx / q.l, ty = q.dy / q.l, cx = q.a.x + q.dx * t, cy = q.a.y + q.dy * t;
        const along = q.arc + t * q.span + (x - cx) * tx + (y - cy) * ty, cross = -(x - cx) * ty + (y - cy) * tx;
        // Dagger drag also feels the fixed nib axis; dry streaks follow hand travel.
        const nib = material === 'dagger' ? ((x - cx) * tipX + (y - cy) * tipY) * .28 : 0;
        const u = (along + nib) / scale + ox, v = cross / scale + oy;
        // Large water masses are seeded at contact and transported in the initial
        // gesture frame. They stay coherent across a scrubbed area or self-crossing;
        // the smaller sediment/fibers follow local arc/normal coordinates below.
        const waterU = ((x - origin.x) * axisX + (y - origin.y) * axisY) / scale + ox, waterV = (-(x - origin.x) * axisY + (y - origin.y) * axisX) / scale + oy;
        const cloud = paintNoise(waterU * profile.cloudX + waterV * .007, waterV * profile.cloudY - waterU * .004), aggregate = paintNoise(u * (.11 - profile.directional * .07) + 17, v * (.13 + profile.directional * .21) + 41);
        const grain = paintNoise(u * (.25 - profile.directional * .22) + 113, v * (.22 + profile.directional * .04) + 23);
        const pressure = s.pressure ? pressureResponse(Math.pow(q.a.p + (q.b.p - q.a.p) * t, s.response), s.pressureCurve) : 1;
        const velocity = (q.a.v ?? .65) + ((q.b.v ?? .65) - (q.a.v ?? .65)) * t, dryness = profile.dry * (1 + (.65 - velocity) * .55) * (1 - pressure * .2);
        let density = .88 + (cloud - .5) * profile.cloud + (aggregate - .5) * profile.granules * 2 + (grain - .5) * profile.granules * .55;
        // Directional broken load lives on this stroke's carrier, never on the paper.
        const gap = waterSmooth(.39, .65, .7 * grain + .3 * aggregate);
        density *= 1 - Math.min(1, dryness * 1.25) * gap;
        const wet = profile.wet * (.65 + .35 * (s.flow ?? .2)), water = waterSmooth(.53, .73, cloud + (aggregate - .5) * .15), rim = Math.max(0, 1 - Math.abs(cloud - .55) / .055);
        if (profile.wet > .9)
            density = density * (1 - water * .38) + rim * rim * .13 * (s.pigmentPooling ?? .55);
        density *= 1 + Math.min(.12, q.curve * .2) * profile.settle;
        out.density = Math.max(profile.dry > .5 ? .02 : .08, Math.min(1.24, density));
        out.edge = waterSmooth(.30, .72, aggregate + (cloud - .5) * .3);
        // Coherent small water-front displacement, no random tip jitter or blur.
        const warp = (cloud - .5) * (1.1 + wet * 2.5), side = (aggregate - .5) * (.4 + wet * 1.5);
        out.dx = tx * side - ty * warp;
        out.dy = ty * side + tx * warp;
        out.settle = (.65 + .35 * velocity) * profile.settle * (.5 + .5 * pressure) * (1 - texture * .12);
    };
    const other = { density: 0, edge: 0, dx: 0, dy: 0, settle: 0 };
    const rawSample = (x, y, out) => {
        const list = bins.get(Math.floor(x / cell) + ':' + Math.floor(y / cell)) ?? segments;
        let first = segments[0], second, best = Infinity, next = Infinity, t1 = 0, t2 = 0;
        for (const q of list) {
            const t = Math.max(0, Math.min(1, ((x - q.a.x) * q.dx + (y - q.a.y) * q.dy) / (q.l * q.l))), dx = x - q.a.x - q.dx * t, dy = y - q.a.y - q.dy * t, d = dx * dx + dy * dy;
            if (d < best) {
                second = first;
                next = best;
                t2 = t1;
                first = q;
                best = d;
                t1 = t;
            }
            else if (d < next) {
                second = q;
                next = d;
                t2 = t;
            }
        }
        evaluate(first, x, y, t1, out);
        if (second && Math.abs(second.arc - first.arc) > step * 1.8 && next - best < Math.max(9, s.size * .25) ** 2) {
            evaluate(second, x, y, t2, other);
            const weight = .5 * (1 - waterSmooth(0, Math.max(9, s.size * .25) ** 2, next - best));
            out.density += (other.density - out.density) * weight;
            out.edge += (other.edge - out.edge) * weight;
            out.dx += (other.dx - out.dx) * weight;
            out.dy += (other.dy - out.dy) * weight;
            out.settle += (other.settle - out.settle) * weight;
        }
        return out;
    };
    // Low-frequency water/load is evaluated on a document-aligned grid. Native
    // paper remains independent. Cache nodes only for this cropped finishing pass.
    const grid = s.size >= 96 ? 6 : s.size > 24 ? 3 : 1;
    let left = 0, top = 0, columns = 0, rows = 0, values = new Float32Array(0), ready = new Uint8Array(0);
    const temporary = { density: 0, edge: 0, dx: 0, dy: 0, settle: 0 }, keys = ['density', 'edge', 'dx', 'dy', 'settle'];
    const node = (x, y) => { const i = (y - top) * columns + x - left; if (!ready[i]) {
        rawSample(x * grid, y * grid, temporary);
        for (let k = 0; k < 5; k++)
            values[i * 5 + k] = temporary[keys[k]];
        ready[i] = 1;
    } return i * 5; };
    return { profile, prepare(x, y, w, h) { left = Math.floor(x / grid); top = Math.floor(y / grid); columns = Math.ceil((x + w) / grid) - left + 2; rows = Math.ceil((y + h) / grid) - top + 2; values = new Float32Array(columns * rows * 5); ready = new Uint8Array(columns * rows); }, sample(x, y, out) {
            if (!columns)
                return rawSample(x, y, out);
            const gx = Math.floor(x / grid), gy = Math.floor(y / grid), u = x / grid - gx, v = y / grid - gy, a = node(gx, gy);
            if (!u && !v) {
                for (let k = 0; k < 5; k++)
                    out[keys[k]] = values[a + k];
                return out;
            }
            const b = node(gx + 1, gy), c = node(gx, gy + 1), d = node(gx + 1, gy + 1);
            for (let k = 0; k < 5; k++)
                out[keys[k]] = (values[a + k] * (1 - u) + values[b + k] * u) * (1 - v) + (values[c + k] * (1 - u) + values[d + k] * u) * v;
            return out;
        } };
}
