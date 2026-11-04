/** Watercolor pigment lives in document space, independent of nib size, dab
 * number and redraw bounds. Tiles here are bounded caches of unique regions;
 * their contents are never wrapped or repeated across the drawing. */
const TILE = 128, GRID = 4, CELLS = TILE / GRID, STRIDE = CELLS + 1, FINE_STRIDE = TILE / 2 + 1;
const tiles = new Map();
const clamp = (v) => Math.max(0, Math.min(1, v));
function hash(x, y) {
    let h = Math.imul(x + 37, 374761393) ^ Math.imul(y + 83, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}
const GX = [1, -.70710678, 0, .70710678, -1, .70710678, 0, -.70710678];
const GY = [0, .70710678, -1, .70710678, 0, -.70710678, 1, -.70710678];
const F = (Math.sqrt(3) - 1) / 2, G = (3 - Math.sqrt(3)) / 6;
function corner(i, j, x, y) {
    const t = .5 - x * x - y * y;
    if (t <= 0)
        return 0;
    const k = hash(i, j) & 7, t2 = t * t;
    return t2 * t2 * (GX[k] * x + GY[k] * y);
}
/** Continuous gradient noise on a triangular lattice avoids the rectangular
 * pools of the old bilinear value noise. Hashes do not use a modulo tile. */
function noise(x, y) {
    const skew = (x + y) * F, i = Math.floor(x + skew), j = Math.floor(y + skew);
    const unskew = (i + j) * G, dx = x - i + unskew, dy = y - j + unskew;
    const ix = dx > dy ? 1 : 0, iy = 1 - ix;
    return 99.2 * (corner(i, j, dx, dy) + corner(i + ix, j + iy, dx - ix + G, dy - iy + G) + corner(i + 1, j + 1, dx - 1 + 2 * G, dy - 1 + 2 * G));
}
function pools(x, y) {
    // Smooth domain warping breaks recognizable lattice directions. The same
    // world coordinate always gives the same pigment, including across caches.
    const wx = x + 18 * noise(x * .0059 + 17, y * .0059 - 29);
    const wy = y + 18 * noise(x * .0059 - 73, y * .0059 + 43);
    return .38 + .28 * noise(wx * .017 + 31, wy * .017 - 59) + .12 * noise(wx * .053 - 101, wy * .053 + 17);
}
function tile(tx, ty) {
    const key = tx + ':' + ty, cached = tiles.get(key);
    if (cached) {
        tiles.delete(key);
        tiles.set(key, cached);
        return cached;
    }
    const c = document.createElement('canvas');
    c.width = c.height = TILE;
    const ctx = c.getContext('2d'), image = ctx.createImageData(TILE, TILE);
    // Low-frequency water pools need only a small shared world grid. Fine paper
    // granulation is evaluated per pixel; no per-frame pixel readback is needed.
    const field = new Float64Array(STRIDE * STRIDE);
    for (let y = 0; y <= CELLS; y++)
        for (let x = 0; x <= CELLS; x++)
            field[y * STRIDE + x] = pools(tx * TILE + x * GRID, ty * TILE + y * GRID);
    const fine = new Float64Array(FINE_STRIDE * FINE_STRIDE);
    for (let y = 0; y < FINE_STRIDE; y++)
        for (let x = 0; x < FINE_STRIDE; x++)
            fine[y * FINE_STRIDE + x] = .045 * noise((tx * TILE + x * 2) * .23 + 13, (ty * TILE + y * 2) * .23 + 67);
    for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
            const wx = tx * TILE + x, wy = ty * TILE + y, gx = x >>> 2, gy = y >>> 2, u = (x & 3) / GRID, v = (y & 3) / GRID, k = gy * STRIDE + gx;
            const water = (field[k] * (1 - u) + field[k + 1] * u) * (1 - v) + (field[k + STRIDE] * (1 - u) + field[k + STRIDE + 1] * u) * v;
            const fk = (y >>> 1) * FINE_STRIDE + (x >>> 1), fu = (x & 1) * .5, fv = (y & 1) * .5;
            const pigment = (fine[fk] * (1 - fu) + fine[fk + 1] * fu) * (1 - fv) + (fine[fk + FINE_STRIDE] * (1 - fu) + fine[fk + FINE_STRIDE + 1] * fu) * fv + .05 * (hash(wx, wy) / 4294967295 - .5), index = (y * TILE + x) * 4;
            // destination-out uses only alpha; leaving RGB zero avoids unused stores.
            image.data[index + 3] = Math.round(255 * clamp(water + pigment));
        }
    ctx.putImageData(image, 0, 0);
    tiles.set(key, c);
    // Match the previous painting grain's 16 MiB budget. A smaller cache churns
    // while painting across a Full HD document and needlessly regenerates pools.
    if (tiles.size > 256) {
        const first = tiles.keys().next().value, old = tiles.get(first);
        old.width = old.height = 0;
        tiles.delete(first);
    }
    return c;
}
/** Apply pigment variation once to combined stroke coverage. Eroding each dab
 * separately would reprint stamp texture and create overlap-dependent bands. */
export function erodeWatercolorGrain(ctx, strength, x, y, w, h) {
    if (strength <= 0 || w <= 0 || h <= 0)
        return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = clamp(strength);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    for (let ty = Math.floor(y / TILE); ty * TILE < y + h; ty++)
        for (let tx = Math.floor(x / TILE); tx * TILE < x + w; tx++)
            ctx.drawImage(tile(tx, ty), tx * TILE - x, ty * TILE - y);
    ctx.restore();
}
