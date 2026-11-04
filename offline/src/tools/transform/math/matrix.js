export const rectQuad = (b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
export const centroid = (q) => ({ x: q.reduce((a, p) => a + p.x, 0) / 4, y: q.reduce((a, p) => a + p.y, 0) / 4 });
export const cloneQuad = (q) => q.map(p => ({ ...p }));
export const rotatePoint = (p, pivot, rad) => { const x = p.x - pivot.x, y = p.y - pivot.y, c = Math.cos(rad), s = Math.sin(rad); return { x: pivot.x + c * x - s * y, y: pivot.y + s * x + c * y }; };
export const insideQuad = (p, q) => { let inside = false; for (let i = 0, j = 3; i < 4; j = i++) {
    const a = q[i], b = q[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)
        inside = !inside;
} return inside; };
export function affineTriangle(a, b, c, u, v, w) { const sx = b.x - a.x, sy = b.y - a.y, tx = c.x - a.x, ty = c.y - a.y, det = sx * ty - sy * tx; if (Math.abs(det) < 1e-8)
    return null; const vx = v.x - u.x, vy = v.y - u.y, wx = w.x - u.x, wy = w.y - u.y; const m0 = (vx * ty - wx * sy) / det, m1 = (vy * ty - wy * sy) / det, m2 = (wx * sx - vx * tx) / det, m3 = (wy * sx - vy * tx) / det; return [m0, m1, m2, m3, u.x - m0 * a.x - m2 * a.y, u.y - m1 * a.x - m3 * a.y]; }
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const bilerp = (q, u, v) => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);
export const boundsOfQuad = (q) => { const x = Math.min(...q.map(p => p.x)), y = Math.min(...q.map(p => p.y)); return { x, y, w: Math.max(...q.map(p => p.x)) - x, h: Math.max(...q.map(p => p.y)) - y }; };
export const isFiniteQuad = (q) => q.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 1e6 && Math.abs(p.y) < 1e6);
