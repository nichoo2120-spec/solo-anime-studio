const SIDE = 88, cache = new Map();
const clamp = (v) => Math.max(0, Math.min(1, v));
function hash(x, y, seed) { let h = Math.imul(x + seed * 23, 374761393) ^ Math.imul(y - seed * 71, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function noise(x, y, seed) { const a = Math.floor(x), b = Math.floor(y), u = x - a, v = y - b, s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v), p = hash(a, b, seed) * (1 - s) + hash(a + 1, b, seed) * s, q = hash(a, b + 1, seed) * (1 - s) + hash(a + 1, b + 1, seed) * s; return p * (1 - t) + q * t; }
/** Pure coverage for testing. Nib variation is naturalistic, not parallel lines. */
export function paintNibV8Coverage(kind, u, v, variation = 0) {
    const r = Math.hypot(u, v), large = noise(u * 5 + 18, v * 5 + 11, variation + 19), small = noise(u * 23 + 64, v * 24 + 34, variation + 73);
    if (kind === 'watercolor') {
        const edge = 1 + .08 * (large - .5) + .09 * (small - .5);
        if (r >= edge)
            return 0;
        // Broad, translucent core. Paper grain and wash edges are added in document
        // coordinates in paintRasterV8, so these nibs don't tile visibly.
        return clamp((.62 + .15 * (large - .5)) * clamp((edge - r) / .13));
    }
    // Irregular broken paint islands: avoid periodic trigonometric bristle stripes
    // that made individual dabs leave visible straight lines in version 7.
    const edge = .94 + .21 * (large - .5) + .13 * (small - .5);
    if (r >= edge)
        return 0;
    const burst = noise(u * 11 + 12, v * 13 + 51, variation + 107), flecks = hash(Math.floor(u * 69 + 100), Math.floor(v * 79 + 100), variation + 47);
    const body = clamp((edge - r) / .09);
    return clamp(body * (.42 + .58 * burst) * (flecks < .13 ? .05 : flecks < .25 ? .39 : 1));
}
export function getPaintNibV8(kind, intensity, variation) {
    const level = Math.max(0, Math.min(20, Math.round(intensity / 255 * 20))), variant = kind === 'watercolor' ? 0 : variation % 9, key = `${kind}:${level}:${variant}`;
    const existing = cache.get(key);
    if (existing)
        return existing;
    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;
    const c = canvas.getContext('2d'), img = c.createImageData(SIDE, SIDE);
    for (let j = 0; j < SIDE; j++)
        for (let i = 0; i < SIDE; i++) {
            const k = (j * SIDE + i) * 4, alpha = Math.round(255 * paintNibV8Coverage(kind, 2 * (i + .5) / SIDE - 1, 2 * (j + .5) / SIDE - 1, variant) * level / 20);
            img.data[k] = alpha;
            img.data[k + 1] = alpha;
            img.data[k + 2] = alpha;
            img.data[k + 3] = 255;
        }
    c.putImageData(img, 0, 0);
    if (cache.size >= 220)
        cache.delete(cache.keys().next().value);
    cache.set(key, canvas);
    return canvas;
}
/** Irregular document-space granulation: deterministic, stable during live
 * dirty-region repaints, and without periodic tile seams. */
export function paintPaperGrain(x, y, seed) { return .45 * noise(x * .055, y * .055, seed) + .35 * noise(x * .17, y * .17, seed + 31) + .2 * hash(x | 0, y | 0, seed + 93); }
/** Identical noise arithmetic, evaluated a row at a time. Neighboring pixels
 * share lattice corners, avoiding dozens of repeated hashes per painted pixel. */
export function paintPaperGrainRow(x, y, width, seed, scale = 1) {
    const row = (frequency, seed) => {
        const out = new Float64Array(width), Y = y * scale * frequency, b = Math.floor(Y), v = Y - b, t = v * v * (3 - 2 * v);
        let previous = NaN, h00 = 0, h10 = 0, h01 = 0, h11 = 0;
        for (let i = 0; i < width; i++) {
            const X = (x + i) * scale * frequency, a = Math.floor(X), u = X - a, s = u * u * (3 - 2 * u);
            if (a !== previous) {
                h00 = hash(a, b, seed);
                h10 = hash(a + 1, b, seed);
                h01 = hash(a, b + 1, seed);
                h11 = hash(a + 1, b + 1, seed);
                previous = a;
            }
            const p = h00 * (1 - s) + h10 * s, q = h01 * (1 - s) + h11 * s;
            out[i] = p * (1 - t) + q * t;
        }
        return out;
    };
    const fine = row(.055, seed), mid = row(.17, seed + 31), Y = y * scale | 0;
    for (let i = 0; i < width; i++)
        fine[i] = .45 * fine[i] + .35 * mid[i] + .2 * hash((x + i) * scale | 0, Y, seed + 93);
    return fine;
}
export function paintVariationSeed(id) { let v = 2166136261; for (let i = 0; i < id.length; i++)
    v = Math.imul(v ^ id.charCodeAt(i), 16777619); return v >>> 0; }
