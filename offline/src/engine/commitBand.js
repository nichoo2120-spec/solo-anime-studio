import { strokeRasterBounds } from './paintCompositing.js';
import { displayCleanInk } from './InkDisplay.js';
const union = (a, b) => { if (!a)
    return { ...b }; const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y }; };
const sameView = (a, b) => a.W === b.W && a.H === b.H && a.dpr === b.dpr && a.x === b.x && a.y === b.y && a.zoom === b.zoom && a.rotation === b.rotation;
/** Track the canvas area a live stroke touched (its frames are bands too). */
export function strokeBand(last, now, dirty, points = Infinity) {
    // The first stroke frame (one dab at most) is a full redraw; that dab lies
    // inside the committed stroke's own raster bounds, so the key survives.
    if (!dirty && points <= 1 && last && last.exact && last.p === now.p && sameView(last, now))
        return last;
    if (!last || !last.exact || !dirty || last.p !== now.p || !sameView(last, now))
        return;
    return { ...last, extra: dirty.width > 0 && dirty.height > 0 ? union(last.extra, dirty) : last.extra };
}
// Brushes whose pixels are fully bounded by strokeRasterBounds. Mix, smudge
// and blend strokes sample neighbours, so they always use a full redraw.
const bounded = (o) => o.kind === 'stroke' && o.nativeMixVersion === undefined && o.smudgeVersion === undefined && !/blend|smudge|mix/i.test(String(o.brushTip ?? '') + ' ' + String(o.brushKind ?? '') + ' ' + String(o.coloringEngine ?? ''));
export function commitBandRegion(last, now) {
    if (!last || !last.exact || !sameView(last, now) || Math.abs(now.rotation) > 1e-9 || last.revision !== now.revision)
        return;
    const a = last.p, b = now.p;
    // Repeat render right after a band frame with nothing new: the screen is
    // already exact, so nothing is repainted (no extra full redraw).
    if (a === b && last.band && !last.extra)
        return { x: 0, y: 0, width: 0, height: 0 };
    if (a === b || a.id !== b.id || a.width !== b.width || a.height !== b.height || a.settings !== b.settings || a.layers.length !== b.layers.length)
        return;
    // Any other project change (camera, frames, size, settings...) means a full redraw.
    for (const k of Object.keys(b))
        if (k !== 'layers' && a[k] !== b[k])
            return;
    for (const k of Object.keys(a))
        if (!(k in b))
            return;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, changed = 0;
    for (let i = 0; i < a.layers.length; i++) {
        const x = a.layers[i], y = b.layers[i];
        if (x === y)
            continue;
        if (x.id !== y.id || x.kind !== y.kind || x.kind === 'vector' || x.visible !== y.visible || x.opacity !== y.opacity || x.blend !== y.blend || x.reference !== y.reference || x.clip !== y.clip)
            return;
        for (const k of Object.keys(y))
            if (k !== 'operations' && k !== 'name' && k !== 'locked' && x[k] !== y[k])
                return;
        for (const k of Object.keys(x))
            if (!(k in y))
                return;
        const [short, long] = x.operations.length <= y.operations.length ? [x.operations, y.operations] : [y.operations, x.operations];
        if (!short.every((o, j) => o === long[j]))
            return;
        // Clean-ink layers use the display-resolution ink surface; keep their full redraw.
        if (long.some(o => o.kind === 'stroke' && displayCleanInk(o)))
            return;
        if (!x.visible)
            continue;
        for (const o of long.slice(short.length)) {
            if (!bounded(o))
                return;
            const r = strokeRasterBounds(o, a.width, a.height);
            left = Math.min(left, r.x);
            top = Math.min(top, r.y);
            right = Math.max(right, r.x + r.width);
            bottom = Math.max(bottom, r.y + r.height);
            changed++;
        }
    }
    if (!changed)
        return;
    const s = now.zoom * now.dpr, pad = 3;
    let band = { x: 0, y: Math.floor((top * now.zoom + now.y) * now.dpr) - pad, width: Math.ceil((right * now.zoom + now.x) * now.dpr) + pad, height: 0 };
    band.height = Math.ceil((bottom * now.zoom + now.y) * now.dpr) + pad - band.y;
    void s;
    if (last.extra)
        band = union(band, last.extra);
    band.x = 0;
    band.y = Math.max(0, band.y);
    band.width = Math.min(now.W, band.width);
    band.height = Math.min(now.H - band.y, band.height);
    if (band.width <= 0 || band.height <= 0)
        return { x: 0, y: 0, width: 0, height: 0 };
    if (band.width * band.height > now.W * now.H * .6)
        return;
    return band;
}
