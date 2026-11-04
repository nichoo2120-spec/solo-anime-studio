import { flattenCubic, pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse, opacityResponse } from './pressureChannels.js';
import { paintPaperGrain, paintPaperGrainRow, paintVariationSeed } from './paintNibsV8.js';
let tile;
const clamp = (n) => Math.max(0, Math.min(1, n));
const isPencil = (kind) => kind.startsWith('graphite-');
export const isDryMediaV9 = (kind) => kind === 'dry-round' || !!kind?.startsWith('graphite-');
/** Noise coverage is anchored to canvas coordinates, not dab number. */
export function dryMediaCoverage(kind, x, y, seed, texture = .7) {
    const fine = paintPaperGrain(x * 2.4, y * 2.4, seed + 71), mid = paintPaperGrain(x * .62, y * .62, seed + 159);
    const coarse = paintPaperGrain(x * .16, y * .16, seed + 251);
    if (isPencil(kind)) {
        // Graphite catches on paper's tooth; harder leads deposit a finer, crisper trace.
        const mechanical = kind === 'graphite-mechanical';
        const base = mechanical ? .78 : kind === 'graphite-2b' ? .93 : .80;
        const tooth = mechanical ? .30 : .53;
        const grain = clamp(base + tooth * (fine - .56) + .23 * (mid - .5));
        return clamp((1 - texture * .42) + texture * .42 * grain) * clamp(grain + .06);
    }
    // Round, fractured bristle footprint; paper valleys and dry paint gaps are
    // irregular islands, never periodic lines following the brush trajectory.
    const islands = .30 * coarse + .45 * mid + .25 * fine;
    const broken = islands < .39 ? .025 : islands < .47 ? .10 : islands < .53 ? .30 : islands < .61 ? .63 : 1;
    return clamp((1 - texture) * .85 + texture * broken) * clamp(.47 + 1.1 * coarse);
}
// Reuse deterministic paper coverage across overlapping live tail repaints.
// At most 16 MiB, discarded when stroke, medium or texture changes.
let coverageKey = '';
const coverageTiles = new Map();
const completeRows = new WeakMap();
function cachedCoverage(kind, x, y, seed, texture) {
    const tx = x >> 6, ty = y >> 6, key = tx + ':' + ty;
    let tile = coverageTiles.get(key);
    if (!tile) {
        if (coverageTiles.size >= 512)
            coverageTiles.delete(coverageTiles.keys().next().value);
        tile = new Float64Array(4096);
        tile.fill(-1);
        coverageTiles.set(key, tile);
    }
    const i = (y & 63) * 64 + (x & 63);
    if (tile[i] < 0)
        tile[i] = dryMediaCoverage(kind, x, y, seed, texture);
    return tile[i];
}
function coverageRow(kind, x, y, seed, texture) {
    const tx = x >> 6, ty = y >> 6, key = tx + ':' + ty;
    let tile = coverageTiles.get(key);
    if (!tile) {
        if (coverageTiles.size >= 512)
            coverageTiles.delete(coverageTiles.keys().next().value);
        tile = new Float64Array(4096);
        tile.fill(-1);
        coverageTiles.set(key, tile);
    }
    const start = (y & 63) * 64, rows = completeRows.get(tile) ?? new Uint8Array(64);
    completeRows.set(tile, rows);
    if (!rows[y & 63]) {
        const fine = paintPaperGrainRow(tx * 64, y, 64, seed + 71, 2.4), mid = paintPaperGrainRow(tx * 64, y, 64, seed + 159, .62), coarse = paintPaperGrainRow(tx * 64, y, 64, seed + 251, .16);
        for (let i = 0; i < 64; i++) {
            if (isPencil(kind)) {
                const mechanical = kind === 'graphite-mechanical', base = mechanical ? .78 : kind === 'graphite-2b' ? .93 : .80, tooth = mechanical ? .30 : .53;
                const grain = clamp(base + tooth * (fine[i] - .56) + .23 * (mid[i] - .5));
                tile[start + i] = clamp((1 - texture * .42) + texture * .42 * grain) * clamp(grain + .06);
            }
            else {
                const islands = .30 * coarse[i] + .45 * mid[i] + .25 * fine[i], broken = islands < .39 ? .025 : islands < .47 ? .10 : islands < .53 ? .30 : islands < .61 ? .63 : 1;
                tile[start + i] = clamp((1 - texture) * .85 + texture * broken) * clamp(.47 + 1.1 * coarse[i]);
            }
        }
        rows[y & 63] = 1;
    }
    return tile;
}
export function drawDryMediaV9(ctx, stroke, geometry, region, pass) {
    const kind = stroke.brushKind ?? 'graphite-hb', pencil = isPencil(kind);
    const points = pass?.samples.points ?? (geometry.cubics.length ? geometry.cubics.flatMap((c, i) => flattenCubic(c, pencil ? .5 : .8).slice(i ? 1 : 0)) : geometry.points);
    if (!points.length)
        return;
    const anchored = stroke.paintNibVersion === 1 || !!pass, pad = Math.ceil(stroke.size * (stroke.paintNibVersion === 1 ? .5 : 1) + 6);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const x = Math.max(0, Math.floor(Math.max(minX - pad, region?.x ?? 0))), y = Math.max(0, Math.floor(Math.max(minY - pad, region?.y ?? 0)));
    const right = Math.min(ctx.canvas.width, Math.ceil(Math.min(maxX + pad, region ? region.x + region.width : ctx.canvas.width)));
    const bottom = Math.min(ctx.canvas.height, Math.ceil(Math.min(maxY + pad, region ? region.y + region.height : ctx.canvas.height)));
    const w = right - x, h = bottom - y;
    if (w <= 0 || h <= 0)
        return;
    const W = anchored ? ctx.canvas.width : w, H = anchored ? ctx.canvas.height : h, ox = anchored ? x : 0, oy = anchored ? y : 0;
    const surface = pass?.mask ?? (tile ??= document.createElement('canvas'));
    if (surface.width !== W)
        surface.width = W;
    if (surface.height !== H)
        surface.height = H;
    const mc = surface.getContext('2d', { willReadFrequently: true });
    mc.save();
    mc.globalAlpha = 1;
    mc.globalCompositeOperation = 'source-over';
    if (!pass?.append) {
        if (pass?.base)
            mc.drawImage(pass.base, ox, oy, w, h, ox, oy, w, h);
        else {
            mc.fillStyle = '#000';
            mc.fillRect(ox, oy, w, h);
        }
    }
    // New paint strokes use a fixed canvas origin. Cropping native round paths to
    // a moving scratch edge can change their antialiasing between live and final.
    if (!anchored) {
        mc.beginPath();
        mc.rect(0, 0, w, h);
        mc.clip();
        mc.translate(-x, -y);
    }
    mc.globalCompositeOperation = 'lighten';
    let total = pass?.samples.total ?? 0;
    if (!pass)
        for (let i = 1; i < points.length; i++)
            total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const seed = paintVariationSeed(stroke.id), size = stroke.size;
    let along = pass ? pass.samples.arc[Math.max(0, pass.from - 1)] ?? 0 : 0;
    const at = (p, length) => {
        const response = stroke.pressure ? pressureResponse(Math.pow(p.p, stroke.response), stroke.pressureCurve) : 1;
        const velocity = stroke.velocityTaper ? p.v ?? 1 : 1;
        const factor = stroke.pressure && stroke.pressureWidth !== false || stroke.velocityTaper ? widthResponse(response * velocity, stroke) : 1;
        const taper = taperFactor(length, total, stroke.taperStart, stroke.taperEnd, Math.max(64, size * 12));
        const opacity = stroke.pressure && stroke.pressureOpacity ? opacityResponse(response, stroke) : 1;
        return { radius: Math.max(.08, size * .5 * factor * taper), density: clamp(opacity) };
    };
    if (points.length === 1) {
        const p = points[0], r = at(p, 0);
        mc.fillStyle = `rgb(${Math.round(255 * r.density)},${Math.round(255 * r.density)},${Math.round(255 * r.density)})`;
        mc.beginPath();
        mc.arc(p.x, p.y, r.radius, 0, Math.PI * 2);
        mc.fill();
    }
    else {
        for (let i = Math.max(1, pass?.from ?? 1); i < (pass?.to ?? points.length); i++) {
            const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length < .001)
                continue;
            if (Math.max(a.x, b.x) < x - pad || Math.min(a.x, b.x) > right + pad || Math.max(a.y, b.y) < y - pad || Math.min(a.y, b.y) > bottom + pad) {
                along += length;
                continue;
            }
            const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2, v: ((a.v ?? 1) + (b.v ?? 1)) / 2 }, brush = at(m, along + length / 2);
            // Native round caps provide a continuous round dry-brush mark without seams.
            const intensity = Math.round(255 * brush.density);
            mc.strokeStyle = `rgb(${intensity},${intensity},${intensity})`;
            mc.lineCap = 'round';
            mc.lineJoin = 'round';
            mc.lineWidth = Math.max(.15, 2 * brush.radius);
            mc.beginPath();
            mc.moveTo(a.x, a.y);
            mc.lineTo(b.x, b.y);
            mc.stroke();
            along += length;
        }
    }
    mc.restore();
    if (pass?.append)
        return;
    const img = mc.getImageData(ox, oy, w, h), data = img.data;
    const rr = parseInt(stroke.color.slice(1, 3), 16), gg = parseInt(stroke.color.slice(3, 5), 16), bb = parseInt(stroke.color.slice(5, 7), 16);
    const strength = clamp(stroke.textureStrength ?? (pencil ? .5 : .9));
    const key = stroke.id + ':' + kind + ':' + strength;
    if (key !== coverageKey) {
        coverageKey = key;
        coverageTiles.clear();
    }
    for (let row = 0; row < h; row++) {
        let coverage, chunk = -1;
        for (let col = 0; col < w; col++) {
            const i = (row * w + col) * 4, m = data[i];
            if (m < 1) {
                data[i + 3] = 0;
                continue;
            }
            const px = x + col, py = y + row;
            if (size >= 32 && (px >> 6) !== chunk) {
                coverage = coverageRow(kind, px, py, seed, strength);
                chunk = px >> 6;
            }
            const grain = coverage ? coverage[(py & 63) * 64 + (px & 63)] : cachedCoverage(kind, px, py, seed, strength);
            // A lightly scattered graphite line; a stronger deposition at high pressure.
            const density = pencil ? (kind === 'graphite-2b' ? .98 : kind === 'graphite-mechanical' ? .88 : .92) : .98;
            data[i] = rr;
            data[i + 1] = gg;
            data[i + 2] = bb;
            data[i + 3] = Math.round(255 * clamp(m / 255 * grain * density));
        }
    }
    mc.putImageData(img, ox, oy);
    ctx.drawImage(surface, ox, oy, w, h, x, y, w, h);
}
