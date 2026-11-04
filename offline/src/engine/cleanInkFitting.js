import { resampleInkPath, inkCornerIndices } from './flowCurveFitting.js';
import { gestureCorner } from './strokeProcessing.js';
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (a) => { const d = Math.hypot(a.x, a.y); return d > 1e-9 ? { x: a.x / d, y: a.y / d } : { x: 1, y: 0 }; };
const neg = (a) => ({ x: -a.x, y: -a.y });
function at(c, t) { const u = 1 - t; return { x: u * u * u * c.a.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.b.x, y: u * u * u * c.a.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.b.y }; }
function derivatives(c, t) {
    const u = 1 - t;
    return { first: { x: 3 * (u * u * (c.c1.x - c.a.x) + 2 * u * t * (c.c2.x - c.c1.x) + t * t * (c.b.x - c.c2.x)), y: 3 * (u * u * (c.c1.y - c.a.y) + 2 * u * t * (c.c2.y - c.c1.y) + t * t * (c.b.y - c.c2.y)) }, second: { x: 6 * (u * (c.c2.x - 2 * c.c1.x + c.a.x) + t * (c.b.x - 2 * c.c2.x + c.c1.x)), y: 6 * (u * (c.c2.y - 2 * c.c1.y + c.a.y) + t * (c.b.y - 2 * c.c2.y + c.c1.y)) } };
}
function parameters(points, start, end) {
    const arc = [0];
    for (let i = start + 1; i <= end; i++)
        arc.push(arc.at(-1) + distance(points[i - 1], points[i]));
    const length = arc.at(-1) || 1;
    return { values: arc.map(v => v / length), length };
}
function generate(points, start, end, u, left, right, length) {
    const a = points[start], b = points[end];
    let aa = 0, ab = 0, bb = 0, ax = 0, bx = 0;
    for (let i = start; i <= end; i++) {
        const t = u[i - start], s = 1 - t, b1 = 3 * s * s * t, b2 = 3 * s * t * t;
        const v = { x: points[i].x - a.x * (s * s * s + b1) - b.x * (b2 + t * t * t), y: points[i].y - a.y * (s * s * s + b1) - b.y * (b2 + t * t * t) };
        const l = { x: left.x * b1, y: left.y * b1 }, r = { x: right.x * b2, y: right.y * b2 };
        aa += dot(l, l);
        ab += dot(l, r);
        bb += dot(r, r);
        ax += dot(l, v);
        bx += dot(r, v);
    }
    const determinant = aa * bb - ab * ab, chord = distance(a, b), fallback = (chord || length) / 3;
    let alpha = determinant > 1e-12 ? (ax * bb - bx * ab) / determinant : fallback;
    let beta = determinant > 1e-12 ? (bx * aa - ax * ab) / determinant : fallback;
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha < length * 1e-6 || beta < length * 1e-6 || alpha > length * 1.3 || beta > length * 1.3)
        alpha = beta = fallback;
    return { a, b, c1: { x: a.x + left.x * alpha, y: a.y + left.y * alpha }, c2: { x: b.x + right.x * beta, y: b.y + right.y * beta } };
}
/** One spatial cleanup followed by an error-bounded cubic fit. Pressure never
 * inserts geometry knots. Reparameterization fits the actual curve, rather
 * than treating elapsed/chord distance as an exact Bezier parameter. */
export function fitCleanInkNodes(raw, smoothness = 65, tangents = {}) {
    const input = [];
    for (const p of raw) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.p))
            continue;
        if (!input.length || distance(p, input.at(-1)) > .001)
            input.push({ ...p });
        else if (input.length > 1)
            input[input.length - 1] = { ...p };
    }
    if (input.length < 2)
        return input.map(p => ({ ...p, in: { x: p.x, y: p.y }, out: { x: p.x, y: p.y } }));
    if (input.length === 2 && (tangents.startTangent || tangents.endTangent)) {
        const [a, b] = input, chord = distance(a, b), direction = unit(sub(b, a)), left = tangents.startTangent ? unit(tangents.startTangent) : direction, right = tangents.endTangent ? unit(tangents.endTangent) : direction;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot(left, right)))), handle = Math.min(chord * .55, chord / (3 * Math.cos(angle / 4) ** 2));
        return [{ ...a, in: { x: a.x, y: a.y }, out: { x: a.x + left.x * handle, y: a.y + left.y * handle } }, { ...b, in: { x: b.x - right.x * handle, y: b.y - right.y * handle }, out: { x: b.x, y: b.y } }];
    }
    const strength = Math.max(0, Math.min(100, smoothness)) / 100;
    let total = 0;
    for (let i = 1; i < input.length; i++)
        total += distance(input[i - 1], input[i]);
    const spacing = Math.max(1.8, total / 2800);
    // Keep exact original cusps, including the vertices of sparse V/Z gestures.
    const breaks = [0];
    for (let i = 1; i < input.length - 1; i++)
        if (gestureCorner(input, i))
            breaks.push(i);
    breaks.push(input.length - 1);
    const points = [], corners = new Set();
    for (let s = 1; s < breaks.length; s++) {
        const section = resampleInkPath(input.slice(breaks[s - 1], breaks[s] + 1), spacing);
        if (s > 1) {
            corners.add(points.length - 1);
            section.shift();
        }
        points.push(...section);
    }
    for (const i of inkCornerIndices(points))
        if (![...corners].some(c => Math.abs(c - i) < 4))
            corners.add(i);
    // A single local quadratic regression removes hand tremor without the
    // curvature shrink of repeated averaging. One-sided windows also clean the
    // start/end neighborhood, while the actual endpoints and cusps stay exact.
    const clean = points.map(p => ({ ...p })), radius = Math.round(3 + strength * 9), boundaries = [0, ...[...corners].sort((a, b) => a - b), points.length - 1];
    for (let section = 1; section < boundaries.length; section++) {
        const first = boundaries[section - 1], last = boundaries[section];
        for (let i = first + 1; i < last; i++) {
            const lo = Math.max(first, i - radius), hi = Math.min(last, i + radius);
            if (hi - lo < 4)
                continue;
            const matrix = Array.from({ length: 3 }, () => [0, 0, 0, 0, 0]);
            for (let j = lo; j <= hi; j++) {
                const t = (j - i) / radius, basis = [1, t, t * t], weight = Math.max(.05, (1 - Math.min(.999, Math.abs(t)) ** 3) ** 3);
                for (let r = 0; r < 3; r++) {
                    for (let k = 0; k < 3; k++)
                        matrix[r][k] += weight * basis[r] * basis[k];
                    matrix[r][3] += weight * basis[r] * points[j].x;
                    matrix[r][4] += weight * basis[r] * points[j].y;
                }
            }
            let valid = true;
            for (let col = 0; col < 3; col++) {
                let pivot = col;
                for (let r = col + 1; r < 3; r++)
                    if (Math.abs(matrix[r][col]) > Math.abs(matrix[pivot][col]))
                        pivot = r;
                if (Math.abs(matrix[pivot][col]) < 1e-10) {
                    valid = false;
                    break;
                }
                [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
                const den = matrix[col][col];
                for (let k = col; k < 5; k++)
                    matrix[col][k] /= den;
                for (let r = 0; r < 3; r++)
                    if (r !== col) {
                        const scale = matrix[r][col];
                        for (let k = col; k < 5; k++)
                            matrix[r][k] -= scale * matrix[col][k];
                    }
            }
            if (!valid)
                continue;
            const dx = (matrix[0][3] - points[i].x) * Math.min(1, .65 + strength * 1.15), dy = (matrix[0][4] - points[i].y) * Math.min(1, .65 + strength * 1.15), d = Math.hypot(dx, dy), limit = .45 + strength * 1.55, f = d > limit ? limit / d : 1;
            clean[i].x += dx * f;
            clean[i].y += dy * f;
        }
    }
    const tolerance = .65 + 2 * strength * strength, threshold = tolerance * tolerance;
    const closed = total > 12 && distance(input[0], input.at(-1)) < .05;
    const seam = closed ? unit(sub(clean[Math.min(2, clean.length - 2)], clean[Math.max(1, clean.length - 3)])) : undefined;
    const result = [];
    const append = (c) => {
        if (!result.length)
            result.push({ ...c.a, in: { x: c.a.x, y: c.a.y }, out: { ...c.c1 } });
        else
            result[result.length - 1].out = { ...c.c1 };
        result.push({ ...c.b, in: { ...c.c2 }, out: { x: c.b.x, y: c.b.y } });
    };
    const fit = (start, end, left, right, depth = 0) => {
        // Keep broad bends in separate cubic sections. A single 180-degree cubic
        // can meet a loose fit tolerance while giving a visibly flattened loop.
        if (end - start > 3 && dot(left, neg(right)) < -.35) {
            const middle = (start + end) >> 1, tangent = unit(sub(clean[Math.min(end, middle + 2)], clean[Math.max(start, middle - 2)]));
            fit(start, middle, left, neg(tangent), depth + 1);
            fit(middle, end, tangent, right, depth + 1);
            return;
        }
        const chord = parameters(clean, start, end);
        let u = chord.values;
        let curve = generate(clean, start, end, u, left, right, chord.length), split = (start + end) >> 1, error = Infinity;
        for (let iteration = 0; iteration < 5; iteration++) {
            error = 0;
            for (let i = start + 1; i < end; i++) {
                const delta = sub(at(curve, u[i - start]), clean[i]), e = dot(delta, delta);
                if (e > error) {
                    error = e;
                    split = i;
                }
            }
            if (error <= threshold || end - start <= 1 || depth >= 18) {
                append(curve);
                return;
            }
            if (error > threshold * 36)
                break;
            const next = u.map((t, i) => {
                if (!i || i === u.length - 1)
                    return t;
                const delta = sub(at(curve, t), clean[start + i]), d = derivatives(curve, t), den = dot(d.first, d.first) + dot(delta, d.second);
                return Math.max(0, Math.min(1, t - (Math.abs(den) > 1e-12 ? dot(delta, d.first) / den : 0)));
            });
            if (next.some((v, i) => i > 0 && v <= next[i - 1]))
                break;
            u = next;
            curve = generate(clean, start, end, u, left, right, chord.length);
        }
        const tangent = unit(sub(clean[Math.min(end, split + 2)], clean[Math.max(start, split - 2)]));
        fit(start, split, left, neg(tangent), depth + 1);
        fit(split, end, tangent, right, depth + 1);
    };
    const sections = [0, ...[...corners].filter(i => i > 0 && i < clean.length - 1).sort((a, b) => a - b), clean.length - 1];
    const endDirection = (start, end, reverse) => {
        const a = reverse ? end : start, dir = reverse ? -1 : 1, count = end - start;
        if (count >= 4) {
            const p = clean[a], q = clean[a + dir * 2], r = clean[a + dir * 4];
            return unit({ x: 4 * q.x - r.x - 3 * p.x, y: 4 * q.y - r.y - 3 * p.y });
        }
        return unit(sub(clean[a + dir], clean[a]));
    };
    for (let i = 1; i < sections.length; i++) {
        const a = sections[i - 1], b = sections[i];
        if (b <= a)
            continue;
        fit(a, b, a === 0 && tangents.startTangent ? unit(tangents.startTangent) : a === 0 && seam ? seam : endDirection(a, b, false), b === clean.length - 1 && tangents.endTangent ? neg(unit(tangents.endTangent)) : b === clean.length - 1 && seam ? neg(seam) : endDirection(a, b, true));
    }
    return result;
}
