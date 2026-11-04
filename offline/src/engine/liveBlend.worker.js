import { compositePaintStroke, strokeRasterBounds } from './paintCompositing.js';
import { resetWetSmudgeCaches } from './wetSmudge.js';
import { resetGentleBlend, applyGentleBlend } from './gentleBlend.js';
import { LiveStrokeRaster } from './liveRaster.js';
import { strokeGeometry } from './strokeGeometry.js';
import { finalGeometry } from './geometryCache.js';
import { applyNativeBrushMix } from './nativeBrushMix.js';
Object.defineProperty(globalThis, 'document', { value: { createElement: (tag) => { if (tag !== 'canvas')
            throw Error('Unsupported worker element'); return new OffscreenCanvas(1, 1); } } });
const worker = self;
let token = 0, base, target, region;
let nativeMask;
let nativeStrokeRaster;
const union = (a, b) => { if (!a)
    return b; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }; };
worker.onmessage = async ({ data: j }) => {
    try {
        if (j.kind !== 'update') {
            resetWetSmudgeCaches();
            resetGentleBlend();
            nativeStrokeRaster?.reset();
            nativeStrokeRaster = undefined;
            nativeMask = undefined;
            if (base)
                base.width = base.height = 0;
            if (target)
                target.width = target.height = 0;
            token = j.token;
            region = undefined;
            base = target = undefined;
            if (j.kind === 'begin') {
                base = new OffscreenCanvas(j.width, j.height);
                target = new OffscreenCanvas(j.width, j.height);
                base.getContext('2d', { willReadFrequently: true }).drawImage(j.base, 0, 0);
                target.getContext('2d', { willReadFrequently: true }).drawImage(j.base, 0, 0);
                j.base.close();
            }
            return;
        }
        if (j.token !== token || !base || !target)
            return;
        const s = j.stroke, tc = target.getContext('2d'), bc = base;
        // v3 sends only the new dab rectangle. Previously the entire accumulated
        // stroke was read/transferred on EVERY pointer update, causing long stalls.
        let r;
        if (!!s.nativeMixVersion) {
            if (!nativeMask || nativeMask.width !== target.width || nativeMask.height !== target.height) {
                nativeMask = new OffscreenCanvas(target.width, target.height);
                nativeStrokeRaster = new LiveStrokeRaster();
            }
            // On pen up generate the canonical final brush mask from scratch (off-thread),
            // then replay once against the immutable original layer. The union region
            // also removes provisional pixels that the final fitted geometry no longer covers.
            if (j.final) {
                nativeStrokeRaster.reset();
                nativeMask.width = target.width;
                nativeMask.height = target.height;
                tc.clearRect(0, 0, target.width, target.height);
                tc.drawImage(bc, 0, 0);
            }
            const maskContext = nativeMask.getContext('2d');
            nativeStrokeRaster.paint(maskContext, s, j.final ? finalGeometry(s) : strokeGeometry(s, 'live'));
            const updated = j.final ? strokeRasterBounds(s, target.width, target.height) : nativeStrokeRaster.lastRegion ?? strokeRasterBounds(s, target.width, target.height);
            // Repaint/transfer only the changed tail while the pointer moves. The
            // accumulated union is bookkeeping for the FINAL correction only: the
            // final fitted stroke can shrink outside the last provisional footprint.
            region = union(region, updated);
            r = j.final ? region : updated;
            if (r.width < 1 || r.height < 1)
                r = { x: 0, y: 0, width: 1, height: 1 };
            applyNativeBrushMix(tc, nativeMask, s, 0, 0, r, bc);
        }
        else if (s.smudgeVersion === 3) {
            r = applyGentleBlend(tc, bc, s, 0, 0, { x: 0, y: 0, width: target.width, height: target.height }, bc) ?? { x: 0, y: 0, width: 1, height: 1 };
        }
        else {
            r = region = union(region, s.points.length ? strokeRasterBounds(s, target.width, target.height) : { x: 0, y: 0, width: target.width, height: target.height });
            compositePaintStroke(tc, bc, s, 0, 0, r, bc);
        }
        const bitmap = await createImageBitmap(target, r.x, r.y, r.width, r.height);
        worker.postMessage({ token: j.token, serial: j.serial, bitmap, region: r, final: j.final }, [bitmap]);
    }
    catch (error) {
        worker.postMessage({ token: j.token, serial: j.serial, error: String(error) });
    }
};
