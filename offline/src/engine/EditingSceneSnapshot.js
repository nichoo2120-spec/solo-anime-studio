import { displayCleanInk } from './InkDisplay.js';
const same = (a, b) => a.projectId === b.projectId && a.pw === b.pw && a.ph === b.ph && a.renderer === b.renderer && a.revision === b.revision && a.width === b.width && a.height === b.height && a.dpr === b.dpr && a.x === b.x && a.y === b.y && a.zoom === b.zoom && a.rotation === b.rotation && a.layers.length === b.layers.length && a.layers.every((l, i) => l === b.layers[i]);
export class EditingSceneSnapshot {
    maxBytes;
    surface;
    key;
    constructor(maxBytes = 96 * 1024 * 1024) {
        this.maxBytes = maxBytes;
    }
    /** Same layer rule as RasterSceneDisplay.group (editing role). */
    group(p, renderer, width, height, dpr, view, stopLayerId) {
        if (width * height * 4 > this.maxBytes || Math.abs(view.rotation) > 1e-9 || typeof document === 'undefined')
            return;
        const layers = [];
        for (let i = p.layers.length - 1; i >= 0; i--) {
            const layer = p.layers[i];
            if (layer.id === stopLayerId)
                break;
            if (!layer.visible || !layer.operations.length)
                continue;
            if (layer.kind === 'vector' || layer.operations.some(op => op.kind === 'vector' || op.kind === 'stroke' && displayCleanInk(op)))
                break;
            layers.push(layer);
        }
        if (!layers.length)
            return;
        return { projectId: p.id, pw: p.width, ph: p.height, layers, renderer, revision: renderer.displayRevision, width, height, dpr, x: view.x, y: view.y, zoom: view.zoom, rotation: view.rotation };
    }
    /** Restore before the page clip. Returns the covered layer ids, or undefined. */
    restore(ctx, key, region) {
        if (!this.surface || !this.key || !same(this.key, key))
            return;
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;
        if (region) {
            if (region.width && region.height) {
                ctx.clearRect(region.x, region.y, region.width, region.height);
                ctx.drawImage(this.surface, region.x, region.y, region.width, region.height, region.x, region.y, region.width, region.height);
            }
        }
        else {
            ctx.clearRect(0, 0, key.width, key.height);
            ctx.drawImage(this.surface, 0, 0);
        }
        ctx.restore();
        return new Set(key.layers.map(l => l.id));
    }
    /** Capture the canonical result. Call only on a full frame, right after the
     * last group layer and before any other layer is drawn. */
    capture(ctx, key) {
        const c = this.surface ??= document.createElement('canvas');
        if (c.width !== key.width)
            c.width = key.width;
        if (c.height !== key.height)
            c.height = key.height;
        const out = c.getContext('2d');
        out.resetTransform();
        out.globalAlpha = 1;
        out.imageSmoothingEnabled = false;
        out.globalCompositeOperation = 'copy';
        out.drawImage(ctx.canvas, 0, 0);
        out.globalCompositeOperation = 'source-over';
        this.key = key;
    }
    invalidate() { this.key = undefined; }
    clear() { this.key = undefined; if (this.surface)
        this.surface.width = this.surface.height = 0; this.surface = undefined; }
    status() { return { ready: !!this.key, bytes: this.surface ? this.surface.width * this.surface.height * 4 : 0 }; }
}
