import { activeLayer, appendOperation, editLayer, newLayer, uid } from '../core/model.js';
import { bounds } from '../core/geometry.js';
import { context, makeCanvas, polygonPath } from './renderer.js';
import { rectangle } from './selectionControls.js';
import { vectorCubics } from './vector.js';
import { flattenCubic, intersectsPolygon } from './strokeGeometry.js';
export class EditingController {
    store;
    renderer;
    selection;
    select;
    notify;
    clipboard;
    constructor(store, renderer, selection, select, notify) {
        this.store = store;
        this.renderer = renderer;
        this.selection = selection;
        this.select = select;
        this.notify = notify;
    }
    selectAll() { const p = this.store.getSnapshot(); this.select(rectangle({ x: 0, y: 0, p: 1 }, { x: p.width, y: p.height, p: 1 })); }
    copy(cut = false) {
        const p = this.store.getSnapshot(), layer = activeLayer(p), polygon = this.selection();
        if (polygon.length < 3) {
            this.notify('Select artwork before copying or cutting.');
            return;
        }
        if (cut && (layer.locked || !layer.visible || layer.reference)) {
            this.notify('Unlock and show an artwork layer before cutting.');
            return;
        }
        if (layer.kind === 'vector') {
            const operations = layer.operations.filter(o => o.kind === 'vector' && intersectsPolygon(vectorCubics(o).flatMap(c => flattenCubic(c)), polygon));
            this.clipboard = { kind: 'vector', operations: structuredClone(operations), polygon: structuredClone(polygon) };
            if (cut)
                this.store.commit(editLayer(p, layer.id, { operations: layer.operations.filter(o => !operations.includes(o)) }), 'Cut vector artwork');
        }
        else {
            const b = bounds(polygon), x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y)), w = Math.min(p.width, Math.ceil(b.x + b.w)) - x, h = Math.min(p.height, Math.ceil(b.y + b.h)) - y;
            if (w < 1 || h < 1) {
                this.notify('Selection lies outside the output frame.');
                return;
            }
            const c = makeCanvas(w, h), ctx = context(c);
            ctx.translate(-x, -y);
            polygonPath(ctx, polygon);
            ctx.clip();
            ctx.drawImage(this.renderer().get(layer, p), 0, 0);
            this.clipboard = { kind: 'raster', operations: [{ id: uid(), kind: 'image', png: c.toDataURL(), x, y, width: w, height: h }], polygon: structuredClone(polygon) };
            if (cut)
                this.store.commit(appendOperation(p, { id: uid(), kind: 'clear', polygon: structuredClone(polygon) }), 'Cut artwork');
        }
        this.notify(cut ? 'Artwork cut. Paste retains its document position.' : 'Artwork copied inside this studio.');
    }
    async paste() { if (!this.clipboard) {
        this.notify('Copy artwork in this studio before pasting.');
        return;
    } const p = this.store.getSnapshot(), revision = this.store.revision, current = activeLayer(p); if (current.locked || !current.visible || current.reference) {
        this.notify('Choose an unlocked, visible artwork layer before pasting.');
        return;
    } const kind = this.clipboard.kind, needsLayer = (current.kind ?? 'raster') !== kind; if (needsLayer && p.layers.length >= 100) {
        this.notify('The project already has 100 layers.');
        return;
    } const layer = needsLayer ? newLayer('Pasted artwork', kind) : current, operations = this.clipboard.operations.map(o => ({ ...structuredClone(o), id: uid() })); const next = { ...p, version: 3, layers: needsLayer ? [{ ...layer, operations }, ...p.layers] : p.layers.map(l => l.id === layer.id ? { ...l, operations: [...l.operations, ...operations] } : l), activeLayerId: layer.id }; try {
        await this.renderer().prepare(next);
        if (this.store.revision !== revision) {
            this.notify('Document changed; paste was canceled.');
            return;
        }
        this.store.commit(next, 'Paste artwork');
        this.select(structuredClone(this.clipboard.polygon));
    }
    catch (e) {
        this.notify('Paste failed: ' + String(e));
    } }
    clear() { const p = this.store.getSnapshot(), l = activeLayer(p); if (l.locked || !l.visible) {
        this.notify('Unlock and show the active layer before clearing.');
        return;
    } this.store.commit(editLayer(p, l.id, { operations: [] }), 'Clear layer'); this.select([]); }
    async mergeDown() { const p = this.store.getSnapshot(), index = p.layers.findIndex(l => l.id === p.activeLayerId), top = p.layers[index], bottom = p.layers[index + 1]; if (!bottom) {
        this.notify('There is no layer below this one.');
        return;
    } if (top.locked || bottom.locked || !top.visible || !bottom.visible || top.reference || bottom.reference) {
        this.notify('Merge requires two visible, unlocked artwork layers.');
        return;
    } if ([top, bottom].some(l => l.blend && l.blend !== 'normal')) {
        this.notify('Set both layers to Normal before merging to preserve their appearance against other layers.');
        return;
    } const revision = this.store.revision, c = this.renderer().composite({ ...p, layers: [top, bottom] }, { transparent: true }), merged = { ...bottom, kind: 'raster', opacity: 1, blend: 'normal', operations: [{ id: uid(), kind: 'image', png: c.toDataURL(), x: 0, y: 0, width: p.width, height: p.height }] }, next = { ...p, version: 3, layers: p.layers.filter(l => l.id !== top.id).map(l => l.id === bottom.id ? merged : l), activeLayerId: bottom.id }; try {
        await this.renderer().prepare(next);
        if (this.store.revision !== revision) {
            this.notify('Document changed; merge was canceled.');
            return;
        }
        this.store.commit(next, 'Merge down');
        this.select([]);
    }
    catch (e) {
        this.notify('Merge failed: ' + String(e));
    } }
}
