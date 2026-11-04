const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const normalized = (v) => { const d = Math.hypot(v.x, v.y); return d > 1e-8 ? { x: v.x / d, y: v.y / d } : { x: 1, y: 0 }; };
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const lerp = (a, b, t) => a + (b - a) * t;
const mixPoint = (a, b, t) => ({ ...a, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), p: lerp(a.p, b.p, t) });
/** Spatially even sampling prevents 2ms/16ms tablet batches from changing the curve shape. */
export function resampleInkPath(raw, spacing = 3.1) {
    const input = raw.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.p));
    if (input.length < 2)
        return input.map(p => ({ ...p }));
    const unique = [{ ...input[0] }];
    for (let i = 1; i < input.length; i++) {
        const p = input[i], last = unique[unique.length - 1];
        if (dist(p, last) > .15)
            unique.push({ ...p });
        else if (i === input.length - 1)
            unique[unique.length - 1] = { ...p };
    }
    if (unique.length < 2)
        return unique;
    const arc = [0];
    for (let i = 1; i < unique.length; i++)
        arc[i] = arc[i - 1] + dist(unique[i - 1], unique[i]);
    const total = arc[arc.length - 1];
    // Bound amount of pen-up work even on pathological long gestures.
    const step = Math.max(spacing, total / 2200);
    const result = [{ ...unique[0] }];
    let segment = 1;
    for (let d = step; d < total - .1; d += step) {
        while (segment < arc.length - 1 && arc[segment] < d)
            segment++;
        const span = arc[segment] - arc[segment - 1];
        if (span < 1e-7)
            continue;
        result.push(mixPoint(unique[segment - 1], unique[segment], (d - arc[segment - 1]) / span));
    }
    result.push({ ...unique[unique.length - 1] });
    return result;
}
/** A cusp requires supporting straight arms on BOTH sides. Smooth circle arcs
 * must not be mistaken for corners because tablet samples vary in direction. */
export function inkCornerIndices(pts) {
    const corners = new Set();
    if (pts.length === 3) {
        const v1 = sub(pts[1], pts[0]), v2 = sub(pts[2], pts[1]);
        if (dot(normalized(v1), normalized(v2)) < .28)
            corners.add(1);
        return corners;
    }
    if (pts.length < 5)
        return corners;
    // Each candidate is tested at approximately 8-12 project pixels, not one sample.
    const radius = Math.max(2, Math.round(11 / (dist(pts[0], pts[1]) || 3.1)));
    let last = -radius;
    for (let i = radius; i < pts.length - radius; i++) {
        const a = pts[i - radius], p = pts[i], b = pts[i + radius];
        const u = sub(p, a), v = sub(b, p), du = dist(a, p), dv = dist(p, b);
        if (du < 5 || dv < 5)
            continue;
        const cosine = dot(u, v) / (du * dv);
        if (cosine > .32 || Math.abs(cross(u, v)) / (du * dv) < .25)
            continue;
        const armIsStraight = (lo, hi) => {
            const a = pts[lo], b = pts[hi], ab = sub(b, a), length = dist(a, b) || 1;
            for (const f of [.25, .5, .75]) {
                const k = lo + Math.round((hi - lo) * f), w = sub(pts[k], a);
                if (Math.abs(cross(ab, w)) / length > Math.max(1.25, length * .10))
                    return false;
            }
            return true;
        };
        if (!armIsStraight(i - radius, i) || !armIsStraight(i, i + radius))
            continue;
        if (i - last < radius) { // keep strongest nearby cusp, not a cluster of knots
            const prev = corners.has(last) ? last : -1;
            if (prev >= 0) {
                const aa = pts[prev - radius], bb = pts[prev], cc = pts[prev + radius];
                const old = dot(sub(bb, aa), sub(cc, bb)) / (dist(aa, bb) * dist(bb, cc) || 1);
                if (cosine >= old)
                    continue;
                corners.delete(prev);
            }
        }
        corners.add(i);
        last = i;
    }
    return corners;
}
/** Baseline spatial de-jitter, independent of artist-adjustable smoothing.
 * Bounded displacement prevents losing silhouette character or moving endpoints. */
export function cleanInkPath(raw) {
    const points = resampleInkPath(raw), corners = inkCornerIndices(points);
    if (points.length < 5)
        return { points, corners };
    const protectedRange = (i) => { for (const k of corners)
        if (Math.abs(k - i) <= 3)
            return true; return false; };
    let smoothed = points.map(p => ({ ...p }));
    // Stronger baseline cleanup so even 0% user smoothing still produces clean vector ink.
    const weights = [1, 6, 15, 20, 15, 6, 1];
    for (let pass = 0; pass < 3; pass++) {
        const next = smoothed.map(p => ({ ...p }));
        for (let i = 3; i < smoothed.length - 3; i++) {
            if (protectedRange(i))
                continue;
            let x = 0, y = 0;
            for (let k = -3; k <= 3; k++) {
                x += smoothed[i + k].x * weights[k + 3];
                y += smoothed[i + k].y * weights[k + 3];
            }
            x /= 64;
            y /= 64;
            const dx = x - points[i].x, dy = y - points[i].y, len = Math.hypot(dx, dy);
            const max = 2.8, scale = len > max ? max / len : 1;
            next[i].x = points[i].x + dx * scale;
            next[i].y = points[i].y + dy * scale;
            next[i].p = points[i].p * .7 + smoothed[i].p * .15 + ((smoothed[i - 1].p + smoothed[i + 1].p) / 2) * .15;
        }
        smoothed = next;
    }
    // Pen-up points must NEVER move.
    smoothed[0] = { ...points[0] };
    smoothed[smoothed.length - 1] = { ...points[points.length - 1] };
    for (const i of corners)
        smoothed[i] = { ...points[i] };
    return { points: smoothed, corners };
}
const cubicAt = (a, b, c1, c2, t) => {
    const u = 1 - t;
    return { x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y };
};
function fitSegment(pts, start, end, tStart, tEnd) {
    const a = pts[start], b = pts[end], cumulative = [0];
    for (let i = start + 1; i <= end; i++)
        cumulative.push(cumulative[cumulative.length - 1] + dist(pts[i - 1], pts[i]));
    const total = cumulative[cumulative.length - 1] || 1;
    const chord = dist(a, b);
    if (end - start === 1 || chord < .001) {
        const s = chord / 3;
        return { start, end, c1: { x: a.x + tStart.x * s, y: a.y + tStart.y * s }, c2: { x: b.x + tEnd.x * s, y: b.y + tEnd.y * s } };
    }
    let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (let i = start; i <= end; i++) {
        const t = cumulative[i - start] / total, u = 1 - t;
        const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
        const v = { x: pts[i].x - a.x * (b0 + b1) - b.x * (b2 + b3), y: pts[i].y - a.y * (b0 + b1) - b.y * (b2 + b3) };
        const v1 = { x: tStart.x * b1, y: tStart.y * b1 }, v2 = { x: tEnd.x * b2, y: tEnd.y * b2 };
        c00 += dot(v1, v1);
        c01 += dot(v1, v2);
        c11 += dot(v2, v2);
        x0 += dot(v1, v);
        x1 += dot(v2, v);
    }
    const det = c00 * c11 - c01 * c01;
    let alpha = det > 1e-9 ? (x0 * c11 - x1 * c01) / det : chord / 3;
    let beta = det > 1e-9 ? (c00 * x1 - c01 * x0) / det : chord / 3;
    if (!Number.isFinite(alpha) || alpha < chord * .025 || alpha > total * .9)
        alpha = chord / 3;
    if (!Number.isFinite(beta) || beta < chord * .025 || beta > total * .9)
        beta = chord / 3;
    return { start, end, c1: { x: a.x + tStart.x * alpha, y: a.y + tStart.y * alpha }, c2: { x: b.x + tEnd.x * beta, y: b.y + tEnd.y * beta } };
}
/** Bounded recursive least-squares cubic fit with shared tangent directions.
 * Preserve each fitted cubic handle: shortening the handles to chord-length
 * fractions caused the polygonal circles in v0.5.107/108. */
export function fitInkNodes(raw, tolerance = 1.45) {
    if (!raw.length)
        return [];
    if (raw.length === 1) {
        const p = raw[0];
        return [{ ...p, in: { x: p.x, y: p.y }, out: { x: p.x, y: p.y } }];
    }
    const { points, corners } = cleanInkPath(raw);
    if (points.length === 2) {
        const a = points[0], b = points[1], dx = (b.x - a.x) / 3, dy = (b.y - a.y) / 3;
        return [{ ...a, in: { x: a.x, y: a.y }, out: { x: a.x + dx, y: a.y + dy } }, { ...b, in: { x: b.x - dx, y: b.y - dy }, out: { x: b.x, y: b.y } }];
    }
    const toDirection = (i, span = 3) => normalized(sub(points[Math.min(points.length - 1, i + span)], points[Math.max(0, i - span)]));
    const curveTolerance = Math.max(2.85, tolerance * 2.35);
    const intervals = [0, ...[...corners].sort((a, b) => a - b), points.length - 1];
    const curves = [];
    const splitFit = (start, end, tStart, tEnd, depth) => {
        const curve = fitSegment(points, start, end, tStart, tEnd);
        if (end - start < 3 || depth > 13 || curves.length > 320) {
            curves.push(curve);
            return;
        }
        // Compare geometry and local pressure to estimated fitted stroke.
        const arc = [0];
        for (let i = start + 1; i <= end; i++)
            arc.push(arc[arc.length - 1] + dist(points[i - 1], points[i]));
        const length = arc[arc.length - 1] || 1;
        let max = curveTolerance * curveTolerance, split = -1;
        for (let i = start + 1; i < end; i++) {
            const t = arc[i - start] / length, p = cubicAt(points[start], points[end], curve.c1, curve.c2, t);
            const dx = p.x - points[i].x, dy = p.y - points[i].y;
            const pr = points[start].p + (points[end].p - points[start].p) * t;
            const pressureError = (pr - points[i].p) * 5;
            const err = dx * dx + dy * dy + pressureError * pressureError;
            if (err > max) {
                max = err;
                split = i;
            }
        }
        if (split < 0) {
            curves.push(curve);
            return;
        }
        const center = toDirection(split, 2);
        splitFit(start, split, tStart, { x: -center.x, y: -center.y }, depth + 1);
        splitFit(split, end, center, tEnd, depth + 1);
    };
    for (let section = 1; section < intervals.length; section++) {
        const start = intervals[section - 1], end = intervals[section];
        if (end <= start)
            continue;
        const startDir = normalized(sub(points[Math.min(end, start + 2)], points[start]));
        const endDir = normalized(sub(points[Math.max(start, end - 2)], points[end]));
        splitFit(start, end, startDir, endDir, 0);
    }
    const result = [];
    for (const curve of curves) {
        const a = points[curve.start], b = points[curve.end];
        if (!result.length) {
            result.push({ ...a, in: { x: a.x, y: a.y }, out: { ...curve.c1 } });
        }
        else
            result[result.length - 1].out = { ...curve.c1 };
        result.push({ ...b, in: { ...curve.c2 }, out: { x: b.x, y: b.y } });
    }
    return result;
}
