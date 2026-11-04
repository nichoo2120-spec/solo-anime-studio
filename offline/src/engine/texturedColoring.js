import { paintNoise, paintHash } from './paintingTips.js';
import { colorContacts, ColoringField } from './coloringPath.js';
import { opacityResponse } from './pressureChannels.js';
import { watercolorSeedFor } from '../core/paintTips.js';
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => { n = clamp(n); return n * n * (3 - 2 * n); };
let distances = new Float32Array(0);
/** Loaded paint with directional dry scratches, rather than discrete ribbons.
 * The continuous physical contact owns coverage. The saved stroke's coordinates
 * own its pigment breakup; neither a texture tile nor a stamp image is moved. */
export function shadeTexturedColoring(s, samples, image, x, y, scale) {
    const { width: w, height: h, data } = image, count = w * h;
    if (distances.length < count)
        distances = new Float32Array(Math.ceil(count / 16384) * 16384);
    const distance = distances.subarray(0, count);
    for (let i = 0; i < count; i++)
        distance[i] = data[i * 4] === 0 ? 0 : data[i * 4] < 255 ? data[i * 4] / 255 : 1e6;
    for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
            const i = yy * w + xx;
            if (xx)
                distance[i] = Math.min(distance[i], distance[i - 1] + 1);
            if (yy) {
                distance[i] = Math.min(distance[i], distance[i - w] + 1);
                if (xx)
                    distance[i] = Math.min(distance[i], distance[i - w - 1] + 1.4142);
                if (xx + 1 < w)
                    distance[i] = Math.min(distance[i], distance[i - w + 1] + 1.4142);
            }
        }
    for (let yy = h - 1; yy >= 0; yy--)
        for (let xx = w - 1; xx >= 0; xx--) {
            const i = yy * w + xx;
            if (xx + 1 < w)
                distance[i] = Math.min(distance[i], distance[i + 1] + 1);
            if (yy + 1 < h) {
                distance[i] = Math.min(distance[i], distance[i + w] + 1);
                if (xx)
                    distance[i] = Math.min(distance[i], distance[i + w - 1] + 1.4142);
                if (xx + 1 < w)
                    distance[i] = Math.min(distance[i], distance[i + w + 1] + 1.4142);
            }
        }
    const { rows } = colorContacts(s, samples), field = new ColoringField(rows, s.size >= 128 ? 6 : 4);
    field.prepare(x, y, w * scale, h * scale);
    const material = new Float64Array(5), seed = s.colorSeed ?? watercolorSeedFor(s.rasterSourceId ?? s.id), sx = (seed & 65535) + 197, sy = (seed >>> 16) + 587, texture = s.textureStrength ?? .7, rgb = s.color.slice(1).match(/../g).map(v => parseInt(v, 16)), fine = Math.max(.8, Math.min(1.6, s.size * .016));
    for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
            const i = yy * w + xx, j = i * 4;
            if (!data[j]) {
                data[j + 3] = 0;
                continue;
            }
            const px = x + xx * scale, py = y + yy * scale;
            field.sample(px, py, material);
            const [along, across, pressure, velocity] = material;
            const patch = paintNoise(sx + along / 23, sy + across / 6), warp = (patch - .5) * 1.7, fiber = paintNoise(sx + 71 + along / 10 + warp, sy + 131 + across / fine - warp * .4), scratch = paintNoise(sx + 307 + along / 5.5, sy + 29 + across / 2.2), dry = clamp(texture + (.65 - velocity) * .22), roughness = Math.min(7, s.size * .045) * dry, rim = clamp(1 - distance[i] * scale / Math.max(2, Math.min(12, s.size * .12))), edge = ease((distance[i] * scale - .3 - roughness * (1 - fiber)) / .85), gaps = ease((fiber - dry * (.055 + rim * .24)) / .11) * ease((scratch - dry * (.04 + rim * .12)) / .11), grain = paintHash(seed + Math.floor(px), Math.floor(py)), load = (s.flow ?? 1) * (s.pressure && s.pressureFlow ? pressure : 1) * (s.pressure && s.pressureOpacity ? opacityResponse(pressure, s) : 1), body = (.91 + .09 * patch) * (1 - dry * .10 * (1 - grain));
            data[j] = rgb[0];
            data[j + 1] = rgb[1];
            data[j + 2] = rgb[2];
            data[j + 3] = Math.round(255 * clamp(edge * gaps * body * load));
        }
}
