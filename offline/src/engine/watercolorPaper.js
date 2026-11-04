import { paintHash, paintNoise } from './paintingTips.js';
// Divisible by both native and broad-wash processing grids.
export const WATER_TILE = 192;
const cache = new Map();
const papers = new Map();
/** Unique document-space water fronts, pigment pools and paper tooth. The
 * low-frequency water field is independent of stamp index and brush size. */
export function watercolorField(tx, ty) {
    const key = tx + ':' + ty, cached = cache.get(key);
    if (cached) {
        cache.delete(key);
        cache.set(key, cached);
        return cached;
    }
    const stride = WATER_TILE / 4 + 1, fields = new Float32Array(stride * stride * 3), data = new Uint8Array(WATER_TILE * WATER_TILE * 4);
    for (let y = 0; y < stride; y++)
        for (let x = 0; x < stride; x++) {
            const wx = tx * WATER_TILE + x * 4, wy = ty * WATER_TILE + y * 4, k = (y * stride + x) * 3;
            // Oblique, independent coordinate bases keep the small water-front warp
            // from following the horizontal/vertical cache edges.
            fields[k] = paintNoise(wx * .041 + wy * .019 + 37, wy * .037 - wx * .023 + 19);
            fields[k + 1] = paintNoise(wx * .033 - wy * .027 + 71, wy * .043 + wx * .017 + 53);
            fields[k + 2] = .65 * paintNoise(wx * .011 + wy * .007 + 103, wy * .013 - wx * .009 + 89) + .35 * paintNoise(wx * .039 - wy * .021 + 17, wy * .031 + wx * .027 + 61);
        }
    for (let y = 0; y < WATER_TILE; y++)
        for (let x = 0; x < WATER_TILE; x++) {
            const gx = x >>> 2, gy = y >>> 2, u = (x & 3) * .25, v = (y & 3) * .25, k = (gy * stride + gx) * 3, j = (y * WATER_TILE + x) * 4;
            for (let c = 0; c < 3; c++)
                data[j + c] = Math.round(255 * ((fields[k + c] * (1 - u) + fields[k + 3 + c] * u) * (1 - v) + (fields[k + stride * 3 + c] * (1 - u) + fields[k + stride * 3 + 3 + c] * u) * v));
            data[j + 3] = Math.round(255 * paintHash(tx * WATER_TILE + x, ty * WATER_TILE + y));
        }
    cache.set(key, data);
    if (cache.size > 128)
        cache.delete(cache.keys().next().value);
    return data;
}
/** Fine watercolor keeps native Canvas coverage. Its subpixel water-front
 * movement is omitted, while the exact same world pigment/paper field is
 * composited from cached alpha surfaces without a per-frame pixel read. */
export function erodeFineWatercolor(ctx, texture, x, y, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    for (let ty = Math.floor(y / WATER_TILE); ty * WATER_TILE < y + h; ty++)
        for (let tx = Math.floor(x / WATER_TILE); tx * WATER_TILE < x + w; tx++) {
            const key = [tx, ty, texture].join(':');
            let paper = papers.get(key);
            if (!paper) {
                const field = watercolorField(tx, ty);
                paper = document.createElement('canvas');
                paper.width = paper.height = WATER_TILE;
                const pc = paper.getContext('2d'), img = pc.createImageData(WATER_TILE, WATER_TILE);
                for (let i = 0; i < field.length; i += 4)
                    img.data[i + 3] = Math.round(255 * (1 - (.78 + .22 * field[i + 2] / 255) * (1 - texture * .11 * field[i + 3] / 255)));
                pc.putImageData(img, 0, 0);
                papers.set(key, paper);
                if (papers.size > 64) {
                    const first = papers.keys().next().value, old = papers.get(first);
                    old.width = old.height = 0;
                    papers.delete(first);
                }
            }
            ctx.drawImage(paper, tx * WATER_TILE - x, ty * WATER_TILE - y);
        }
    ctx.restore();
}
