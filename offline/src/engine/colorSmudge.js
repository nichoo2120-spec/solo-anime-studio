import { finalGeometry } from './geometryCache.js';
import { paintSamples } from './paintPass.js';
import { colorContacts } from './coloringPath.js';
import { projectPoint } from './perspectiveWarp.js';
const clamp = (v) => Math.max(0, Math.min(1, v));
const pickupTaps = [[-.65, .25], [0, .5], [.65, .25]];
/** Read-only source tiles. The live engine supplies the layer before contact. */
class ColorSource {
    canvas;
    tiles = new Map();
    bytes = 0;
    ctx;
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    sample(x, y, out) {
        out.fill(0);
        const ix = Math.floor(x - .5), iy = Math.floor(y - .5), u = x - .5 - ix, v = y - .5 - iy;
        for (let dy = 0; dy < 2; dy++)
            for (let dx = 0; dx < 2; dx++) {
                const px = ix + dx, py = iy + dy;
                if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height)
                    continue;
                const tx = Math.floor(px / 128) * 128, ty = Math.floor(py / 128) * 128, key = ty * 1048576 + tx;
                let tile = this.tiles.get(key);
                if (!tile) {
                    const width = Math.min(128, this.canvas.width - tx), height = Math.min(128, this.canvas.height - ty), data = this.ctx.getImageData(tx, ty, width, height).data;
                    tile = { data, width, height, bytes: data.byteLength };
                    this.tiles.set(key, tile);
                    this.bytes += tile.bytes;
                    while (this.bytes > 16 * 1024 * 1024 && this.tiles.size > 1) {
                        const first = this.tiles.keys().next().value;
                        this.bytes -= this.tiles.get(first).bytes;
                        this.tiles.delete(first);
                    }
                }
                const i = ((py - ty) * tile.width + px - tx) * 4, weight = (dx ? u : 1 - u) * (dy ? v : 1 - v), alpha = tile.data[i + 3] / 255;
                for (let c = 0; c < 3; c++)
                    out[c] += tile.data[i + c] * alpha * weight;
                out[3] += alpha * weight;
            }
        return out;
    }
}
let preview;
function transformedSamples(s) {
    const raw = paintSamples(finalGeometry(s), .18);
    if (!s.transform && !s.perspective)
        return { samples: raw, settings: s };
    const [a, b, c, d, e, f] = s.transform ?? [1, 0, 0, 1, 0, 0], map = (p) => s.perspective ? { ...p, ...projectPoint(p, s.perspective) } : { ...p, x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }, points = raw.points.map(map), arc = [0];
    for (let i = 1; i < points.length; i++)
        arc.push(arc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    const theta = (s.tipAngle ?? 0) * Math.PI / 180, tipAngle = Math.atan2(b * Math.cos(theta) + d * Math.sin(theta), a * Math.cos(theta) + c * Math.sin(theta)) * 180 / Math.PI, size = s.size * Math.sqrt(Math.abs(a * d - b * c));
    return { samples: { points, arc, ends: [], total: arc.at(-1) ?? 0 }, settings: { ...s, size, tipAngle, transform: undefined, perspective: undefined } };
}
/** A causal brush reservoir carries source pigment along the gesture. It is
 * evaluated once per arc-length contact and bristle lane, not per input event.
 * Final coverage mixes its RGB into original paint while keeping original alpha. */
export function applyColorSmudge(ctx, mask, s, sourceX, sourceY, region, base) {
    const x = Math.max(0, region.x, sourceX), y = Math.max(0, region.y, sourceY), right = Math.min(ctx.canvas.width, sourceX + mask.width, region.x + region.width), bottom = Math.min(ctx.canvas.height, sourceY + mask.height, region.y + region.height), w = right - x, h = bottom - y;
    if (w <= 0 || h <= 0 || s.opacity === 0 || s.flow === 0 || !s.points.length)
        return;
    let reader;
    if (base) {
        if (!preview || preview.id !== s.id || preview.base !== base)
            preview = { id: s.id, base, source: new ColorSource(base) };
        reader = preview.source;
    }
    else
        reader = new ColorSource(ctx.canvas);
    const { samples, settings } = transformedSamples(s), { rows } = colorContacts(settings, samples), lanes = 24, colors = new Float32Array(rows.length * lanes * 4), sample = new Float64Array(4), tap = new Float64Array(4);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i], distance = i ? row.arc - rows[i - 1].arc : 0, rate = 1 - Math.exp(-distance / Math.max(5, settings.size * (.65 + .45 * (1 - row.pressure))));
        for (let lane = 0; lane < lanes; lane++) {
            const side = (lane / (lanes - 1) * 2 - 1) * row.crossRadius * .92, k = (i * lanes + lane) * 4;
            sample.fill(0);
            for (const [offset, weight] of pickupTaps) {
                reader.sample(row.x - row.ty * side + row.tx * row.alongRadius * offset, row.y + row.tx * side + row.ty * row.alongRadius * offset, tap);
                for (let c = 0; c < 4; c++)
                    sample[c] += tap[c] * weight;
            }
            for (let c = 0; c < 4; c++) {
                const previous = i ? colors[k - lanes * 4 + c] : sample[c];
                colors[k + c] = !i || colors[k - lanes * 4 + 3] < 1e-6 ? sample[c] : previous + (sample[c] - previous) * rate;
            }
        }
    }
    // Scatter carried pigment into a normalized contact field. Average pigment,
    // not nearest-path texture coordinates, so overlapping return strokes cannot
    // switch abruptly between two reservoirs at a centerline boundary.
    const grid = settings.size >= 128 ? 8 : 4, gx = Math.floor(x / grid), gy = Math.floor(y / grid), columns = Math.ceil(right / grid) - gx + 2, height = Math.ceil(bottom / grid) - gy + 2, nodes = new Float32Array(columns * height * 4);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i], long = Math.max(grid, row.alongRadius * 1.3), wide = Math.max(grid, row.crossRadius * 1.3), pad = Math.max(long, wide), xmin = Math.max(gx, Math.floor((row.x - pad) / grid)), xmax = Math.min(gx + columns - 1, Math.ceil((row.x + pad) / grid)), ymin = Math.max(gy, Math.floor((row.y - pad) / grid)), ymax = Math.min(gy + height - 1, Math.ceil((row.y + pad) / grid));
        for (let yy = ymin; yy <= ymax; yy++)
            for (let xx = xmin; xx <= xmax; xx++) {
                const dx = xx * grid - row.x, dy = yy * grid - row.y, across = -dx * row.ty + dy * row.tx, rr = ((dx * row.tx + dy * row.ty) / long) ** 2 + (across / wide) ** 2;
                if (rr >= 1)
                    continue;
                const weight = (1 - rr) ** 2, lane = clamp(across / Math.max(.1, row.crossRadius) * .5 + .5) * (lanes - 1), col = Math.floor(lane), u = lane - col, a = (i * lanes + col) * 4, b = (i * lanes + Math.min(lanes - 1, col + 1)) * 4, k = ((yy - gy) * columns + xx - gx) * 4;
                for (let c = 0; c < 4; c++)
                    nodes[k + c] += (colors[a + c] * (1 - u) + colors[b + c] * u) * weight;
            }
    }
    for (let i = 0; i < nodes.length; i += 4)
        if (nodes[i + 3] > 1e-6) {
            for (let c = 0; c < 3; c++)
                nodes[i + c] /= nodes[i + 3];
            nodes[i + 3] = 1;
        }
    const coverage = mask.getContext('2d', { willReadFrequently: true }).getImageData(x - sourceX, y - sourceY, w, h).data, dest = (base ?? ctx.canvas).getContext('2d', { willReadFrequently: true }).getImageData(x, y, w, h), data = dest.data;
    for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
            const j = (yy * w + xx) * 4, amount = coverage[j + 3] / 255 * s.opacity;
            if (!amount || !data[j + 3])
                continue;
            const fx = (x + xx + .5) / grid - gx, fy = (y + yy + .5) / grid - gy, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
            let red = 0, green = 0, blue = 0, valid = 0;
            for (let dy = 0; dy < 2; dy++)
                for (let dx = 0; dx < 2; dx++) {
                    const k = ((iy + dy) * columns + ix + dx) * 4, weight = (dx ? u : 1 - u) * (dy ? v : 1 - v) * nodes[k + 3];
                    valid += weight;
                    red += nodes[k] * weight;
                    green += nodes[k + 1] * weight;
                    blue += nodes[k + 2] * weight;
                }
            if (valid < 1e-6)
                continue;
            data[j] = Math.round(data[j] + (red / valid - data[j]) * amount);
            data[j + 1] = Math.round(data[j + 1] + (green / valid - data[j + 1]) * amount);
            data[j + 2] = Math.round(data[j + 2] + (blue / valid - data[j + 2]) * amount);
        }
    ctx.putImageData(dest, x, y);
}
