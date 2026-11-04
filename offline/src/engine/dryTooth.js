export const clamp = (x) => Math.max(0, Math.min(1, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function dryHash(x, y, seed) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function dryNoise(x, y, seed) { const ix = Math.floor(x), iy = Math.floor(y), u = smooth(0, 1, x - ix), v = smooth(0, 1, y - iy), a = dryHash(ix, iy, seed), b = dryHash(ix + 1, iy, seed), c = dryHash(ix, iy + 1, seed), d = dryHash(ix + 1, iy + 1, seed); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function dryNoise1(x, seed) { const ix = Math.floor(x), u = smooth(0, 1, x - ix); return dryHash(ix, 0, seed) * (1 - u) + dryHash(ix + 1, 0, seed) * u; }
const TILE = 64, tiles = new Map(), luts = new Map();
/** Cache distinct world-coordinate paper blocks, never wrap or repeat a tile.
 * Paper is stationary; stroke-specific bristle loading supplies the paint. */
function paper(tx, ty, scale) {
    const key = [tx, ty, scale].join(':'), known = tiles.get(key);
    if (known)
        return known;
    const data = new Uint16Array(TILE * TILE), seed = 671749;
    for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
            const px = tx * TILE + x, py = ty * TILE + y, t = .5 * dryNoise(px / scale, py / scale, seed) + .3 * dryNoise(px / (scale * 2.3) + 7, py / (scale * 2.3) + 3, seed + 1) + .2 * dryNoise(px / (scale * 6) + 1, py / (scale * 6) + 9, seed + 2), wash = .65 * dryNoise(px / 22, py / 5, seed + 21) + .35 * dryNoise(px / 6, py / 2.5, seed + 22);
            data[y * TILE + x] = Math.round(t * 255) | (Math.round(wash * 255) << 8);
        }
    tiles.set(key, data);
    while (tiles.size > 1024)
        tiles.delete(tiles.keys().next().value);
    return data;
}
function toothLut(strength) { const k = Math.round(strength * 100), found = luts.get(k); if (found)
    return found; const data = new Uint8Array(65536); for (let a = 0; a < 256; a++)
    for (let t = 0; t < 256; t++) {
        const A = a / 255;
        data[a * 256 + t] = Math.round(255 * smooth(.18, .78, A + (.5 - t / 255) * (k / 100) * 4 * A * (1 - A)));
    } luts.set(k, data); while (luts.size > 12)
    luts.delete(luts.keys().next().value); return data; }
export const densityAlpha = Uint8Array.from({ length: 65536 }, (_, i) => Math.round(255 * (1 - Math.exp(-i / 4096))));
const deposition = Uint16Array.from({ length: 65536 }, (_, i) => Math.min(65535, Math.round(-Math.log1p(-Math.min(.999999, Math.floor(i / 256) / 255 * (i % 256) / 255)) * 4096)));
/** Fixed-point optical mass is additive: deposition ordering and pass boundaries
 * cannot change coverage through Canvas alpha rounding. */
export function rasterBristle(density, width, height, x0, y0, x1, y1, radius, alpha, clip) {
    const level = Math.round(clamp(alpha) * 255);
    if (!level || radius <= 0)
        return;
    const margin = radius + .5, l = Math.max(0, clip.x, Math.floor(Math.min(x0, x1) - margin)), r = Math.min(width, clip.x + clip.width, Math.ceil(Math.max(x0, x1) + margin)), t = Math.max(0, clip.y, Math.floor(Math.min(y0, y1) - margin)), b = Math.min(height, clip.y + clip.height, Math.ceil(Math.max(y0, y1) + margin)), dx = x1 - x0, dy = y1 - y0, length = dx * dx + dy * dy, base = level * 256;
    for (let y = t; y < b; y++)
        for (let x = l; x < r; x++) {
            const u = length ? clamp(((x + .5 - x0) * dx + (y + .5 - y0) * dy) / length) : 0, vx = x + .5 - x0 - u * dx, vy = y + .5 - y0 - u * dy, d = Math.sqrt(vx * vx + vy * vy), coverage = Math.round(clamp(margin - d) * 255);
            if (coverage) {
                const i = y * width + x;
                density[i] = Math.min(65535, density[i] + deposition[base + coverage]);
            }
        }
}
let output;
export function finishDry(ctx, s, density, region) {
    const { x, y, width: w, height: h } = region;
    if (!w || !h)
        return;
    const blur = s.dryBlur ?? .7, halo = blur ? Math.max(1, Math.ceil(blur * 2)) : 0, width = ctx.canvas.width, height = ctx.canvas.height, weights = Array.from({ length: halo * 2 + 1 }, (_, i) => blur ? Math.exp(-((i - halo) ** 2) / (2 * blur * blur)) : 1), sum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++)
        weights[i] /= sum;
    const horizontal = new Float32Array(w * (h + 2 * halo)), w0 = weights[0], w1 = weights[1] ?? 0, w2 = weights[2] ?? 0;
    for (let j = 0; j < h + 2 * halo; j++) {
        const py = y + j - halo;
        if (py < 0 || py >= height)
            continue;
        for (let i = 0; i < w; i++) {
            const px = x + i;
            let a = 0;
            const base = py * width + px;
            if (halo === 2 && px >= 2 && px < width - 2) {
                if (!(density[base - 2] | density[base - 1] | density[base] | density[base + 1] | density[base + 2]))
                    continue;
                a = (densityAlpha[density[base - 2]] + densityAlpha[density[base + 2]]) * w0 + (densityAlpha[density[base - 1]] + densityAlpha[density[base + 1]]) * w1 + densityAlpha[density[base]] * w2;
            }
            else
                for (let k = -halo; k <= halo; k++) {
                    const q = px + k;
                    if (q >= 0 && q < width)
                        a += densityAlpha[density[py * width + q]] * weights[k + halo];
                }
            horizontal[j * w + i] = a;
        }
    }
    const tx0 = Math.floor(x / TILE), ty0 = Math.floor(y / TILE), columns = Math.floor((x + w - 1) / TILE) - tx0 + 1, tileRows = Math.floor((y + h - 1) / TILE) - ty0 + 1, papers = new Array(columns * tileRows);
    const c = output ??= document.createElement('canvas');
    if (c.width !== w)
        c.width = w;
    if (c.height !== h)
        c.height = h;
    const oc = c.getContext('2d', { willReadFrequently: true }), image = oc.createImageData(w, h), data = image.data, rgb = s.color.slice(1).match(/../g).map(v => parseInt(v, 16)), lut = toothLut(s.dryTooth ?? .9), wash = s.dryWash ?? .15;
    for (let j = 0; j < h; j++) {
        const py = y + j, ty = Math.floor(py / TILE), localY = py - ty * TILE;
        for (let bx = 0; bx < w;) {
            const px = x + bx, tx = Math.floor(px / TILE), paperIndex = (ty - ty0) * columns + tx - tx0, take = Math.min(w - bx, TILE - (px - tx * TILE)), start = localY * TILE + px - tx * TILE;
            for (let k = 0; k < take; k++) {
                let value = 0;
                const at = j * w + bx + k;
                if (halo === 2)
                    value = (horizontal[at] + horizontal[at + 4 * w]) * w0 + (horizontal[at + w] + horizontal[at + 3 * w]) * w1 + horizontal[at + 2 * w] * w2;
                else
                    for (let q = 0; q < weights.length; q++)
                        value += horizontal[(j + q) * w + bx + k] * weights[q];
                const a = Math.round(value);
                if (a < 17)
                    continue;
                const tile = papers[paperIndex] ?? (papers[paperIndex] = paper(tx, ty, s.dryToothScale ?? 2.2)), grain = tile[start + k], opacity = Math.round(lut[a * 256 + (grain & 255)] * (1 - wash * (grain >>> 8) / 255));
                if (!opacity)
                    continue;
                const i = (j * w + bx + k) * 4;
                data[i] = rgb[0];
                data[i + 1] = rgb[1];
                data[i + 2] = rgb[2];
                data[i + 3] = opacity;
            }
            bx += take;
        }
    }
    oc.putImageData(image, 0, 0);
    ctx.drawImage(c, x, y);
}
