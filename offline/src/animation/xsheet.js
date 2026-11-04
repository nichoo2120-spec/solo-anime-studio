/** Phase 2B Xsheet: a sparse, read-only exposure index over the EXISTING cel engine.
 * No art arrays are cloned; only visible rows are materialized for the UI.
 */
import { frameList, frameHold, isLayerHeld } from './timeline.js';
/** O(cels) index, rather than expanding every held exposure into an object. */
export function buildXsheetIndex(project) {
    let next = 1;
    const spans = frameList(project).map((frame, celIndex) => {
        const hold = frameHold(frame), span = { frameId: frame.id, celIndex, start: next, end: next + hold - 1, hold, frame };
        next += hold;
        return span;
    });
    return { spans, total: next - 1 };
}
/** O(log cels) lookup: consistent for frames exposed on 1s, 2s and 3s. */
export function xsheetRowAt(index, exposure) {
    if (!Number.isInteger(exposure) || exposure < 1 || exposure > index.total)
        return null;
    let lo = 0, hi = index.spans.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1, s = index.spans[mid];
        if (exposure < s.start)
            hi = mid - 1;
        else if (exposure > s.end)
            lo = mid + 1;
        else
            return { exposure, frameId: s.frameId, celIndex: s.celIndex, offset: exposure - s.start, hold: s.hold, start: exposure === s.start };
    }
    return null;
}
export function xsheetRows(index, first, last) {
    const rows = [];
    for (let i = Math.max(1, Math.floor(first)); i <= Math.min(index.total, Math.floor(last)); i++) {
        const row = xsheetRowAt(index, i);
        if (row)
            rows.push(row);
    }
    return rows;
}
export function xsheetLayerCell(project, row, layerId) {
    const span = frameList(project)[row.celIndex];
    const held = isLayerHeld(project, layerId, row.frameId);
    const hasArt = !!span?.drawings[layerId]?.length;
    return { held, withinHold: row.offset > 0, hasArt, label: row.offset > 0 ? '·' : held ? '↪' : hasArt ? '●' : '◇' };
}
/** Standard virtual-scroll window keeps DOM row count bounded on lengthy scenes. */
export function xsheetVisibleRange(total, scrollTop, viewportHeight, rowHeight = 28, overscan = 6) {
    const first = Math.max(1, Math.floor(Math.max(0, scrollTop) / rowHeight) + 1 - overscan);
    const count = Math.ceil(Math.max(rowHeight, viewportHeight) / rowHeight) + 2 * overscan;
    return { first, last: Math.min(total, first + count - 1) };
}
/** Memo gate for the vertical UI: painting more strokes on an already nonempty
 * cel does not change any Xsheet symbols, so it must NOT re-render a row grid.
 * Holds, current selection, visibility of a key/blank and all layer tracks remain observable.
 */
export function sameXsheetPresentation(before, after) {
    if (before === after)
        return true;
    if (before.id !== after.id || before.activeLayerId !== after.activeLayerId)
        return false;
    if (before.animation?.activeFrameId !== after.animation?.activeFrameId)
        return false;
    const bf = frameList(before), af = frameList(after);
    if (bf.length !== af.length || before.layers.length !== after.layers.length)
        return false;
    for (let i = 0; i < before.layers.length; i++) {
        const a = before.layers[i], b = after.layers[i];
        if (a.id !== b.id || a.name !== b.name || a.locked !== b.locked)
            return false;
        const oldHeld = before.animation?.layerHolds?.[a.id]?.held ?? [];
        const newHeld = after.animation?.layerHolds?.[a.id]?.held ?? [];
        if (oldHeld !== newHeld && (oldHeld.length !== newHeld.length || oldHeld.some((id, j) => id !== newHeld[j])))
            return false;
    }
    for (let i = 0; i < bf.length; i++) {
        const a = bf[i], b = af[i];
        if (a.id !== b.id || frameHold(a) !== frameHold(b))
            return false;
        if (a.drawings !== b.drawings) {
            for (const layer of after.layers) {
                if (!!a.drawings[layer.id]?.length !== !!b.drawings[layer.id]?.length)
                    return false;
            }
        }
    }
    return true;
}
