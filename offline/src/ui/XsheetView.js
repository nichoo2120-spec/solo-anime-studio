import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useEffect, useMemo, useRef, useState } from '../../react.js';
import { buildXsheetIndex, xsheetLayerCell, xsheetRows, xsheetVisibleRange, sameXsheetPresentation } from '../animation/xsheet.js';
import { currentFrameIndex, frameHold, MAX_FRAME_HOLD } from '../animation/timeline.js';
const ROW_HEIGHT = 28;
const MIN_WINDOW_HEIGHT = 80;
/** Vertical alternative view; preserves existing Timeline as the canonical editor.
 * Each rendered row is one EXPOSURE, not one copy of artwork.
 */
export const XsheetView = memo(function XsheetView({ project, selectedFrameIds, selectedLayerIds, busy, playbackExposure, onSelect, onHoldChange, onMakeKey }) {
    const scroller = useRef(null);
    const raf = useRef(null);
    const [viewport, setViewport] = useState({ top: 0, height: 220 });
    const frames = project.animation?.frames;
    const holds = frames?.map(frame => frameHold(frame)).join(',') ?? '1';
    const ids = frames?.map(frame => frame.id).join('|') ?? 'legacy-first-frame';
    // Expensive art geometry is deliberately excluded from this index.
    const index = useMemo(() => buildXsheetIndex(project), [ids, holds]);
    const selectedFrameSet = useMemo(() => new Set(selectedFrameIds), [selectedFrameIds]);
    const selectedLayerSet = useMemo(() => new Set(selectedLayerIds), [selectedLayerIds]);
    const selectedIndex = currentFrameIndex(project);
    const selectedExposure = index.spans[selectedIndex]?.start ?? 1;
    const view = xsheetVisibleRange(index.total, viewport.top, viewport.height, ROW_HEIGHT);
    const rows = xsheetRows(index, view.first, view.last);
    useEffect(() => {
        const element = scroller.current;
        if (!element)
            return;
        const resize = () => setViewport(old => old.height === element.clientHeight ? old : { ...old, height: Math.max(MIN_WINDOW_HEIGHT, element.clientHeight) });
        resize();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
        observer?.observe(element);
        return () => observer?.disconnect();
    }, []);
    // On switching to a cel via the horizontal shortcuts, keep the selected exposure visible.
    useEffect(() => {
        const element = scroller.current;
        if (!element)
            return;
        const y = (selectedExposure - 1) * ROW_HEIGHT;
        if (y < element.scrollTop || y + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
            element.scrollTop = Math.max(0, y - 2 * ROW_HEIGHT);
            setViewport(old => ({ ...old, top: element.scrollTop }));
        }
    }, [selectedExposure]);
    useEffect(() => () => { if (raf.current !== null)
        cancelAnimationFrame(raf.current); }, []);
    const onScroll = () => {
        if (raf.current !== null)
            return;
        raf.current = requestAnimationFrame(() => {
            raf.current = null;
            const element = scroller.current;
            if (!element)
                return;
            setViewport(old => Math.abs(old.top - element.scrollTop) < ROW_HEIGHT ? old : { ...old, top: element.scrollTop });
        });
    };
    return _jsxs("div", { className: "xsheet-shell", "aria-label": "Exposure sheet vertical view", children: [_jsxs("div", { className: "xsheet-heading", children: [_jsx("strong", { children: "EXPOSURE SHEET" }), _jsxs("span", { children: [index.total, " frames \u00B7 ", index.spans.length, " drawings"] }), _jsx("small", { children: "Click a layer cell to select its drawing. Shift-click selects a range; Option-click toggles individual items. Use + / \u2212 to edit holds. Click frame, then Delete / \u232B to remove it. " })] }), _jsxs("div", { className: "xsheet-scroll", ref: scroller, onScroll: onScroll, role: "group", "aria-label": "Xsheet rows", children: [_jsxs("div", { className: "xsheet-cols", style: { gridTemplateColumns: `minmax(92px, 100px) repeat(${project.layers.length}, minmax(90px, 1fr))` }, children: [_jsx("span", { children: "FRAME / HOLD" }), project.layers.map(layer => _jsxs("span", { title: layer.name, children: [layer.name, layer.locked ? ' 🔒' : ''] }, layer.id))] }), _jsx("div", { style: { height: index.total * ROW_HEIGHT, position: 'relative', minWidth: `${100 + project.layers.length * 90}px` }, children: rows.map(row => {
                            const isActive = row.celIndex === selectedIndex;
                            const playbackActive = playbackExposure === row.exposure;
                            return _jsxs("div", { className: 'xsheet-row' + (selectedFrameSet.has(row.frameId) ? ' multi-selected' : '') + (isActive ? ' active' : '') + (playbackActive ? ' playing' : '') + (row.start ? ' beginning' : ' held-exposure'), style: { position: 'absolute', top: (row.exposure - 1) * ROW_HEIGHT, height: ROW_HEIGHT, gridTemplateColumns: `minmax(92px, 100px) repeat(${project.layers.length}, minmax(90px, 1fr))` }, children: [_jsxs("div", { className: "xsheet-frame-cell", children: [_jsxs("button", { disabled: busy, className: "xsheet-exposure-number", "aria-label": 'Go to exposure frame ' + row.exposure, onClick: e => onSelect(row.frameId, undefined, e.shiftKey, e.altKey), title: 'Frame ' + row.exposure + ', drawing ' + (row.celIndex + 1), children: [String(row.exposure).padStart(3, '0'), row.offset > 0 ? _jsx("span", { className: "xsheet-inbetween", children: "HOLD" }) : _jsx("span", { className: "xsheet-inbetween", children: "KEY" })] }), row.start && _jsxs("div", { className: "xsheet-hold-edit", "aria-label": 'Hold ' + row.hold + ' frames', children: [_jsx("button", { disabled: busy || row.hold <= 1, title: "Decrease hold by one frame", "aria-label": 'Shorten drawing ' + (row.celIndex + 1), onClick: () => onHoldChange(row.frameId, row.hold - 1), children: "\u2212" }), _jsx("span", { children: row.hold }), _jsx("button", { disabled: busy || row.hold >= MAX_FRAME_HOLD, title: "Increase hold by one frame", "aria-label": 'Extend drawing ' + (row.celIndex + 1), onClick: () => onHoldChange(row.frameId, row.hold + 1), children: "+" })] })] }), project.layers.map(layer => {
                                        const cell = xsheetLayerCell(project, row, layer.id);
                                        const chosen = isActive && project.activeLayerId === layer.id;
                                        return _jsxs("div", { className: 'xsheet-layer-slot' + (cell.held ? ' is-held' : '') + (selectedFrameSet.has(row.frameId) && selectedLayerSet.has(layer.id) ? ' multi-selected' : '') + (chosen ? ' chosen' : ''), children: [_jsxs("button", { disabled: busy, title: `${layer.name} · Frame ${row.exposure} · ${row.offset > 0 ? 'global hold' : cell.held ? 'linked held cel' : 'key cel'}`, onClick: e => onSelect(row.frameId, layer.id, e.shiftKey, e.altKey), "aria-label": `${layer.name}, exposure ${row.exposure}${cell.held ? ' held' : ' key'}`, children: [cell.label, row.start && _jsx("small", { children: cell.held ? 'HOLD' : cell.hasArt ? 'ART' : 'BLANK' })] }), row.start && cell.held && _jsx("button", { className: "xsheet-split", disabled: busy || layer.locked, "aria-label": `Create editable key on ${layer.name} at frame ${row.exposure}`, title: "Convert held layer cel to editable key (same as Alt+K)", onClick: () => onMakeKey(row.frameId, layer.id), children: "+KEY" })] }, layer.id);
                                    })] }, row.exposure);
                        }) })] }), _jsx("div", { className: "xsheet-tip", children: "The Xsheet and Timeline edit the same cels. Holds never duplicate your drawings. Click a frame, then Delete / \u232B to remove it. Shift+X shows/hides the side panel." })] });
}, (a, b) => a.busy === b.busy && a.playbackExposure === b.playbackExposure && a.selectedFrameIds === b.selectedFrameIds && a.selectedLayerIds === b.selectedLayerIds && sameXsheetPresentation(a.project, b.project));
