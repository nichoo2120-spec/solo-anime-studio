import { resetDryBristleV3Surface } from './dryBristleV3.js';
import { resetDryBristleV2Surface } from './dryBristleV2.js';
import { dryLiftSpan, dryRasterPadding } from '../core/dryBrush.js';
import { paintSamples } from './paintPass.js';
import { drawPainting } from './painting.js';
const samePoint = (a, b) => a.x === b.x && a.y === b.y && a.p === b.p && a.v === b.v;
const sameCurve = (a, b) => samePoint(a.a, b.a) && samePoint(a.c1, b.c1) && samePoint(a.c2, b.c2) && samePoint(a.b, b.b);
/** Transparent deposition masks belong only to version 2 Paint. Older opaque
 * maximum-coverage masks retain their existing renderer and context format. */
export class LivePaintingRaster {
    key = '';
    old;
    settled;
    mask;
    settledCurves = 0;
    lastRegion;
    reset() { this.key = ''; this.old = undefined; this.lastRegion = undefined; this.settledCurves = 0; for (const c of [this.mask, this.settled])
        if (c)
            c.width = c.height = 0; this.mask = this.settled = undefined; }
    paint(ctx, s, g) {
        const key = JSON.stringify({ ...s, points: undefined, mixStops: undefined }), old = this.old, curves = g.cubics;
        let prefix = 0;
        if (this.key === key && old?.cubics.length && curves.length) {
            while (prefix < Math.min(old.cubics.length, curves.length) && sameCurve(old.cubics[prefix], curves[prefix]))
                prefix++;
            const endLength = Math.max(Math.max(64, s.size * 12) * (s.taperEnd ?? 0), (s.dryBristleVersion === 1 || s.dryBristleVersion === 2 || s.dryBristleVersion === 3) ? dryLiftSpan(s) : 0);
            for (const list of [old.cubics, curves]) {
                let i = list.length, travel = 0;
                while (i > 0 && travel < endLength) {
                    i--;
                    travel += Math.hypot(list[i].b.x - list[i].a.x, list[i].b.y - list[i].a.y);
                }
                prefix = Math.min(prefix, i);
            }
            if (old.cubics.reduce((n, c) => n + Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y), 0) < .5)
                prefix = 0;
        }
        let region;
        if (prefix && old) {
            const pad = (s.dryBristleVersion === 1 || s.dryBristleVersion === 2 || s.dryBristleVersion === 3) ? dryRasterPadding(s) : s.watercolorShape && s.brushTip === 'water-wet' ? s.size * .9 + 12 : s.size * .76 + 4;
            let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
            for (const c of [...old.cubics.slice(prefix), ...curves.slice(prefix)])
                for (const p of [c.a, c.c1, c.c2, c.b]) {
                    left = Math.min(left, p.x);
                    top = Math.min(top, p.y);
                    right = Math.max(right, p.x);
                    bottom = Math.max(bottom, p.y);
                }
            const x = Math.max(0, Math.floor(left - pad)), y = Math.max(0, Math.floor(top - pad));
            region = { x, y, width: Math.max(0, Math.min(ctx.canvas.width, Math.ceil(right + pad)) - x), height: Math.max(0, Math.min(ctx.canvas.height, Math.ceil(bottom + pad)) - y) };
        }
        // These smudges deposit pigment directly into their own work surface. Their
        // transparent mask is deliberately unused by compositePaintStroke; allocating
        // and repainting two full-page masks here only stalls the first pen contact.
        if (s.coloringEngine === 1 && s.coloringAppearanceVersion === 3 && s.brushTip === 'color-blender' && s.tool !== 'eraser') {
            if (this.key !== key)
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            this.key = key;
            this.old = g;
            this.lastRegion = region;
            return region ? region.width * region.height : 0;
        }
        const base = this.settled ??= document.createElement('canvas'), mask = this.mask ??= document.createElement('canvas');
        if (this.key !== key || prefix < this.settledCurves || base.width !== ctx.canvas.width || base.height !== ctx.canvas.height) {
            base.width = ctx.canvas.width;
            base.height = ctx.canvas.height;
            if (s.dryBristleVersion === 2)
                resetDryBristleV2Surface(base);
            if (s.dryBristleVersion === 3)
                resetDryBristleV3Surface(base);
            if (s.coloringEngine === 1 || s.watercolorVersion === 3 || s.watercolorEngine === 1) {
                const bc = base.getContext('2d');
                bc.fillStyle = '#000';
                bc.fillRect(0, 0, base.width, base.height);
            }
            this.settledCurves = 0;
        }
        if (mask.width !== ctx.canvas.width)
            mask.width = ctx.canvas.width;
        if (mask.height !== ctx.canvas.height)
            mask.height = ctx.canvas.height;
        const samples = paintSamples(g, .18), end = (n) => n ? samples.ends[n - 1] : 0;
        if (prefix > this.settledCurves) {
            drawPainting(ctx, s, g, undefined, { samples, from: end(this.settledCurves), to: end(prefix), mask: base, append: true });
            this.settledCurves = prefix;
        }
        if ((s.dryBristleVersion === 1 || s.dryBristleVersion === 2 || s.dryBristleVersion === 3)) {
            if (this.key !== key)
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        else if (region)
            ctx.clearRect(region.x, region.y, region.width, region.height);
        else
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const painted = (!region || region.width && region.height) ? drawPainting(ctx, s, g, region, { samples, from: end(this.settledCurves), to: samples.points.length, mask, base }) : undefined;
        this.key = key;
        this.old = g;
        this.lastRegion = (s.dryBristleVersion === 1 || s.dryBristleVersion === 2 || s.dryBristleVersion === 3) ? painted ?? region : region;
        return this.lastRegion ? this.lastRegion.width * this.lastRegion.height : ctx.canvas.width * ctx.canvas.height;
    }
}
