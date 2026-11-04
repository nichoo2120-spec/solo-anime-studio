import { floodFill } from './flood.js';
/** Separable binary box morphology, O(pixels), independent of brush-gap radius. */
export function morphology(input, w, h, r, dilate) {
    if (!r)
        return input.slice();
    const temp = new Uint8Array(input.length), out = new Uint8Array(input.length), span = r * 2 + 1;
    const pass = (src, dst, rows, cols, stride, rowStride) => { for (let row = 0; row < rows; row++) {
        let sum = 0;
        const at = (col) => col < 0 || col >= cols ? 0 : src[row * rowStride + col * stride];
        for (let i = -r; i <= r; i++)
            sum += at(i);
        for (let col = 0; col < cols; col++) {
            dst[row * rowStride + col * stride] = dilate ? (sum > 0 ? 1 : 0) : (sum === span ? 1 : 0);
            sum += at(col + r + 1) - at(col - r);
        }
    } };
    pass(input, temp, h, w, 1, w);
    pass(temp, out, w, h, w, 1);
    return out;
}
export function advancedFill(data, width, height, x, y, color, tolerance, gap = 0, expansion = 0) {
    if (!gap && !expansion)
        return antiAlias(floodFill(data, width, height, x, y, color, tolerance), data, width, height, color);
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= width || y >= height)
        return { output: new Uint8ClampedArray(data.length), touchesEdge: false, count: 0 };
    const target = data.slice((y * width + x) * 4, (y * width + x) * 4 + 4), barriers = new Uint8Array(width * height);
    for (let i = 0; i < barriers.length; i++) {
        const j = i * 4;
        barriers[i] = target[3] === 0 && data[j + 3] === 0 ? 0 : Math.max(Math.abs(data[j] - target[0]), Math.abs(data[j + 1] - target[1]), Math.abs(data[j + 2] - target[2]), Math.abs(data[j + 3] - target[3])) > tolerance ? 1 : 0;
    }
    const radius = Math.ceil(Math.max(0, Math.min(10, gap)) / 2), closed = radius ? morphology(morphology(barriers, width, height, radius, true), width, height, radius, false) : barriers, pseudo = new Uint8ClampedArray(data.length);
    for (let i = 0; i < closed.length; i++)
        pseudo[i * 4 + 3] = closed[i] * 255;
    if (closed[y * width + x])
        return { output: new Uint8ClampedArray(data.length), touchesEdge: false, count: 0 };
    const result = floodFill(pseudo, width, height, x, y, color, 0);
    if (expansion) {
        const region = new Uint8Array(closed.length);
        for (let i = 0; i < region.length; i++)
            region[i] = result.output[i * 4 + 3] ? 1 : 0;
        const expanded = morphology(region, width, height, Math.round(Math.max(0, Math.min(5, expansion))), true);
        for (let i = 0; i < expanded.length; i++)
            if (expanded[i])
                result.output.set(color, i * 4);
    }
    return antiAlias(result, data, width, height, color);
}
function antiAlias(result, reference, w, h, color) {
    const original = result.output.slice();
    for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x, j = i * 4, a = reference[j + 3];
            if (original[j + 3] || a === 0 || a === 255)
                continue;
            if ([i - 1, i + 1, i - w, i + w].some(n => original[n * 4 + 3] > 0)) {
                result.output.set(color, j);
                result.output[j + 3] = Math.round(color[3] * (1 - a / 255));
            }
        }
    return result;
}
