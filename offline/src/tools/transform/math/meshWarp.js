import { bilerp } from './matrix.js';
export function makeGrid(q, rows = 4, cols = rows, mode = 'uniform') {
    const r = Math.max(2, Math.min(12, Math.round(rows))), c = Math.max(2, Math.min(12, Math.round(cols))), nodes = [];
    for (let y = 0; y <= r; y++)
        for (let x = 0; x <= c; x++)
            nodes.push(bilerp(q, x / c, y / r));
    return { rows: r, cols: c, nodes, mode, uStops: Array.from({ length: c + 1 }, (_, i) => i / c), vStops: Array.from({ length: r + 1 }, (_, i) => i / r) };
}
export function cloneGrid(grid) { return { rows: grid.rows, cols: grid.cols, mode: grid.mode ?? 'uniform', uStops: grid.uStops?.slice(), vStops: grid.vStops?.slice(), nodes: grid.nodes.map(p => ({ ...p })), sourceNodes: grid.sourceNodes?.map(p => ({ ...p })), pins: grid.pins?.map(pin => ({ ...pin })) }; }
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const gridStops = (count, stops) => stops ?? Array.from({ length: count + 1 }, (_, i) => count ? i / count : 0);
const sourceGrid = (grid) => grid.sourceNodes ? { ...grid, nodes: grid.sourceNodes.map(p => ({ ...p })), pins: undefined, sourceNodes: undefined } : grid;
function barycentric(p, a, b, c) {
    const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(det) < 1e-9)
        return null;
    const w1 = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / det;
    const w2 = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / det;
    const w3 = 1 - w1 - w2;
    return { w1, w2, w3 };
}
export function gridPoint(grid, u, v, includePins = true) {
    const cols = grid.cols, rows = grid.rows;
    const xs = gridStops(cols, grid.uStops), ys = gridStops(rows, grid.vStops);
    const x = Math.max(0, Math.min(cols - 1, xs.findIndex((t, i) => i < cols && u >= t && u <= xs[i + 1]) < 0 ? (u < 0 ? 0 : cols - 1) : xs.findIndex((t, i) => i < cols && u >= t && u <= xs[i + 1])));
    const y = Math.max(0, Math.min(rows - 1, ys.findIndex((t, i) => i < rows && v >= t && v <= ys[i + 1]) < 0 ? (v < 0 ? 0 : rows - 1) : ys.findIndex((t, i) => i < rows && v >= t && v <= ys[i + 1])));
    const fx = Math.max(0, Math.min(1, (u - xs[x]) / (xs[x + 1] - xs[x]))), fy = Math.max(0, Math.min(1, (v - ys[y]) / (ys[y + 1] - ys[y]))), k = y * (cols + 1) + x;
    // Smooth bicubic Hermite sampling with finite-difference tangents. Both mesh
    // guides and raster tiles sample THIS SAME surface, rather than joining
    // bilinear patches with visible sharp changes of slope at grid points.
    const node = (i, j) => grid.nodes[Math.max(0, Math.min(rows, j)) * (cols + 1) + Math.max(0, Math.min(cols, i))];
    const hermite = (a, b, ma, mb, t) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * ma + (-2 * t3 + 3 * t2) * b + (t3 - t2) * mb; };
    const smooth = (component) => {
        const alongX = (j) => {
            const a = node(x, j)[component], b = node(x + 1, j)[component];
            const dx0 = (node(x + 1, j)[component] - node(x - 1, j)[component]) / (xs[Math.min(cols, x + 1)] - xs[Math.max(0, x - 1)] || 1);
            const dx1 = (node(x + 2, j)[component] - node(x, j)[component]) / (xs[Math.min(cols, x + 2)] - xs[x] || 1);
            const width = xs[x + 1] - xs[x];
            return hermite(a, b, dx0 * width, dx1 * width, fx);
        };
        const a = alongX(y), b = alongX(y + 1), before = alongX(y - 1), after = alongX(y + 2);
        const dy0 = (b - before) / (ys[Math.min(rows, y + 1)] - ys[Math.max(0, y - 1)] || 1), dy1 = (after - a) / (ys[Math.min(rows, y + 2)] - ys[y] || 1);
        const height = ys[y + 1] - ys[y];
        return hermite(a, b, dy0 * height, dy1 * height, fy);
    };
    const base = { x: smooth('x'), y: smooth('y') };
    if (!includePins || !grid.pins?.length)
        return base;
    let dx = 0, dy = 0;
    for (const pin of grid.pins) {
        const distance = Math.hypot(u - pin.u, v - pin.v) / Math.max(.015, pin.radius);
        if (distance >= 1)
            continue;
        const weight = 1 - 10 * distance ** 3 + 15 * distance ** 4 - 6 * distance ** 5;
        dx += pin.dx * weight;
        dy += pin.dy * weight;
    }
    // Independent pins never move locked outer boundary; no absolute-position relaxation.
    const edge = Math.min(u, v, 1 - u, 1 - v);
    const border = Math.max(0, Math.min(1, edge / .035));
    return { x: base.x + dx * border, y: base.y + dy * border };
}
export function pointToGridUV(grid, point) {
    const src = sourceGrid(grid), xs = gridStops(src.cols, src.uStops), ys = gridStops(src.rows, src.vStops), stride = src.cols + 1;
    let fallback = null;
    for (let y = 0; y < src.rows; y++)
        for (let x = 0; x < src.cols; x++) {
            const k = y * stride + x;
            const a = src.nodes[k], b = src.nodes[k + 1], c = src.nodes[k + stride + 1], d = src.nodes[k + stride];
            const quads = [
                [a, b, c, xs[x], ys[y], xs[x + 1], ys[y + 1]],
                [a, c, d, xs[x], ys[y], xs[x + 1], ys[y + 1]],
            ];
            for (const [p0, p1, p2, u0, v0, u1, v1] of quads) {
                const w = barycentric(point, p0, p1, p2);
                if (!w)
                    continue;
                const { w1, w2, w3 } = w;
                const inside = w1 >= -1e-4 && w2 >= -1e-4 && w3 >= -1e-4;
                const score = Math.min(w1, w2, w3);
                const uv = (p0 === a && p1 === b && p2 === c)
                    ? { u: w1 * u0 + w2 * u1 + w3 * u1, v: w1 * v0 + w2 * v0 + w3 * v1 }
                    : { u: w1 * u0 + w2 * u1 + w3 * u0, v: w1 * v0 + w2 * v1 + w3 * v1 };
                if (inside)
                    return { u: clamp01(uv.u), v: clamp01(uv.v) };
                if (!fallback || score > fallback.score)
                    fallback = { ...uv, score };
            }
        }
    if (fallback)
        return { u: clamp01(fallback.u), v: clamp01(fallback.v) };
    const pts = src.nodes, bx = Math.min(...pts.map(p => p.x)), by = Math.min(...pts.map(p => p.y)), bw = Math.max(1, Math.max(...pts.map(p => p.x)) - bx), bh = Math.max(1, Math.max(...pts.map(p => p.y)) - by);
    return { u: clamp01((point.x - bx) / bw), v: clamp01((point.y - by) / bh) };
}
/** Move an independent pin and its surrounding *visible mesh nodes* as one soft
 * surface. Split displacement between the node lattice and pin field so the
 * pin does not apply the same movement twice at its center. All geometry is
 * computed from the pointer-down snapshot, never cumulatively per event. */
export function dragFreePin(grid, index, dx, dy, behavior, lockCorners = false, lockBorder = false) {
    const next = cloneGrid(grid), pins = next.pins ?? [], source = grid.pins?.[index];
    if (!source)
        return next;
    if (behavior === 'local') {
        pins[index].dx = source.dx + dx;
        pins[index].dy = source.dy + dy;
        return next;
    }
    // A broad, bell-shaped elastic field gives the grid a soft cloth-like pull.
    // All followers still use a pointer-down snapshot: there is no delayed lerp,
    // frame accumulation, or rubber-band lag between pen and active pin.
    const reach = Math.max(.035, source.radius) * 2.25;
    const weight = (u, v) => {
        const t = Math.hypot(u - source.u, v - source.v) / reach;
        if (t >= 1)
            return 0;
        const fade = 1 - t * t;
        return Math.exp(-2.25 * t * t) * fade * fade;
    };
    // Part of the movement affects the editable grid handles; the remainder
    // belongs to the smooth pin field. Pin positions and guide crossings then
    // move together, without a doubled center displacement.
    const latticeShare = .55, pinShare = 1 - latticeShare;
    const us = grid.uStops ?? Array.from({ length: grid.cols + 1 }, (_, i) => i / grid.cols);
    const vs = grid.vStops ?? Array.from({ length: grid.rows + 1 }, (_, i) => i / grid.rows);
    for (let j = 0; j <= grid.rows; j++)
        for (let i = 0; i <= grid.cols; i++) {
            const border = i === 0 || i === grid.cols || j === 0 || j === grid.rows;
            const corner = (i === 0 || i === grid.cols) && (j === 0 || j === grid.rows);
            if (lockBorder && border || lockCorners && corner)
                continue;
            const k = j * (grid.cols + 1) + i, w = weight(us[i], vs[j]) * latticeShare;
            next.nodes[k] = { x: grid.nodes[k].x + dx * w, y: grid.nodes[k].y + dy * w };
        }
    for (let i = 0; i < pins.length; i++) {
        const old = grid.pins[i];
        const w = weight(old.u, old.v) * pinShare;
        pins[i].dx = old.dx + dx * w;
        pins[i].dy = old.dy + dy * w;
    }
    // The dragged point needs exact pointer response: the mesh lattice
    // contribution is interpolated, not necessarily equal to latticeShare.
    const originalCenter = gridPoint(grid, source.u, source.v);
    const movedCenter = gridPoint(next, source.u, source.v);
    pins[index].dx += dx - (movedCenter.x - originalCenter.x);
    pins[index].dy += dy - (movedCenter.y - originalCenter.y);
    return next;
}
/** Validate sampled mesh orientation before baking: inverted cells would overlap ink
 * and cannot be represented as a single continuous painted surface. */
export function meshHasFold(grid) {
    const detail = 6, cols = grid.cols * detail, rows = grid.rows * detail;
    const a = gridPoint(grid, 0, 0), b = gridPoint(grid, 1, 0), c = gridPoint(grid, 0, 1);
    const reference = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (!Number.isFinite(reference) || Math.abs(reference) < 1e-5)
        return true;
    const sign = Math.sign(reference);
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
            const u = x / cols, v = y / rows, U = (x + 1) / cols, V = (y + 1) / rows;
            const p = gridPoint(grid, u, v), q = gridPoint(grid, U, v), t = gridPoint(grid, u, V), w = gridPoint(grid, U, V);
            const a1 = (q.x - p.x) * (t.y - p.y) - (q.y - p.y) * (t.x - p.x);
            const a2 = (w.x - q.x) * (t.y - q.y) - (w.y - q.y) * (t.x - q.x);
            if (!Number.isFinite(a1) || !Number.isFinite(a2) || a1 * sign <= 0 || a2 * sign <= 0)
                return true;
        }
    return false;
}
/** Map a cached bitmap with locally affine, clipped triangular texture tiles. */
export function paintTriangles(ctx, source, sourceBox, grid) {
    const rows = grid.rows, cols = grid.cols;
    const xs = grid.uStops ?? Array.from({ length: cols + 1 }, (_, i) => i / cols);
    const ys = grid.vStops ?? Array.from({ length: rows + 1 }, (_, i) => i / rows);
    const sourceGrid = grid.sourceNodes ? { ...grid, nodes: grid.sourceNodes, pins: undefined } : undefined;
    const src = (a, b) => sourceGrid ? gridPoint(sourceGrid, a, b, false) : { x: sourceBox.x + a * sourceBox.w, y: sourceBox.y + b * sourceBox.h };
    // Pins need finer tiles so the actual artwork follows them, not just the guides.
    // Sample the smooth surface densely even when no free pins were inserted.
    // Coarse affine cells kink thin curves under a strong stretch.
    let bend = 0;
    for (let y = 0; y <= rows; y++)
        for (let x = 0; x <= cols; x++) {
            const p = grid.nodes[y * (cols + 1) + x];
            if (x > 0 && x < cols) {
                const a = grid.nodes[y * (cols + 1) + x - 1], b = grid.nodes[y * (cols + 1) + x + 1];
                bend = Math.max(bend, Math.hypot(p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2));
            }
            if (y > 0 && y < rows) {
                const a = grid.nodes[(y - 1) * (cols + 1) + x], b = grid.nodes[(y + 1) * (cols + 1) + x];
                bend = Math.max(bend, Math.hypot(p.x - (a.x + b.x) / 2, p.y - (a.y + b.y) / 2));
            }
        }
    const samples = bend > 24 || grid.pins?.length ? 48 : 32;
    const subdivide = Math.min(12, Math.max(4, Math.ceil(samples / Math.max(rows, cols))));
    // Neighboring tiles share vertices. Evaluate the curved surface once per
    // vertex, rather than eight times for each tile, while retaining fine sampling.
    const width = cols * subdivide, height = rows * subdivide, stride = width + 1;
    const destinations = [], originsAt = [];
    for (let iy = 0; iy <= height; iy++)
        for (let ix = 0; ix <= width; ix++) {
            const ci = Math.min(cols - 1, Math.floor(ix / subdivide)), ri = Math.min(rows - 1, Math.floor(iy / subdivide));
            const u = xs[ci] + (xs[ci + 1] - xs[ci]) * (ix / subdivide - ci), v = ys[ri] + (ys[ri + 1] - ys[ri]) * (iy / subdivide - ri);
            destinations.push(gridPoint(grid, u, v));
            originsAt.push(src(u, v));
        }
    for (let iy = 0; iy < height; iy++)
        for (let ix = 0; ix < width; ix++) {
            const k = iy * stride + ix, indices = [k, k + 1, k + stride + 1, k + stride];
            const vertices = indices.map(i => destinations[i]), origins = indices.map(i => originsAt[i]);
            for (const [i, j, l] of [[0, 1, 2], [0, 2, 3]]) {
                const A = origins[i], B = origins[j], C = origins[l], a = vertices[i], b = vertices[j], c = vertices[l];
                const sx = B.x - A.x, sy = B.y - A.y, tx = C.x - A.x, ty = C.y - A.y, det = sx * ty - sy * tx;
                if (Math.abs(det) < .00001)
                    continue;
                const x = b.x - a.x, y = b.y - a.y, X = c.x - a.x, Y = c.y - a.y;
                const m0 = (x * ty - X * sy) / det, m1 = (y * ty - Y * sy) / det, m2 = (X * sx - x * tx) / det, m3 = (Y * sx - y * tx) / det;
                ctx.save();
                ctx.beginPath();
                // Adjacent triangles share the same mathematical edge, but Canvas anti-aliases
                // each clip independently. Expand the clip outward by half a device pixel to
                // prevent transparent hairline seams in dense mesh deformations.
                const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
                const expand = (p) => { const vx = p.x - cx, vy = p.y - cy, len = Math.hypot(vx, vy) || 1; return { x: p.x + vx / len * .7, y: p.y + vy / len * .7 }; };
                const aa = expand(a), bb = expand(b), cc = expand(c);
                ctx.moveTo(aa.x, aa.y);
                ctx.lineTo(bb.x, bb.y);
                ctx.lineTo(cc.x, cc.y);
                ctx.closePath();
                ctx.clip();
                ctx.transform(m0, m1, m2, m3, a.x - m0 * A.x - m2 * A.y, a.y - m1 * A.x - m3 * A.y);
                // Sample the SAME full source surface for every triangle. Sampling a separate
                // cropped subrectangle for each tile causes bicubic/bilinear filtering to
                // bleed from its artificial crop edge, visibly splitting solid ink into
                // strips. The destination triangle clip already limits the painted region.
                ctx.drawImage(source, 0, 0, sourceBox.w, sourceBox.h, sourceBox.x, sourceBox.y, sourceBox.w, sourceBox.h);
                ctx.restore();
            }
        }
}
/** Insert a user-chosen row or column without resetting existing deformations.
 * Every new node is sampled from the existing surface, avoiding snapping/shrinking. */
export function insertMeshDivision(grid, axis, at) {
    const old = cloneGrid(grid), cols = old.cols, rows = old.rows;
    if ((axis === 'column' ? cols : rows) >= 12)
        return null;
    const xs = gridStops(cols, old.uStops), ys = gridStops(rows, old.vStops);
    const stops = axis === 'column' ? xs : ys;
    const v = Math.min(.999, Math.max(.001, at));
    if (stops.some(t => Math.abs(t - v) < .01))
        return null;
    const nextStops = [...stops, v].sort((a, b) => a - b);
    const newXs = axis === 'column' ? nextStops : xs, newYs = axis === 'row' ? nextStops : ys;
    const src = sourceGrid(old);
    const nodes = newYs.flatMap(y => newXs.map(x => gridPoint(old, x, y)));
    const sourceNodes = newYs.flatMap(y => newXs.map(x => gridPoint(src, x, y, false)));
    return { rows: newYs.length - 1, cols: newXs.length - 1, nodes, sourceNodes, uStops: newXs.slice(), vStops: newYs.slice(), mode: 'custom', pins: old.pins?.map(pin => ({ ...pin })) };
}
/** Adaptive envelope around the visible ink. Preserve identical source and destination
 * control points at rest so entering Artwork-only mode never reshapes artwork.
 * The envelopes are conservative: each mesh row covers adjacent strips of alpha,
 * retaining thin contours crossing a control row between band boundaries. */
export function contourGrid(q, alpha, width, height, rows = 4, cols = 4) {
    // One ordered cross-section per row. The previous independent horizontal and
    // vertical envelope estimation moved adjacent vertices past each other and
    // produced the criss-cross lattice reported by artists.
    const g = makeGrid(q, rows, cols, 'adaptive');
    const left = new Float64Array(height).fill(width), right = new Float64Array(height).fill(-1);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (alpha[(y * width + x) * 4 + 3] > 12) {
                left[y] = Math.min(left[y], x);
                right[y] = Math.max(right[y], x);
            }
    const radius = Math.max(1, Math.ceil(height / (g.rows * 3))), margin = Math.max(3, Math.min(12, Math.round(width * .025)));
    const widths = [];
    for (let row = 0; row <= g.rows; row++) {
        const cy = Math.round((height - 1) * row / g.rows);
        let lo = width, hi = -1;
        for (let y = Math.max(0, cy - radius); y <= Math.min(height - 1, cy + radius); y++)
            if (right[y] >= 0) {
                lo = Math.min(lo, left[y]);
                hi = Math.max(hi, right[y]);
            }
        if (hi < 0) {
            let nearest = height;
            for (let y = 0; y < height; y++)
                if (right[y] >= 0 && Math.abs(y - cy) < nearest) {
                    nearest = Math.abs(y - cy);
                    lo = left[y];
                    hi = right[y];
                }
        }
        if (hi < 0) {
            lo = 0;
            hi = width - 1;
        }
        const span = Math.max(1, hi - lo), minSpan = Math.max(8, width * .14), extra = Math.max(0, (minSpan - span) / 2);
        widths.push({ lo: Math.max(0, lo - margin - extra), hi: Math.min(width - 1, hi + margin + extra) });
    }
    // Gentle smoothing makes the mesh a clean, editable surface while never
    // losing the fixed ordering of columns and rows.
    const filtered = widths.map((entry, j) => {
        const a = widths[Math.max(0, j - 1)], b = widths[Math.min(g.rows, j + 1)];
        return { lo: (a.lo + 2 * entry.lo + b.lo) / 4, hi: (a.hi + 2 * entry.hi + b.hi) / 4 };
    });
    g.nodes = [];
    for (let j = 0; j <= g.rows; j++)
        for (let i = 0; i <= g.cols; i++) {
            const u = i / g.cols, v = j / g.rows, band = filtered[j];
            // Preserve a proportional minimum span so columns remain selectable.
            const x = (band.lo + (band.hi - band.lo) * u) / Math.max(1, width - 1);
            g.nodes.push(bilerp(q, Math.max(0, Math.min(1, x)), v));
        }
    g.sourceNodes = g.nodes.map(p => ({ ...p }));
    return g;
}
