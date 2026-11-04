import { flattenCubic, pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse } from './pressureChannels.js';
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
/** Convex sweep of the fixed rectangular nib between two samples. This covers
 * the complete segment without thousands of overlapping rectangle stamps. */
function hull(points) {
    const sorted = points.sort((a, b) => a.x - b.x || a.y - b.y), lo = [], hi = [];
    for (const p of sorted) {
        while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), p) <= 0)
            lo.pop();
        lo.push(p);
    }
    for (const p of sorted.slice().reverse()) {
        while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), p) <= 0)
            hi.pop();
        hi.push(p);
    }
    return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
export function drawFlatInk(ctx, s, g, region, displayScale = 1, paths, info) {
    if (s.brushKind !== 'flat' || s.textureStrength || s.pressure && s.pressureOpacity)
        return false;
    const points = g.cubics.length ? g.cubics.flatMap((c, i) => flattenCubic(c, .15 / displayScale).slice(i ? 1 : 0)) : g.points;
    if (!points.length)
        return true;
    let total = 0;
    for (let i = 1; i < points.length; i++)
        total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (info) {
        info.points = points;
        info.total = total;
    }
    const co = Math.cos(-.55), sn = Math.sin(-.55);
    const nib = (p, d) => {
        const response = s.pressure ? pressureResponse(Math.pow(p.p, s.response), s.pressureCurve) : 1;
        const factor = s.pressure && s.pressureWidth !== false || s.velocityTaper ? widthResponse(response * (s.velocityTaper ? p.v ?? 1 : 1), s) : 1;
        const t = s.size >= 64 ? Math.sin(taperFactor(d, total, s.taperStart, s.taperEnd, Math.min(total * .45, Math.max(32, s.size * 2))) * Math.PI / 2) : taperFactor(d, total, s.taperStart, s.taperEnd, Math.max(64, s.size * 12));
        const r = Math.max(0, s.size * .5 * factor * t), h = r * .3;
        return [[-r, -h], [r, -h], [r, h], [-r, h]].map(([x, y]) => ({ x: p.x + x * co - y * sn, y: p.y + x * sn + y * co }));
    };
    ctx.save();
    if (region) {
        ctx.beginPath();
        ctx.rect(region.x, region.y, region.width, region.height);
        ctx.clip();
    }
    ctx.fillStyle = s.color;
    let path = new Path2D(), count = 0, sample = 0;
    const append = (q) => { if (q.length < 3)
        return; path.moveTo(q[0].x, q[0].y); for (const p of q.slice(1))
        path.lineTo(p.x, p.y); path.closePath(); if (++count === 96) {
        if (paths)
            paths.push(path);
        else
            ctx.fill(path);
        info?.ends.push(sample);
        path = new Path2D();
        count = 0;
    } };
    let previous = nib(points[0], 0), along = 0;
    append(hull(previous.slice()));
    for (let i = 1; i < points.length; i++) {
        sample = i;
        const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        const variable = s.pressure && s.pressureWidth !== false || s.velocityTaper || s.taperStart || s.taperEnd;
        const steps = variable ? Math.max(1, Math.ceil(length / Math.max(.5, Math.min(5, s.size * .1)))) : 1;
        for (let j = 1; j <= steps; j++) {
            const t = j / steps, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, v: (a.v ?? 1) + ((b.v ?? 1) - (a.v ?? 1)) * t };
            const next = nib(p, along + length * t);
            append(hull([...previous, ...next]));
            previous = next;
        }
        along += length;
    }
    if (paths)
        paths.push(path);
    else
        ctx.fill(path);
    info?.ends.push(sample);
    ctx.restore();
    return true;
}
