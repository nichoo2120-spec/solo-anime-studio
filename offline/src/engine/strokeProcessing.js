import { supportedCorner, interpolateCapturedPoints } from './curveInterpolation.js';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n) => Math.max(0, Math.min(1, n));
const monotone = (points, axis) => { let up = true, down = true; for (let i = 1; i < points.length; i++) {
    const d = points[i][axis] - points[i - 1][axis];
    if (d < -.00000001)
        up = false;
    if (d > .00000001)
        down = false;
} return up || down; };
/** Sparse V/Z gestures need explicit cusp handling. A single large turn in a
 * longer curved gesture is ambiguous; straight supporting arms establish it. */
export function gestureCorner(points, i) {
    if (i <= 0 || i >= points.length - 1)
        return false;
    const a = points[i - 1], b = points[i], c = points[i + 1], l = distance(a, b), r = distance(b, c);
    if (l < .0001 || r < .0001)
        return false;
    const cosine = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (l * r);
    if (points.length <= 4)
        return cosine < .5 && Math.min(l, r) / Math.max(l, r) > .08;
    // Repeated alternating short noise must not be mistaken for expressive cusps.
    if (cosine < -.94 && points.length > 8) {
        const aa = points[i - 2], cc = points[i + 2];
        if (!aa || !cc)
            return false;
        const ll = distance(aa, a), rr = distance(c, cc);
        if (!ll || !rr)
            return false;
        return ((a.x - aa.x) * (b.x - a.x) + (a.y - aa.y) * (b.y - a.y)) / (ll * l) > .95 && ((c.x - b.x) * (cc.x - c.x) + (c.y - b.y) * (cc.y - c.y)) / (r * rr) > .95;
    }
    return supportedCorner(points, i);
}
/** Spatial lazy brush. Its state advances synchronously for every accepted
 * sample, never from RAF, wall time, save completion, or React state. */
export class TrailingBrush {
    strength;
    maximumLag;
    lagScale;
    tip;
    previous;
    travel = 0;
    constructor(strength, maximumLag = Infinity, lagScale = 24) {
        this.strength = strength;
        this.maximumLag = maximumLag;
        this.lagScale = lagScale;
    }
    reset(point) { this.tip = { ...point }; this.previous = point; this.travel = 0; }
    push(point) {
        if (!this.tip || !this.previous) {
            this.reset(point);
            return { ...point };
        }
        const step = distance(this.previous, point);
        this.travel += step;
        this.previous = point;
        const strength = clamp(this.strength), baseRadius = this.lagScale * Math.pow(strength, 1.45);
        // Photoshop-like stabilization: keep a small controllable trailing envelope,
        // but catch up aggressively during fast motion so the line never feels floaty.
        const fastFactor = step > 4 ? Math.max(.18, 4 / step) : 1;
        const radius = Math.min(baseRadius * fastFactor, Math.max(step * .9, 0) + this.travel * .08, this.maximumLag);
        const d = distance(this.tip, point);
        if (!radius || d < 1e-6)
            this.tip = { ...point };
        else if (d > radius) {
            const catchup = Math.min(1, Math.max((d - radius) / d, .18 + .42 * Math.min(1, step / (baseRadius + 6))));
            this.tip = { ...point, x: this.tip.x + (point.x - this.tip.x) * catchup, y: this.tip.y + (point.y - this.tip.y) * catchup };
        }
        else {
            const settle = Math.min(.92, .28 + .42 * (1 - fastFactor) + strength * .18);
            this.tip = { ...point, x: this.tip.x + (point.x - this.tip.x) * settle, y: this.tip.y + (point.y - this.tip.y) * settle };
        }
        return { ...this.tip };
    }
    finish(point) { this.reset(point); return { ...point }; }
    get position() { return this.tip && { ...this.tip }; }
}
/** Replay uses exactly the same causal follower as live pointer processing. */
export function stabilizeCapturedPath(source, strength, finished = true, options = {}) {
    if (!source.length || strength <= 0)
        return source;
    const follower = new TrailingBrush(strength, options.maximumLag ?? Infinity, options.lagScale ?? 24), points = [];
    for (let i = 0; i < source.length; i++) {
        if (gestureCorner(source, i)) {
            follower.reset(source[i]);
            points.push({ ...source[i] });
        }
        else
            points.push(follower.push(source[i]));
    }
    if (finished)
        points[points.length - 1] = follower.finish(source.at(-1));
    return points;
}
function solve3(a, b) {
    const m = a.map((r, i) => [...r, b[i]]);
    for (let col = 0; col < 3; col++) {
        let pivot = col;
        for (let row = col + 1; row < 3; row++)
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col]))
                pivot = row;
        if (Math.abs(m[pivot][col]) < 1e-10)
            return undefined;
        [m[col], m[pivot]] = [m[pivot], m[col]];
        const scale = m[col][col];
        for (let k = col; k < 4; k++)
            m[col][k] /= scale;
        for (let row = 0; row < 3; row++)
            if (row !== col) {
                const scale = m[row][col];
                for (let k = col; k < 4; k++)
                    m[row][k] -= scale * m[col][k];
            }
    }
    return m[0][3];
}
/** Corner-separated local quadratic regression in arc-length coordinates.
 * Each level blends toward the same fitted target, giving a continuous 0–100
 * progression instead of increasingly destructive point deletion. Pressure and
 * velocity remain attached to original samples. Source samples are never edited. */
export function refineCapturedPath(points, amount, source = points, corner = gestureCorner) {
    if (amount <= 0 || points.length <= 6)
        return points;
    const arc = [0];
    for (let i = 1; i < points.length; i++)
        arc.push(arc[i - 1] + distance(points[i - 1], points[i]));
    const total = arc.at(-1);
    if (total < .001)
        return points;
    const radius = Math.min(90, Math.max(12, total * .065)), axes = { x: monotone(points, 'x'), y: monotone(points, 'y') }, corners = new Set();
    for (let i = 1; i < source.length - 1; i++)
        if (corner(source, i))
            corners.add(i);
    const left = [], right = [];
    let anchor = 0;
    for (let i = 0; i < points.length; i++) {
        if (corners.has(i))
            anchor = i;
        left[i] = anchor;
    }
    anchor = points.length - 1;
    for (let i = points.length - 1; i >= 0; i--) {
        if (corners.has(i))
            anchor = i;
        right[i] = anchor;
    }
    return points.map((p, i) => {
        if (i === 0 || i === points.length - 1 || corners.has(i))
            return p;
        let lo = i, hi = i;
        while (lo > left[i] && i - lo < 32 && arc[i] - arc[lo - 1] <= radius)
            lo--;
        while (hi < right[i] && hi - i < 32 && arc[hi + 1] - arc[i] <= radius)
            hi++;
        if (hi - lo < 3)
            return p;
        const normal = Array.from({ length: 3 }, () => [0, 0, 0]), bx = [0, 0, 0], by = [0, 0, 0], span = Math.max(.001, arc[i] - arc[lo], arc[hi] - arc[i]);
        for (let j = lo; j <= hi; j++) {
            const t = (arc[j] - arc[i]) / span, w = Math.max(.0001, (1 - Math.min(1, Math.abs(t)) ** 3) ** 3), basis = [1, t, t * t];
            for (let k = 0; k < 3; k++) {
                bx[k] += w * basis[k] * points[j].x;
                by[k] += w * basis[k] * points[j].y;
                for (let l = 0; l < 3; l++)
                    normal[k][l] += w * basis[k] * basis[l];
            }
        }
        let x = solve3(normal, bx), y = solve3(normal, by);
        if (x === undefined || y === undefined)
            return p;
        // Fitting may not reverse a coordinate that the captured gesture traversed
        // monotonically. Adjacent midpoint bounds cannot cross, including flat runs.
        const bound = (value, axis) => { const a = (points[i - 1][axis] + p[axis]) / 2, b = (p[axis] + points[i + 1][axis]) / 2; return Math.max(Math.min(a, b), Math.min(Math.max(a, b), value)); };
        if (axes.x)
            x = bound(x, 'x');
        if (axes.y)
            y = bound(y, 'y');
        const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), blend = clamp(amount / 100) * Math.min(1, Math.min(24, radius * .3) / (d || 1));
        return { ...p, x: p.x + dx * blend, y: p.y + dy * blend };
    });
}
export function processedGeometry(source, stabilization, smoothness, phase = 'final') {
    const stable = stabilizeCapturedPath(source, stabilization, phase === 'final'), points = phase === 'final' ? refineCapturedPath(stable, smoothness, source) : stable;
    const corners = new Set();
    for (let i = 1; i < source.length - 1; i++)
        if (gestureCorner(source, i))
            corners.add(i);
    const cubics = interpolateCapturedPoints(points, (_, i) => corners.has(i));
    for (const axis of ['x', 'y'])
        if (monotone(points, axis))
            for (const c of cubics) {
                const delta = c.b[axis] - c.a[axis], sign = Math.sign(delta), limit = Math.abs(delta) / 2;
                c.c1[axis] = c.a[axis] + sign * Math.min(limit, Math.max(0, sign * (c.c1[axis] - c.a[axis])));
                c.c2[axis] = c.b[axis] - sign * Math.min(limit, Math.max(0, sign * (c.b[axis] - c.c2[axis])));
            }
    return { points, cubics };
}
/** Bounded near-tip geometry cleanup for new live-smoothing strokes.
 * Zero means raw immediate response; nonzero values progressively remove small
 * hand jitter with no time-based pen delay.  Endpoints, hard corners, sample
 * pressure, and velocity are unchanged.  The one-sample lookahead changes only
 * the most recent geometry, retaining the fast dirty-tail raster path.
 */
export function liveSmoothCapturedPath(points, amount, corners) {
    if (amount <= 0 || points.length < 3)
        return points;
    const strength = Math.pow(clamp(amount / 100), 1.1);
    return points.map((point, i) => {
        if (i === 0 || i === points.length - 1 || corners.has(i))
            return point;
        const before = points[i - 1], after = points[i + 1], a = distance(before, point), b = distance(point, after);
        if (a < .00001 || b < .00001)
            return point;
        const ratio = a / (a + b), targetX = before.x + (after.x - before.x) * ratio, targetY = before.y + (after.y - before.y) * ratio;
        const dx = targetX - point.x, dy = targetY - point.y, length = Math.hypot(dx, dy);
        const limit = Math.min(2.25 * strength, Math.min(a, b) * .32 * strength);
        if (!length || limit <= 0)
            return point;
        const factor = Math.min(.8 * strength, limit / length);
        return { ...point, x: point.x + dx * factor, y: point.y + dy * factor };
    });
}
/** Base quality pass for newly drawn strokes (revision 2 only).
 * This is a bounded spatial de-jitter filter, not temporal stabilization:
 * the most recent pen position is exact, no samples are discarded, pressure is
 * untouched, and cusps remain anchored. Even with both sliders at zero the
 * interpolation can therefore avoid tiny tablet-sampling zigzags.
 * Its subpixel bound deliberately leaves expressive shape/detail intact.
 */
export function polishRawCapture(points, corners) {
    if (points.length < 3)
        return points;
    return points.map((p, i) => {
        if (i === 0 || i === points.length - 1 || corners.has(i))
            return p;
        const a = points[i - 1], b = points[i + 1];
        const u = distance(a, p), v = distance(p, b);
        if (u < .01 || v < .01 || u > 11 || v > 11)
            return p;
        const turn = ((p.x - a.x) * (b.x - p.x) + (p.y - a.y) * (b.y - p.y)) / (u * v);
        // Preserve deliberate V corners/reversals and their neighboring samples.
        if (turn < .32 || corners.has(i - 1) || corners.has(i + 1))
            return p;
        const t = u / (u + v), qx = a.x + (b.x - a.x) * t, qy = a.y + (b.y - a.y) * t;
        const dx = qx - p.x, dy = qy - p.y, delta = Math.hypot(dx, dy);
        if (delta < .08)
            return p;
        const magnitude = Math.min(.85, delta * .48, Math.min(u, v) * .22);
        return { ...p, x: p.x + dx / delta * magnitude, y: p.y + dy / delta * magnitude };
    });
}
/** Revision 5 changes only verified sparse structural cases. Dense filtering
 * and revision 4 saved artwork continue to use the accepted algorithms above. */
export function structuralGeometry(source, stabilization, smoothness, phase = 'final', maximumLag = Infinity, liveSmoothness = false, lowLatencyBase = false, finalRefinement = true) {
    const turns = source.length <= 8 ? source.slice(1, -1).map((b, j) => { const a = source[j], c = source[j + 2], l = distance(a, b), r = distance(b, c); return { cos: l * r ? ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (l * r) : 1, sign: Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) }; }) : [], zig = source.length <= 8 && turns.some((t, i) => i > 0 && t.cos < .5 && turns[i - 1].cos < .5 && t.sign * turns[i - 1].sign < 0);
    const corners = new Set();
    for (let i = 1; i < source.length - 1; i++) {
        const a = source[i - 1], b = source[i], c = source[i + 1], l = distance(a, b), r = distance(b, c), cos = l * r ? ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (l * r) : 1;
        if (gestureCorner(source, i) || ((source.length <= 4 || zig) && l > .0001 && r > .0001 && cos < .5))
            corners.add(i);
    }
    let limit = maximumLag;
    if (source.length >= 3 && source.length <= 8 && !corners.size) {
        const a = source[0], b = source.at(-1), dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
        if (d > .0001) {
            let departure = 0, sign = 0, consistent = true;
            for (let i = 0; i < source.length; i++) {
                const p = source[i], t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d));
                departure = Math.max(departure, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
                if (i > 0 && i < source.length - 1) {
                    const u = source[i - 1], v = source[i + 1], cross = (p.x - u.x) * (v.y - p.y) - (p.y - u.y) * (v.x - p.x), next = Math.abs(cross) < 1e-6 ? 0 : Math.sign(cross);
                    if (next && sign && next !== sign)
                        consistent = false;
                    if (next)
                        sign = next;
                }
            }
            if (consistent && departure > .0001)
                limit = Math.min(limit, departure * .35 * clamp(stabilization));
        }
    }
    const capture = lowLatencyBase ? polishRawCapture(source, corners) : source;
    const follower = new TrailingBrush(stabilization, limit, lowLatencyBase ? 5.5 : 12), stable = stabilization <= 0 ? capture.map(p => ({ ...p })) : capture.map((p, i) => { if (corners.has(i)) {
        follower.reset(p);
        return { ...p };
    } return follower.push(p); });
    if (phase === 'final' && stable.length && stabilization > 0)
        stable[stable.length - 1] = { ...source.at(-1) };
    const liveCleaned = liveSmoothness ? liveSmoothCapturedPath(stable, smoothness, corners) : stable;
    const points = phase === 'final' && finalRefinement ? refineCapturedPath(liveCleaned, smoothness, source, (_, i) => corners.has(i)) : liveCleaned;
    // Restore structural vertices after refinement, which retains all source indices.
    for (const i of corners)
        points[i] = { ...source[i] };
    const cubics = interpolateCapturedPoints(points, (_, i) => corners.has(i));
    for (const axis of ['x', 'y'])
        if (monotone(points, axis))
            for (const c of cubics) {
                const delta = c.b[axis] - c.a[axis], sign = Math.sign(delta), limit = Math.abs(delta) / 2;
                c.c1[axis] = c.a[axis] + sign * Math.min(limit, Math.max(0, sign * (c.c1[axis] - c.a[axis])));
                c.c2[axis] = c.b[axis] - sign * Math.min(limit, Math.max(0, sign * (c.b[axis] - c.c2[axis])));
            }
    return { points, cubics };
}
