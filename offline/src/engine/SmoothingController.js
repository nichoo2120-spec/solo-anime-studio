import { activeLayer, editLayer } from '../core/model.js';
import { intersectsPolygon } from './strokeGeometry.js';
export class SmoothingController {
    store;
    request;
    notify;
    previewLayer;
    revision = 0;
    onChange = () => { };
    constructor(store, request, notify) {
        this.store = store;
        this.request = request;
        this.notify = notify;
    }
    preview(amount, scope, polygon = []) {
        const doc = this.store.getSnapshot(), layer = activeLayer(doc);
        if (layer.locked || !layer.visible || layer.kind === 'vector') {
            this.notify('Select a visible, unlocked raster drawing layer.');
            return;
        }
        let lastTransform = -1;
        layer.operations.forEach((op, i) => { if (op.kind === 'transform')
            lastTransform = i; });
        let ids = layer.operations.filter((op, i) => op.kind === 'stroke' && op.tool === 'brush' && i > lastTransform && (scope === 'last' || polygon.length >= 3 && intersectsPolygon(op.points, polygon))).map(op => op.id);
        if (scope === 'last')
            ids = ids.slice(-1);
        if (!ids.length) {
            this.notify('No eligible strokes selected. Undo a prior raster transform before smoothing its source strokes.');
            return;
        }
        this.revision = this.store.revision;
        this.previewLayer = { ...layer, operations: layer.operations.map(op => op.kind === 'stroke' && ids.includes(op.id) ? { ...op, engineVersion: op.engineVersion === 10 ? 10 : op.engineVersion === 9 ? 9 : op.engineVersion === 8 ? 8 : op.engineVersion === 7 ? 7 : 6, stabilization: (op.engineVersion === 4 || op.engineVersion === 5 || op.engineVersion === 6 || op.engineVersion === 7 || op.engineVersion === 8 || op.engineVersion === 9 || op.engineVersion === 10) ? op.stabilization : 0, smoothness: amount } : op) };
        this.onChange(true);
        this.request();
    }
    apply() { const layer = this.previewLayer; if (!layer)
        return; const valid = this.revision === this.store.revision; this.previewLayer = undefined; this.onChange(false); if (valid)
        this.store.commit(editLayer(this.store.getSnapshot(), layer.id, { operations: layer.operations }), 'Smooth strokes'); this.request(); }
    cancel() { if (this.previewLayer) {
        this.previewLayer = undefined;
        this.onChange(false);
        this.request();
    } }
    documentChanged() { if (this.previewLayer && this.revision !== this.store.revision)
        this.cancel(); }
}
