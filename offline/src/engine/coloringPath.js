import { pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse } from './pressureChannels.js';
import { colorNibFootprint } from './colorNibs.js';
import { defaultColorNib } from '../core/coloring.js';
const clamp = (v) => Math.max(0, Math.min(1, v));
/** Distance-anchored material contacts, independent of pointer-event frequency. */
export function colorContacts(s, samples) {
    const step = Math.max(2, Math.min(12, s.size * .09)), rows = [], shape = colorNibFootprint(s.colorNib ?? defaultColorNib(s.brushTip));
    let index = 1;
    const at = (d) => { while (index < samples.points.length - 1 && samples.arc[index] < d)
        index++; const a = samples.points[Math.max(0, index - 1)] ?? samples.points[0], b = samples.points[index] ?? a, start = samples.arc[index - 1] ?? 0, span = (samples.arc[index] ?? 0) - start, t = span ? clamp((d - start) / span) : 0; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, v: (a.v ?? .65) + ((b.v ?? .65) - (a.v ?? .65)) * t }; };
    for (let d = 0;; d = Math.min(samples.total, d + step)) {
        const p = at(d), a = samples.points[Math.max(0, index - 1)] ?? p, b = samples.points[index] ?? p, angle = Math.atan2(b.y - a.y, b.x - a.x), tx = Math.cos(angle), ty = Math.sin(angle), pressure = s.pressure ? pressureResponse(p.p ** s.response, s.pressureCurve) : 1, width = s.pressure && s.pressureWidth !== false || s.velocityTaper ? widthResponse(pressure * (s.velocityTaper ? p.v ?? 1 : 1), s) : 1, radius = s.size * .5 * width * taperFactor(d, samples.total, s.taperStart, s.taperEnd, Math.max(64, s.size * 12)), theta = (s.tipAngle ?? 0) * Math.PI / 180 + (s.colorNibFollow ? angle + Math.PI / 2 : 0), co = Math.cos(theta - angle), si = Math.sin(theta - angle), crossRadius = Math.max(.1, radius * Math.max(...shape.map(q => Math.abs(q.x * si + q.y * co)))), alongRadius = Math.max(.1, radius * Math.max(...shape.map(q => Math.abs(q.x * co - q.y * si))));
        rows.push({ x: p.x, y: p.y, arc: d, pressure, velocity: p.v ?? .65, radius, crossRadius, alongRadius, tx, ty });
        if (d >= samples.total)
            break;
    }
    return { rows, step };
}
/** A small, canvas-anchored interpolation grid carries local stroke coordinates.
 * It is not a texture: pigment is evaluated from the saved gesture's frame. */
export class ColoringField {
    rows;
    grid;
    bins = new Map();
    bin;
    gx = 0;
    gy = 0;
    columns = 0;
    values = new Float32Array(0);
    constructor(rows, grid = 4) {
        this.rows = rows;
        this.grid = grid;
        this.bin = Math.max(32, Math.min(128, rows.reduce((max, r) => Math.max(max, r.radius * 2), 0)));
        for (let i = 0; i < Math.max(1, rows.length - 1); i++) {
            const a = rows[i], b = rows[Math.min(rows.length - 1, i + 1)], pad = Math.max(a.radius, b.radius) * 1.5 + grid * 2;
            for (let y = Math.floor((Math.min(a.y, b.y) - pad) / this.bin); y <= Math.floor((Math.max(a.y, b.y) + pad) / this.bin); y++)
                for (let x = Math.floor((Math.min(a.x, b.x) - pad) / this.bin); x <= Math.floor((Math.max(a.x, b.x) + pad) / this.bin); x++) {
                    const key = y * 1048576 + x, list = this.bins.get(key);
                    if (list)
                        list.push(i);
                    else
                        this.bins.set(key, [i]);
                }
        }
    }
    prepare(x, y, w, h) {
        this.gx = Math.floor(x / this.grid);
        this.gy = Math.floor(y / this.grid);
        this.columns = Math.ceil((x + w) / this.grid) - this.gx + 2;
        const height = Math.ceil((y + h) / this.grid) - this.gy + 2;
        this.values = new Float32Array(this.columns * height * 5);
        for (let yy = 0; yy < height; yy++)
            for (let xx = 0; xx < this.columns; xx++) {
                const px = (xx + this.gx) * this.grid, py = (yy + this.gy) * this.grid, list = this.bins.get(Math.floor(py / this.bin) * 1048576 + Math.floor(px / this.bin)) ?? [0];
                let best = Infinity, chosen = 0, u = 0;
                for (const i of list) {
                    const a = this.rows[i], b = this.rows[Math.min(this.rows.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy, t = length ? clamp(((px - a.x) * dx + (py - a.y) * dy) / length) : 0, ex = px - a.x - dx * t, ey = py - a.y - dy * t, r = Math.max(1, a.radius + (b.radius - a.radius) * t), score = (ex * ex + ey * ey) / (r * r);
                    if (score < best) {
                        best = score;
                        chosen = i;
                        u = t;
                    }
                }
                const a = this.rows[chosen], b = this.rows[Math.min(this.rows.length - 1, chosen + 1)], tx = a.tx + (b.tx - a.tx) * u, ty = a.ty + (b.ty - a.ty) * u, norm = Math.hypot(tx, ty) || 1, dx = px - a.x - (b.x - a.x) * u, dy = py - a.y - (b.y - a.y) * u, k = (yy * this.columns + xx) * 5;
                this.values[k] = a.arc + (b.arc - a.arc) * u + (dx * tx + dy * ty) / norm;
                this.values[k + 1] = (-dx * ty + dy * tx) / norm;
                this.values[k + 2] = a.pressure + (b.pressure - a.pressure) * u;
                this.values[k + 3] = a.velocity + (b.velocity - a.velocity) * u;
                this.values[k + 4] = a.crossRadius + (b.crossRadius - a.crossRadius) * u;
            }
    }
    sample(x, y, out) {
        const fx = x / this.grid - this.gx, fy = y / this.grid - this.gy, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy, a = (iy * this.columns + ix) * 5, b = a + 5, c = a + this.columns * 5, d = c + 5;
        for (let j = 0; j < 5; j++)
            out[j] = (this.values[a + j] * (1 - u) + this.values[b + j] * u) * (1 - v) + (this.values[c + j] * (1 - u) + this.values[d + j] * u) * v;
        return out;
    }
}
