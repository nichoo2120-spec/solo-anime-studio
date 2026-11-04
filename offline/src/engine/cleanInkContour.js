import { pressureResponse } from './strokeGeometry.js';
const cache = new WeakMap();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v) => Math.max(0, Math.min(1, v));
const at = (c, t) => { const u = 1 - t; return { x: u * u * u * c.a.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.b.x, y: u * u * u * c.a.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.b.y }; };
function tangent(c, t) {
    const u = 1 - t;
    let x = u * u * (c.c1.x - c.a.x) + 2 * u * t * (c.c2.x - c.c1.x) + t * t * (c.b.x - c.c2.x), y = u * u * (c.c1.y - c.a.y) + 2 * u * t * (c.c2.y - c.c1.y) + t * t * (c.b.y - c.c2.y), d = Math.hypot(x, y);
    if (d < 1e-8) {
        const a = at(c, Math.max(0, t - .001)), b = at(c, Math.min(1, t + .001));
        x = b.x - a.x;
        y = b.y - a.y;
        d = Math.hypot(x, y);
    }
    return d > 1e-9 ? { x: x / d, y: y / d } : { x: 1, y: 0 };
}
function curveTable(c) {
    const hull = distance(c.a, c.c1) + distance(c.c1, c.c2) + distance(c.c2, c.b), n = Math.max(12, Math.min(512, Math.ceil(hull / 3))), lengths = [0];
    let previous = c.a;
    for (let i = 1; i <= n; i++) {
        const p = at(c, i / n);
        lengths.push(lengths.at(-1) + distance(previous, p));
        previous = p;
    }
    return { n, lengths, length: lengths.at(-1) };
}
export function cleanInkLength(line) { return line.nodes.slice(1).reduce((s, b, i) => s + curveTable({ a: line.nodes[i], c1: line.nodes[i].out, c2: b.in, b }).length, 0); }
/** Monotone Hermite width interpolation has no pressure-key kinks and never
 * overshoots a thin/thick transition. Saved width samples remain editable. */
function pressureAt(profile, t) {
    let lo = 0, hi = profile.length - 1;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (profile[mid].t < t)
            lo = mid;
        else
            hi = mid;
    }
    const a = profile[lo], b = profile[hi], h = b.t - a.t;
    if (h < 1e-9)
        return a.p;
    const slope = (i) => {
        const sec = (j) => (profile[j + 1].p - profile[j].p) / (profile[j + 1].t - profile[j].t);
        if (i === 0)
            return sec(0);
        if (i === profile.length - 1)
            return sec(i - 1);
        const l = sec(i - 1), r = sec(i);
        return l * r <= 0 ? 0 : 2 * l * r / (l + r);
    };
    const u = clamp((t - a.t) / h), u2 = u * u, u3 = u2 * u;
    return Math.max(Math.min(a.p, b.p), Math.min(Math.max(a.p, b.p), (2 * u3 - 3 * u2 + 1) * a.p + (u3 - 2 * u2 + u) * h * slope(lo) + (-2 * u3 + 3 * u2) * b.p + (u3 - u2) * h * slope(hi)));
}
function arc(commands, p, r, start, sweep) {
    const steps = Math.ceil(Math.abs(sweep) / (Math.PI / 2));
    for (let i = 0; i < steps; i++) {
        const a = start + sweep * i / steps, b = start + sweep * (i + 1) / steps, k = 4 / 3 * Math.tan((b - a) / 4);
        commands.push({ op: 'C', c1: { x: p.x + r * (Math.cos(a) - k * Math.sin(a)), y: p.y + r * (Math.sin(a) + k * Math.cos(a)) }, c2: { x: p.x + r * (Math.cos(b) + k * Math.sin(b)), y: p.y + r * (Math.sin(b) - k * Math.cos(b)) }, p: { x: p.x + r * Math.cos(b), y: p.y + r * Math.sin(b) } });
    }
}
/** Version 5: analytic Bezier tangents and adaptive cubic offset curves.
 * All sections share one nonzero fill, so intersections and round joins do not
 * darken translucent ink. No polygonized edge or post-fit centerline blur. */
export function cleanInkCommands(line) {
    const cached = cache.get(line);
    if (cached)
        return cached;
    if (!line.nodes.length)
        return [];
    if (line.profileVersion === 6 && line.inkSections?.length) {
        let start = 0, offset = 0;
        const sections = line.inkSections.map(section => { const nodes = line.nodes.slice(start, section.end + 1); start = section.end; const subline = { ...line, nodes, widthProfile: section.widthProfile, inkSections: undefined }; return { line: subline, length: cleanInkLength(subline) }; });
        const total = sections.reduce((s, section) => s + section.length, 0), commands = [];
        for (const section of sections) {
            commands.push(...cleanInkCommands({ ...section.line, inkOffset: offset, inkTotal: total }));
            offset += section.length;
        }
        cache.set(line, commands);
        return commands;
    }
    const curves = line.nodes.slice(1).map((b, i) => ({ a: line.nodes[i], c1: line.nodes[i].out, c2: b.in, b }));
    const tables = curves.map(curveTable);
    const length = tables.reduce((s, c) => s + c.length, 0), closed = length > line.width * 6 && distance(line.nodes[0], line.nodes.at(-1)) < .05;
    const startTaper = closed ? 0 : (line.taperStart ?? 0) * (line.profileVersion === 6 ? line.width * 4 : Math.min(length * .42, line.width * 12)), endTaper = closed ? 0 : (line.taperEnd ?? 0) * (line.profileVersion === 6 ? line.width * 4 : Math.min(length * .42, line.width * 12));
    const low = Math.max(.01, Math.min(2, (line.minWidthPercent ?? 20) / 100)), high = Math.max(low, Math.min(3, (line.maxWidthPercent ?? 100) / 100));
    const radius = (s, fallback) => {
        const p = line.widthProfile?.length ? pressureAt(line.widthProfile, clamp(s / (length || 1))) : fallback;
        const sensed = line.pressure ? pressureResponse(clamp(p), line.pressureCurve) : 1;
        const width = line.pressure ? low + (high - low) * sensed : 1;
        const globalS = (line.inkOffset ?? 0) + s, total = line.inkTotal ?? length;
        const taper = Math.min(startTaper ? clamp(globalS / startTaper) : 1, endTaper ? clamp((total - globalS) / endTaper) : 1);
        return Math.max(.005, line.width * .5 * width * (line.profileVersion === 6 ? Math.sin(taper * Math.PI / 2) : taper));
    };
    const commands = [];
    if (length < .025) {
        const p = line.nodes[0], r = radius(0, p.p);
        commands.push({ op: 'M', p: { x: p.x + r, y: p.y } });
        arc(commands, p, r, 0, -Math.PI * 2);
        commands.push({ op: 'Z' });
        cache.set(line, commands);
        return commands;
    }
    let offset = 0;
    for (let index = 0; index < curves.length; index++) {
        const c = curves[index], table = tables[index];
        if (table.length < 1e-7)
            continue;
        const along = (t) => { const u = clamp(t) * table.n, i = Math.min(table.n - 1, Math.floor(u)); return offset + table.lengths[i] + (table.lengths[i + 1] - table.lengths[i]) * (u - i); };
        const rAt = (t) => radius(along(t), line.nodes[index].p + (line.nodes[index + 1].p - line.nodes[index].p) * t);
        const edge = (t, side) => { const p = at(c, t), v = tangent(c, t), r = rAt(t) * side; return { x: p.x - v.y * r, y: p.y + v.x * r }; };
        const derivative = (t, side) => { const a = Math.max(0, t - .0001), b = Math.min(1, t + .0001), p = edge(a, side), q = edge(b, side); return { x: (q.x - p.x) / (b - a), y: (q.y - p.y) / (b - a) }; };
        const build = (side) => {
            const sections = [];
            const visit = (a, b, depth = 0) => {
                const p = edge(a, side), q = edge(b, side), v = derivative(a, side), w = derivative(b, side), h = (b - a) / 3;
                const candidate = { a: p, c1: { x: p.x + v.x * h, y: p.y + v.y * h }, c2: { x: q.x - w.x * h, y: q.y - w.y * h }, b: q };
                if (depth < 9 && [.25, .5, .75].some(u => distance(at(candidate, u), edge(a + (b - a) * u, side)) > .025)) {
                    const m = (a + b) / 2;
                    visit(a, m, depth + 1);
                    visit(m, b, depth + 1);
                }
                else
                    sections.push(candidate);
            };
            const steps = Math.max(1, Math.min(1024, Math.ceil(table.length / 8)));
            for (let i = 0; i < steps; i++)
                visit(i / steps, (i + 1) / steps);
            return sections;
        };
        const left = build(1), right = build(-1);
        commands.push({ op: 'M', p: left[0].a });
        for (const s of left)
            commands.push({ op: 'C', c1: s.c1, c2: s.c2, p: s.b });
        const end = tangent(c, 1);
        arc(commands, c.b, rAt(1), Math.atan2(end.y, end.x) + Math.PI / 2, -Math.PI);
        for (let i = right.length - 1; i >= 0; i--) {
            const s = right[i];
            commands.push({ op: 'C', c1: s.c2, c2: s.c1, p: s.a });
        }
        const start = tangent(c, 0);
        arc(commands, c.a, rAt(0), Math.atan2(start.y, start.x) - Math.PI / 2, -Math.PI);
        commands.push({ op: 'Z' });
        offset += table.length;
    }
    cache.set(line, commands);
    return commands;
}
export function cleanInkPathData(line) {
    return cleanInkCommands(line).map(c => c.op === 'M' ? `M${c.p.x} ${c.p.y}` : c.op === 'C' ? `C${c.c1.x} ${c.c1.y} ${c.c2.x} ${c.c2.y} ${c.p.x} ${c.p.y}` : 'Z').join(' ');
}
export function traceCleanInk(ctx, line) {
    ctx.beginPath();
    for (const c of cleanInkCommands(line)) {
        if (c.op === 'M')
            ctx.moveTo(c.p.x, c.p.y);
        else if (c.op === 'C')
            ctx.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.p.x, c.p.y);
        else
            ctx.closePath();
    }
}
