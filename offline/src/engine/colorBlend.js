/** Alpha-weighted separable filter; RGB mixes while existing alpha is retained. */
export function blendPixels(data, width, height, radius, buffers) {
    const temp = buffers?.temp ?? new Float32Array(width * height * 4), out = buffers?.out ?? new Float32Array(width * height * 4), r = Math.max(1, Math.floor(radius));
    for (let y = 0; y < height; y++) {
        let sr = 0, sg = 0, sb = 0, sa = 0;
        const row = y * width;
        for (let x = 0; x <= Math.min(width - 1, r); x++) {
            const i = (row + x) * 4, a = data[i + 3] / 255;
            sr += data[i] * a;
            sg += data[i + 1] * a;
            sb += data[i + 2] * a;
            sa += a;
        }
        for (let x = 0; x < width; x++) {
            const n = Math.min(width - 1, x + r) - Math.max(0, x - r) + 1, i = (row + x) * 4;
            temp[i] = sr / n;
            temp[i + 1] = sg / n;
            temp[i + 2] = sb / n;
            temp[i + 3] = sa / n;
            if (x - r >= 0) {
                const j = (row + x - r) * 4, a = data[j + 3] / 255;
                sr -= data[j] * a;
                sg -= data[j + 1] * a;
                sb -= data[j + 2] * a;
                sa -= a;
            }
            if (x + r + 1 < width) {
                const j = (row + x + r + 1) * 4, a = data[j + 3] / 255;
                sr += data[j] * a;
                sg += data[j + 1] * a;
                sb += data[j + 2] * a;
                sa += a;
            }
        }
    }
    for (let x = 0; x < width; x++) {
        let sr = 0, sg = 0, sb = 0, sa = 0;
        for (let y = 0; y <= Math.min(height - 1, r); y++) {
            const i = (y * width + x) * 4;
            sr += temp[i];
            sg += temp[i + 1];
            sb += temp[i + 2];
            sa += temp[i + 3];
        }
        for (let y = 0; y < height; y++) {
            const n = Math.min(height - 1, y + r) - Math.max(0, y - r) + 1, i = (y * width + x) * 4;
            out[i] = sr / n;
            out[i + 1] = sg / n;
            out[i + 2] = sb / n;
            out[i + 3] = sa / n;
            if (y - r >= 0) {
                const j = ((y - r) * width + x) * 4;
                sr -= temp[j];
                sg -= temp[j + 1];
                sb -= temp[j + 2];
                sa -= temp[j + 3];
            }
            if (y + r + 1 < height) {
                const j = ((y + r + 1) * width + x) * 4;
                sr += temp[j];
                sg += temp[j + 1];
                sb += temp[j + 2];
                sa += temp[j + 3];
            }
        }
    }
    return out;
}
let snapshot;
let tempPool = new Float32Array(0), outPool = new Float32Array(0);
function buffers(count) { if (tempPool.length < count) {
    const capacity = Math.ceil(count / 16384) * 16384;
    tempPool = new Float32Array(capacity);
    outPool = new Float32Array(capacity);
} return { temp: tempPool, out: outPool }; }
const preview = { id: '', base: undefined, radius: 0, tiles: new Map(), bytes: 0 };
/** A gesture reads an immutable layer base. Cache its filtered global-grid tiles,
 * independently of the moving nib mask; each tile includes a filter halo. */
export function applyColorBlend(ctx, mask, s, sourceX, sourceY, region, base) {
    const x = Math.max(0, region.x, sourceX), y = Math.max(0, region.y, sourceY), right = Math.min(ctx.canvas.width, sourceX + mask.width, region.x + region.width), bottom = Math.min(ctx.canvas.height, sourceY + mask.height, region.y + region.height);
    if (right <= x || bottom <= y || s.opacity === 0)
        return;
    const scale = s.transform ? Math.sqrt(Math.abs(s.transform[0] * s.transform[3] - s.transform[1] * s.transform[2])) : 1, radius = Math.max(1, Math.min(64, Math.round(s.size * .3 * scale))), left = Math.max(0, x - radius), top = Math.max(0, y - radius), ex = Math.min(ctx.canvas.width, right + radius), ey = Math.min(ctx.canvas.height, bottom + radius);
    if (base && (preview.id !== s.id || preview.base !== base || preview.radius !== radius)) {
        preview.id = s.id;
        preview.base = base;
        preview.radius = radius;
        preview.tiles.clear();
        preview.bytes = 0;
    }
    let input = base, ox = 0, oy = 0;
    if (!input) {
        input = snapshot ??= document.createElement('canvas');
        input.width = ex - left;
        input.height = ey - top;
        input.getContext('2d').drawImage(ctx.canvas, left, top, input.width, input.height, 0, 0, input.width, input.height);
        ox = left;
        oy = top;
    }
    const ic = input.getContext('2d', { willReadFrequently: true }), mc = mask.getContext('2d', { willReadFrequently: true });
    for (let ty = Math.floor(y / 256) * 256; ty < bottom; ty += 256)
        for (let tx = Math.floor(x / 256) * 256; tx < right; tx += 256) {
            const tw = Math.min(256, ctx.canvas.width - tx), th = Math.min(256, ctx.canvas.height - ty), px = Math.max(x, tx), py = Math.max(y, ty), pw = Math.min(right, tx + tw) - px, ph = Math.min(bottom, ty + th) - py, coverage = mc.getImageData(px - sourceX, py - sourceY, pw, ph).data;
            if (!coverage.some((v, i) => i % 4 === 3 && v > 0))
                continue;
            const key = tx + ':' + ty;
            let tile = base ? preview.tiles.get(key) : undefined;
            if (tile === null)
                continue;
            if (!tile) {
                const sx = Math.max(0, tx - radius), sy = Math.max(0, ty - radius), rx = Math.min(ctx.canvas.width, tx + tw + radius), by = Math.min(ctx.canvas.height, ty + th + radius), w = rx - sx, h = by - sy, raw = ic.getImageData(sx - ox, sy - oy, w, h);
                if (!raw.data.some((v, i) => i % 4 === 3 && v > 0))
                    continue;
                let first = -1, uniform = true;
                for (let j = 0; j < raw.data.length; j += 4) {
                    if (!raw.data[j + 3])
                        continue;
                    if (first < 0) {
                        first = j;
                        continue;
                    }
                    if (raw.data[j] !== raw.data[first] || raw.data[j + 1] !== raw.data[first + 1] || raw.data[j + 2] !== raw.data[first + 2]) {
                        uniform = false;
                        break;
                    }
                }
                if (uniform) {
                    if (base)
                        preview.tiles.set(key, null);
                    continue;
                }
                const filtered = blendPixels(raw.data, w, h, radius, buffers(w * h * 4)), original = new Uint8ClampedArray(tw * th * 4), colors = new Float32Array(tw * th * 3);
                for (let row = 0; row < th; row++)
                    for (let col = 0; col < tw; col++) {
                        const i = row * tw + col, j = ((ty + row - sy) * w + tx + col - sx) * 4;
                        for (let c = 0; c < 4; c++)
                            original[i * 4 + c] = raw.data[j + c];
                        for (let c = 0; c < 3; c++)
                            colors[i * 3 + c] = filtered[j + 3] > 1e-8 ? filtered[j + c] / filtered[j + 3] : raw.data[j + c];
                    }
                tile = { x: tx, y: ty, width: tw, height: th, original, colors, bytes: original.byteLength + colors.byteLength };
                if (base) {
                    preview.tiles.set(key, tile);
                    preview.bytes += tile.bytes;
                    while (preview.bytes > 16 * 1024 * 1024 && preview.tiles.size > 1) {
                        const oldest = preview.tiles.keys().next().value;
                        preview.bytes -= preview.tiles.get(oldest)?.bytes ?? 0;
                        preview.tiles.delete(oldest);
                    }
                }
            }
            else {
                preview.tiles.delete(key);
                preview.tiles.set(key, tile);
            }
            const dest = ctx.getImageData(px, py, pw, ph);
            for (let row = 0; row < ph; row++)
                for (let col = 0; col < pw; col++) {
                    const i = (row * pw + col) * 4, j = (py + row - ty) * tw + px + col - tx, a = coverage[i + 3] / 255 * s.opacity;
                    if (!a || !tile.original[j * 4 + 3])
                        continue;
                    for (let c = 0; c < 3; c++)
                        dest.data[i + c] = Math.round(tile.original[j * 4 + c] + (tile.colors[j * 3 + c] - tile.original[j * 4 + c]) * a);
                    dest.data[i + 3] = tile.original[j * 4 + 3];
                }
            ctx.putImageData(dest, px, py);
        }
}
