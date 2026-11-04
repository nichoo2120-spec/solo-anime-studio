import { drawDryBristleV3 } from './dryBristleV3.js';
import { drawDryBristleV2 } from './dryBristleV2.js';
import { drawDryBristle } from './dryBristle.js';
import { drawColoring } from './coloringStroke.js';
import { drawNaturalWatercolor } from './watercolorNatural.js';
import { drawWatercolorSweep } from './watercolorSweep.js';
import { finishPaper } from './watercolorV2.js';
import { pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse, opacityResponse } from './pressureChannels.js';
import { paintSamples } from './paintPass.js';
import { paintingNib, mixedNib, erodePaintingGrain, paintHash } from './paintingTips.js';
import { finishWatercolor } from './watercolorFinish.js';
let pooled, colorSurface;
const cache = new WeakMap();
let previous;
/** Flow is deposition per 10% of a diameter travelled. Normalizing it by
 * spacing keeps a lower spacing from unexpectedly making paint much darker. */
export function deposition(flow, step, diameter) { return flow <= 0 ? 0 : flow >= 1 ? 1 : 1 - Math.pow(1 - flow, step / Math.max(.025, diameter * .1)); }
export function drawPainting(ctx, s, g, region, pass) {
    if (s.dryBristleVersion === 3)
        return drawDryBristleV3(ctx, s, g, region, pass);
    if (s.dryBristleVersion === 2)
        return drawDryBristleV2(ctx, s, g, region, pass);
    if (s.dryBristleVersion === 1)
        return drawDryBristle(ctx, s, g, region, pass);
    if (s.coloringEngine === 1) {
        drawColoring(ctx, s, g, region, pass);
        return;
    }
    if (s.watercolorEngine === 1) {
        drawNaturalWatercolor(ctx, s, g, region, pass);
        return;
    }
    if (s.watercolorVersion === 3) {
        drawWatercolorSweep(ctx, s, g, region, pass);
        return;
    }
    const tip = s.brushTip;
    if (!tip || tip === 'round')
        return;
    const samples = pass?.samples ?? paintSamples(g, .18), points = samples.points;
    if (!points.length)
        return;
    const pad = Math.ceil(s.size * .76 + 4);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const x = Math.max(0, Math.floor(Math.max(minX - pad, region?.x ?? 0))), y = Math.max(0, Math.floor(Math.max(minY - pad, region?.y ?? 0))), right = Math.min(ctx.canvas.width, Math.ceil(Math.min(maxX + pad, region ? region.x + region.width : ctx.canvas.width))), bottom = Math.min(ctx.canvas.height, Math.ceil(Math.min(maxY + pad, region ? region.y + region.height : ctx.canvas.height))), w = right - x, h = bottom - y;
    if (w <= 0 || h <= 0)
        return;
    const key = JSON.stringify({ ...s, points: undefined, mixStops: undefined });
    let ready = cache.get(samples);
    if (!ready || ready.key !== key) {
        let dabs = [], next = 0, startIndex = 1;
        if (pass && previous?.key === key && samples.total >= .5 && previous.samples.total >= .5) {
            const old = previous.samples;
            let prefix = 0;
            while (prefix < Math.min(points.length, old.points.length)) {
                const a = points[prefix], b = old.points[prefix];
                if (a.x !== b.x || a.y !== b.y || a.p !== b.p || a.v !== b.v)
                    break;
                prefix++;
            }
            const endSpan = Math.max(64, s.size * 12) * (s.taperEnd ?? 0), stable = Math.min(samples.arc[prefix - 1] ?? 0, old.arc[prefix - 1] ?? 0, samples.total - endSpan, old.total - endSpan);
            let count = 0;
            while (count < previous.dabs.length && previous.dabs[count].distance < stable - 1e-7)
                count++;
            dabs = previous.dabs.slice(0, count);
            const last = dabs.at(-1);
            if (last) {
                next = last.distance + last.step;
                startIndex = Math.max(1, last.index);
            }
        }
        const channels = (p, d) => { const value = s.pressure ? pressureResponse(Math.pow(p.p, s.response), s.pressureCurve) : 1, width = (s.pressure && s.pressureWidth !== false || s.velocityTaper) ? widthResponse(value * (s.velocityTaper ? p.v ?? 1 : 1), s) : 1, radius = s.size * .5 * width * taperFactor(d, samples.total, s.taperStart, s.taperEnd, Math.max(64, s.size * 12)), flow = (s.flow ?? .5) * (s.pressure && s.pressureFlow ? value : 1) * (s.pressure && s.pressureOpacity ? opacityResponse(value, s) : 1); return { radius, flow, step: Math.max(.25, radius * 2 * (s.tipSpacing ?? .05)) }; };
        if (points.length === 1)
            dabs.push({ point: points[0], distance: 0, index: 0, ...channels(points[0], 0) });
        for (let i = startIndex; i < points.length; i++) {
            const a = points[i - 1], b = points[i], start = samples.arc[i - 1], length = samples.arc[i] - start;
            if (length < .00001)
                continue;
            while (next <= samples.arc[i] + 1e-7) {
                const t = Math.max(0, Math.min(1, (next - start) / length)), point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, v: (a.v ?? 1) + ((b.v ?? 1) - (a.v ?? 1)) * t }, value = channels(point, next);
                dabs.push({ point, distance: next, index: next === 0 ? 0 : i, ...value });
                next += value.step;
            }
        }
        const last = dabs.at(-1), point = points.at(-1);
        let end;
        if (last && samples.total - last.distance > 1e-6)
            end = { point, distance: samples.total, index: points.length - 1, ...channels(point, samples.total), step: Math.min(last.step, samples.total - last.distance) };
        ready = { key, dabs, tip: end };
        cache.set(samples, ready);
        if (pass)
            previous = { key, samples, dabs };
    }
    const mask = pass?.mask ?? (pooled ??= document.createElement('canvas'));
    if (mask.width !== ctx.canvas.width)
        mask.width = ctx.canvas.width;
    if (mask.height !== ctx.canvas.height)
        mask.height = ctx.canvas.height;
    const mc = mask.getContext('2d');
    mc.save();
    mc.globalAlpha = 1;
    mc.globalCompositeOperation = 'source-over';
    if (!pass?.append) {
        if (!!s.watercolorVersion && !region)
            mc.clearRect(0, 0, mask.width, mask.height);
        else
            mc.clearRect(x, y, w, h);
        if (pass?.base)
            mc.drawImage(pass.base, x, y, w, h, x, y, w, h);
    }
    const texture = s.textureStrength ?? 0, hardness = s.hardness ?? .7, angle = (s.tipAngle ?? 0) * Math.PI / 180, mixA = s.mixTipA, mixB = s.mixTipB, mixT = s.mixBlend;
    const draw = (dab) => { const { point: p, distance: d, radius, flow, step } = dab; if (radius < .001 || flow <= 0 || p.x < x - pad || p.x > right + pad || p.y < y - pad || p.y > bottom + pad)
        return; const variant = !!s.watercolorVersion || tip === 'soft-round' || tip === 'felt' ? 0 : Math.floor(paintHash(Math.floor(d / Math.max(1, s.size * .65)), 17) * 8), nib = (mixA && mixB && typeof mixT === 'number' && mixT > 0.01 && mixT < 0.99) ? mixedNib(mixA, mixB, mixT, hardness, texture, variant, angle) : paintingNib(tip, hardness, texture, variant, angle, !!s.watercolorVersion), diameter = radius * 2; mc.globalAlpha = deposition(flow, step, diameter); mc.drawImage(nib.canvas, p.x + nib.x * diameter, p.y + nib.y * diameter, nib.w * diameter, nib.h * diameter); };
    for (const dab of ready.dabs)
        if (dab.index >= (pass?.from ?? 0) && dab.index < (pass?.to ?? points.length))
            draw(dab);
    // A partially travelled last interval follows the contact without getting
    // stamped a second time into settled coverage at the next display update.
    if (!pass?.append && ready.tip)
        draw(ready.tip);
    mc.restore();
    if (pass?.append)
        return;
    if (!!s.watercolorVersion) {
        finishWatercolor(ctx, s, mask, x, y, w, h);
        if (s.watercolorVersion === 2)
            finishPaper(ctx, s, x, y, w, h);
        return;
    }
    const color = colorSurface ??= document.createElement('canvas');
    if (color.width !== w)
        color.width = w;
    if (color.height !== h)
        color.height = h;
    const cc = color.getContext('2d');
    cc.save();
    cc.clearRect(0, 0, w, h);
    cc.drawImage(mask, x, y, w, h, 0, 0, w, h);
    cc.globalCompositeOperation = 'source-in';
    cc.fillStyle = s.color;
    cc.fillRect(0, 0, w, h);
    cc.globalCompositeOperation = 'source-over';
    erodePaintingGrain(cc, tip, texture, x, y, w, h);
    cc.restore();
    ctx.drawImage(color, 0, 0, w, h, x, y, w, h);
}
