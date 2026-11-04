import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "../../jsx-runtime.js";
import { memo, useMemo, useState } from '../../react.js';
import { toProject, toScreen } from '../core/geometry.js';
import { depthScaleFactors } from '../animation/progressiveScale.js';
import { FloatingTransformPanel } from './FloatingTransformPanel.js';
const clamp = (v) => Math.max(.25, Math.min(3, v));
/** Draw lightweight SVG stroke ghosts for ALL selected frames during drag.
 * No drawing engine commits and no high-resolution bitmap repaints until Apply.
 */
export const ProgressiveScaleCanvas = memo(function ProgressiveScaleCanvas({ view, frames, initialFocus, onFocusFrame, onApply, onCancel }) {
    const [focus, setFocus] = useState(() => frames.some(f => f.id === initialFocus) ? initialFocus : frames.at(-1)?.id ?? '');
    const [anchors, setAnchors] = useState({});
    const [mode, setMode] = useState('auto');
    const [drag, setDrag] = useState(null);
    const [error, setError] = useState('');
    const factors = useMemo(() => depthScaleFactors(frames, focus, anchors, mode), [frames, focus, anchors, mode]);
    const current = frames.find(f => f.id === focus) ?? frames[0];
    if (!current)
        return null;
    const box = current.bounds, scale = anchors[focus] ?? 1;
    const pivot = { x: box.x + box.w / 2, y: box.y + box.h };
    const transform = (p) => toScreen({ x: pivot.x + (p.x - pivot.x) * scale, y: pivot.y + (p.y - pivot.y) * scale }, view);
    const corners = [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }].map(transform);
    const local = (e) => { const rect = e.currentTarget.getBoundingClientRect(); return toProject({ x: e.clientX - rect.left, y: e.clientY - rect.top }, view); };
    const pointerDistance = (p) => Math.max(2, Math.hypot(p.x - pivot.x, p.y - pivot.y));
    const setSize = (id, value) => { setAnchors(old => ({ ...old, [id]: clamp(value) })); setError(''); };
    const down = (e) => {
        if (e.button !== 0 || drag || e.target.getAttribute('data-depth-handle') !== 'scale')
            return;
        e.preventDefault();
        e.stopPropagation();
        setDrag({ pointer: e.pointerId, startDistance: pointerDistance(local(e)), startScale: scale, focusId: focus });
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
        if (!drag || drag.pointer !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        setSize(drag.focusId, drag.startScale * pointerDistance(local(e)) / drag.startDistance);
    };
    const end = (e) => {
        if (!drag || drag.pointer !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'pointerup')
            setSize(drag.focusId, drag.startScale * pointerDistance(local(e)) / drag.startDistance);
        setDrag(null);
    };
    return _jsxs(_Fragment, { children: [_jsxs("svg", { className: "batch-canvas-overlay", "aria-label": "Progressive Depth Scale preview on all frames", onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end, children: [frames.map((frame, i) => {
                        const size = factors[frame.id] ?? 1, b = frame.bounds, at = toScreen({ x: b.x + b.w / 2, y: b.y + b.h }, view);
                        return _jsxs("g", { style: { pointerEvents: 'none', opacity: frame.id === focus ? .94 : .55 }, transform: `translate(${at.x} ${at.y}) scale(${size}) translate(${-at.x} ${-at.y})`, children: [frame.paths.map((path, j) => _jsx("path", { d: path.d, stroke: frame.id === focus ? '#94ffe0' : i % 2 ? '#f5b78b' : '#94c9ff', strokeWidth: Math.max(1, path.width * view.zoom), fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }, j)), _jsxs("text", { x: at.x, y: at.y + 16, textAnchor: "middle", className: "batch-canvas-value", children: ["F", frame.number, " ", Math.round(size * 100), "%"] })] }, frame.id);
                    }), _jsx("polygon", { points: corners.map(p => `${p.x},${p.y}`).join(' '), className: "batch-canvas-outline", style: { pointerEvents: 'none' } }), corners.map((p, i) => _jsx("circle", { cx: p.x, cy: p.y, r: 13, "data-depth-handle": "scale", className: "batch-canvas-handle", style: { pointerEvents: 'all', cursor: 'nwse-resize' } }, i)), _jsxs("text", { x: corners[1].x + 15, y: corners[1].y - 10, className: "batch-canvas-value", style: { pointerEvents: 'none' }, children: ["FRAME ", current.number, " ", Math.round(scale * 100), "%"] })] }), _jsxs(FloatingTransformPanel, { id: "depth", className: "depth-scale-controls", label: "Depth Scale for any selected frame", children: [_jsx("strong", { children: "DEPTH" }), _jsxs("label", { className: "depth-size-input", children: ["Edit frame ", _jsx("select", { "aria-label": "Depth target frame", value: focus, onChange: e => { setFocus(e.target.value); setError(''); onFocusFrame(e.target.value); }, children: frames.map(f => _jsxs("option", { value: f.id, children: ["Frame ", f.number] }, f.id)) })] }), _jsx("button", { type: "button", className: mode === 'auto' ? 'active' : '', onClick: () => { setMode('auto'); setError(''); }, children: "Auto \u00B7 All" }), _jsx("button", { type: "button", className: mode === 'independent' ? 'active' : '', onClick: () => { setMode('independent'); setError(''); }, children: "Only this frame" }), _jsxs("label", { className: "depth-size-input", children: ["Size % ", _jsx("input", { "aria-label": "Current frame size percent", type: "number", min: "25", max: "300", step: "5", value: Math.round(scale * 100), onChange: e => setSize(focus, Number(e.target.value) / 100) })] }), _jsx("button", { type: "button", className: "depth-apply", onClick: () => { const issue = onApply(factors); setError(issue ?? ''); }, disabled: Object.values(factors).every(n => Math.abs(n - 1) < .0001), children: "Apply" }), _jsx("button", { type: "button", onClick: onCancel, children: "Cancel" }), error && _jsx("small", { className: "depth-error", role: "alert", children: error }), _jsx("small", { children: "Drag a teal corner. Other selected drawings preview instantly. Auto blends sizes; Only this frame leaves others unchanged. Apply saves one Undo step." })] })] });
});
