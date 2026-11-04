import { paintHash, paintNoise } from './paintingTips.js';
import { WATER_TILE } from './watercolorPaper.js';
const materials = {
    wash: { id: 'wash', mass: .94, variance: .28, sediment: .14, paperGain: 1.25, retention: .34, edge: .45, spread: 1.3, feather: .05, softness: .10, backrun: 0, directional: 0 },
    round: { id: 'round', mass: 1, variance: .28, sediment: .30, paperGain: 1.8, retention: .50, edge: .8, spread: .7, feather: .022, softness: .075, backrun: 0, directional: 0 },
    dagger: { id: 'dagger', mass: 1.02, variance: .24, sediment: .26, paperGain: 2.1, retention: .42, edge: .65, spread: .36, feather: .012, softness: .05, backrun: 0, directional: .65 },
    cats: { id: 'cats', mass: .99, variance: .34, sediment: .35, paperGain: 1.95, retention: .44, edge: .55, spread: 1, feather: .04, softness: .10, backrun: 0, directional: .15 },
    liner: { id: 'liner', mass: .98, variance: .12, sediment: .15, paperGain: 1.9, retention: .22, edge: .35, spread: .15, feather: .012, softness: .025, backrun: 0, directional: .2 },
    paper: { id: 'paper', mass: 1.06, variance: .24, sediment: .50, paperGain: 1.6, retention: .60, edge: .6, spread: .72, feather: .02, softness: .065, backrun: 0, directional: 0 },
    dry: { id: 'dry', mass: 1.08, variance: .18, sediment: .24, paperGain: 1.6, retention: .20, edge: .22, spread: .12, feather: .008, softness: .025, backrun: 0, directional: 1 },
    bloom: { id: 'bloom', mass: .96, variance: .38, sediment: .27, paperGain: .8, retention: .34, edge: .38, spread: 2, feather: .10, softness: .20, backrun: 1, directional: 0 },
};
export function watercolorMaterial(s) {
    if (s.watercolorStyle)
        return materials[s.watercolorStyle];
    return s.brushTip === 'wash-flat' ? materials.wash : s.brushTip === 'wash-dagger' ? materials.dagger : s.brushTip === 'wash-cats-tongue' ? materials.cats : s.brushTip === 'wash-liner' ? materials.liner : materials.round;
}
export const waterSmooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const paperFields = new Map(), blooms = new Map();
/** Paper valleys, pigment aggregates and micro-tooth share fixed document
 * coordinates. Only water/bloom fronts use the seed captured with the stroke. */
export function materialPaperField(tx, ty) {
    const key = tx + ':' + ty, old = paperFields.get(key);
    if (old) {
        paperFields.delete(key);
        paperFields.set(key, old);
        return old;
    }
    const stride = WATER_TILE / 2 + 1, grid = new Float32Array(stride * stride * 2), data = new Uint8Array(WATER_TILE * WATER_TILE * 4);
    for (let y = 0; y < stride; y++)
        for (let x = 0; x < stride; x++) {
            const wx = tx * WATER_TILE + x * 2, wy = ty * WATER_TILE + y * 2, k = (y * stride + x) * 2;
            grid[k] = paintNoise(wx * .37 + wy * .12 + 19, wy * .41 - wx * .13 + 73);
            grid[k + 1] = .65 * paintNoise(wx * .085 + wy * .023 + 103, wy * .091 - wx * .019 + 37) + .35 * paintNoise(wx * .19 - wy * .07 + 59, wy * .17 + wx * .04 + 29);
        }
    for (let y = 0; y < WATER_TILE; y++)
        for (let x = 0; x < WATER_TILE; x++) {
            const gx = x >>> 1, gy = y >>> 1, u = (x & 1) * .5, v = (y & 1) * .5, k = (gy * stride + gx) * 2, j = (y * WATER_TILE + x) * 4;
            for (let c = 0; c < 2; c++)
                data[j + c] = Math.round(255 * ((grid[k + c] * (1 - u) + grid[k + 2 + c] * u) * (1 - v) + (grid[k + stride * 2 + c] * (1 - u) + grid[k + stride * 2 + 2 + c] * u) * v));
            data[j + 2] = Math.round(255 * paintHash(tx * WATER_TILE + x, ty * WATER_TILE + y));
            data[j + 3] = 255;
        }
    paperFields.set(key, data);
    if (paperFields.size > 48)
        paperFields.delete(paperFields.keys().next().value);
    return data;
}
export function materialBloomField(tx, ty, seed) {
    const key = [tx, ty, seed].join(':'), old = blooms.get(key);
    if (old) {
        blooms.delete(key);
        blooms.set(key, old);
        return old;
    }
    const stride = WATER_TILE / 4 + 1, grid = new Float32Array(stride * stride), data = new Uint8Array(WATER_TILE * WATER_TILE), dx = (seed & 4095) * 8, dy = ((seed >>> 12) & 4095) * 8;
    for (let y = 0; y < stride; y++)
        for (let x = 0; x < stride; x++) {
            const wx = tx * WATER_TILE + x * 4 + dx, wy = ty * WATER_TILE + y * 4 + dy;
            grid[y * stride + x] = .65 * paintNoise(wx * .022 + wy * .011 + 67, wy * .025 - wx * .009 + 47) + .35 * paintNoise(wx * .059 - wy * .017 + 31, wy * .053 + wx * .013 + 113);
        }
    for (let y = 0; y < WATER_TILE; y++)
        for (let x = 0; x < WATER_TILE; x++) {
            const gx = x >>> 2, gy = y >>> 2, u = (x & 3) * .25, v = (y & 3) * .25, k = gy * stride + gx;
            data[y * WATER_TILE + x] = Math.round(255 * ((grid[k] * (1 - u) + grid[k + 1] * u) * (1 - v) + (grid[k + stride] * (1 - u) + grid[k + stride + 1] * u) * v));
        }
    blooms.set(key, data);
    if (blooms.size > 48)
        blooms.delete(blooms.keys().next().value);
    return data;
}
export function materialDensity(m, pool, sediment, cloud, pooling = 1) {
    let density = .84 + (pool - .5) * m.variance + (sediment - .5) * m.sediment * 2;
    if (m.backrun) {
        const front = cloud + (sediment - .5) * .09, water = waterSmooth(.49, .64, front), ridge = Math.max(0, 1 - Math.abs(front - .515) / .045);
        density = density * (1 - water * .36) + ridge * ridge * .19 * pooling * waterSmooth(.32, .72, pool);
    }
    return Math.max(.18, Math.min(1.35, density));
}
const nativePapers = new Map();
let deposit;
function paperTile(tx, ty, m, angle, natural = false) {
    const key = [tx, ty, natural ? 'natural-paper' : m.id, natural ? 0 : m.directional ? angle : 0].join(':'), old = nativePapers.get(key);
    if (old) {
        nativePapers.delete(key);
        nativePapers.set(key, old);
        return old;
    }
    const field = materialPaperField(tx, ty), a = document.createElement('canvas'), b = document.createElement('canvas');
    a.width = a.height = b.width = b.height = WATER_TILE;
    const ac = a.getContext('2d'), bc = b.getContext('2d'), ad = ac.createImageData(WATER_TILE, WATER_TILE), bd = bc.createImageData(WATER_TILE, WATER_TILE), co = Math.cos(angle), si = Math.sin(angle);
    for (let y = 0; y < WATER_TILE; y++)
        for (let x = 0; x < WATER_TILE; x++) {
            const j = (y * WATER_TILE + x) * 4, tooth = field[j] / 255, cluster = field[j + 1] / 255, micro = field[j + 2] / 255, wx = tx * WATER_TILE + x, wy = ty * WATER_TILE + y;
            const fiber = m.directional && !natural ? paintNoise((wx * co + wy * si) * .065 + 53, (-wx * si + wy * co) * .34 + 79) : tooth;
            const grain = tooth * (1 - m.directional * .7) + fiber * m.directional * .7;
            let absorption = .06 + .58 * waterSmooth(.27, .78, grain) + micro * .13, retention = (1 - tooth) ** 2 * (.4 + .6 * cluster);
            if (m.id === 'paper') {
                absorption = .05 + .65 * waterSmooth(.23, .75, tooth) + micro * .1;
                retention = (1 - tooth) ** 1.4 * (.5 + .5 * cluster);
            }
            if (m.id === 'dry') {
                const gaps = waterSmooth(.42, .69, .55 * fiber + .3 * tooth + .15 * cluster);
                absorption = Math.min(1, gaps * 1.45);
                retention *= 1 - gaps;
            }
            if (m.id === 'liner') {
                absorption *= .55;
                retention *= .65;
            }
            // New pigment uses a moving stroke carrier. Paper only contributes fine tooth.
            if (natural) {
                absorption = .08 + .40 * waterSmooth(.28, .78, tooth) + micro * .10;
                retention = (1 - tooth) ** 2 * .5;
            }
            ad.data[j + 3] = Math.round(255 * Math.min(1, absorption));
            bd.data[j + 3] = Math.round(255 * (1 - retention));
        }
    ac.putImageData(ad, 0, 0);
    bc.putImageData(bd, 0, 0);
    const result = { absorb: a, retentionInverse: b };
    nativePapers.set(key, result);
    if (nativePapers.size > 32) {
        const first = nativePapers.keys().next().value, entry = nativePapers.get(first);
        entry.absorb.width = entry.retentionInverse.width = 0;
        nativePapers.delete(first);
    }
    return result;
}
/** Redistribution follows paper topography: exposed ridges lose pigment,
 * valleys retain extra pigment. Native pixels stay independent of water-grid
 * resolution and brush diameter. Both passes are clipped to existing coverage. */
export function finishMaterialPaper(ctx, s, x, y, w, h) {
    const m = watercolorMaterial(s), natural = s.watercolorMaterialVersion === 2, strength = Math.min(1, (s.textureStrength ?? 0) * m.paperGain * (natural ? (m.id === 'paper' ? .9 : m.id === 'dry' ? .45 : .4) : 1));
    if (!strength)
        return;
    const angle = (s.tipAngle ?? 0) * Math.PI / 180, matrix = ctx.getTransform(), corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, b]) => ({ x: matrix.a * a + matrix.c * b + matrix.e, y: matrix.b * a + matrix.d * b + matrix.f }));
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)))), top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)))), right = Math.min(ctx.canvas.width, Math.ceil(Math.max(...corners.map(p => p.x)))), bottom = Math.min(ctx.canvas.height, Math.ceil(Math.max(...corners.map(p => p.y))));
    if (right <= left || bottom <= top)
        return;
    const c = deposit ??= document.createElement('canvas');
    if (c.width !== right - left)
        c.width = right - left;
    if (c.height !== bottom - top)
        c.height = bottom - top;
    const dc = c.getContext('2d');
    dc.save();
    dc.resetTransform();
    dc.clearRect(0, 0, c.width, c.height);
    dc.drawImage(ctx.canvas, left, top, c.width, c.height, 0, 0, c.width, c.height);
    dc.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - left, matrix.f - top);
    dc.beginPath();
    dc.rect(x, y, w, h);
    dc.clip();
    dc.globalCompositeOperation = 'destination-out';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = strength;
    for (let ty = Math.floor(y / WATER_TILE); ty * WATER_TILE < y + h; ty++)
        for (let tx = Math.floor(x / WATER_TILE); tx * WATER_TILE < x + w; tx++) {
            const tile = paperTile(tx, ty, m, angle, natural);
            ctx.drawImage(tile.absorb, tx * WATER_TILE, ty * WATER_TILE);
            dc.drawImage(tile.retentionInverse, tx * WATER_TILE, ty * WATER_TILE);
        }
    dc.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = strength * m.retention;
    ctx.resetTransform();
    ctx.drawImage(c, left, top);
    ctx.restore();
}
