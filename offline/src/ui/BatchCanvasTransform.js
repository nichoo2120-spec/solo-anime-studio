import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useState } from '../../react.js';
import { toProject, toScreen } from '../core/geometry.js';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/** One lightweight SVG overlay, no heavy cels rendered or modified until pen-up.
 * Works with a Wacom pen as well as a mouse. Never touches normal drawing input.
 */
export const BatchCanvasTransform = memo(function BatchCanvasTransform({ view, bounds, mode, onCommit }) {
    const [drag, setDrag] = useState(null);
    const [preview, setPreview] = useState({ dx: 0, dy: 0, scale: 1, angle: 0 });
    const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
    const transformed = (p) => {
        const { dx, dy, scale, angle = 0 } = preview;
        const radians = angle * Math.PI / 180, c = Math.cos(radians) * scale, s = Math.sin(radians) * scale;
        return toScreen({ x: center.x + dx + (p.x - center.x) * c - (p.y - center.y) * s, y: center.y + dy + (p.x - center.x) * s + (p.y - center.y) * c }, view);
    };
    const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y }, { x: bounds.x + bounds.w, y: bounds.y + bounds.h }, { x: bounds.x, y: bounds.y + bounds.h }].map(transformed);
    const topMid = transformed({ x: center.x, y: bounds.y - 35 / Math.max(view.zoom, .25) });
    const centroid = transformed(center);
    const local = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return toProject({ x: e.clientX - rect.left, y: e.clientY - rect.top }, view);
    };
    const calc = (p, d, shift) => {
        if (mode === 'move')
            return { dx: clamp(p.x - d.x, -4096, 4096), dy: clamp(p.y - d.y, -4096, 4096), scale: 1, angle: 0 };
        if (mode === 'scale') {
            const scale = clamp(Math.hypot(p.x - center.x, p.y - center.y) / d.anchor, .1, 3);
            return { dx: 0, dy: 0, scale, angle: 0 };
        }
        let angle = (Math.atan2(p.y - center.y, p.x - center.x) - d.initialAngle) * 180 / Math.PI;
        while (angle > 180)
            angle -= 360;
        while (angle < -180)
            angle += 360;
        if (shift)
            angle = Math.round(angle / 15) * 15;
        return { dx: 0, dy: 0, scale: 1, angle };
    };
    const down = (e) => {
        if (e.button !== 0 || drag)
            return;
        const handle = e.target.getAttribute('data-batch-handle');
        if (mode === 'scale' && handle !== 'scale')
            return;
        if (mode === 'rotate' && handle !== 'rotate')
            return;
        e.preventDefault();
        e.stopPropagation();
        const p = local(e);
        setDrag({ id: e.pointerId, x: p.x, y: p.y, anchor: Math.max(1, Math.hypot(p.x - center.x, p.y - center.y)), initialAngle: Math.atan2(p.y - center.y, p.x - center.x) });
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
        if (!drag || e.pointerId !== drag.id)
            return;
        e.preventDefault();
        e.stopPropagation();
        setPreview(calc(local(e), drag, e.shiftKey));
    };
    const end = (e) => {
        if (!drag || e.pointerId !== drag.id)
            return;
        e.preventDefault();
        e.stopPropagation();
        const values = calc(local(e), drag, e.shiftKey);
        setDrag(null);
        setPreview({ dx: 0, dy: 0, scale: 1, angle: 0 });
        if (e.type === 'pointerup' && (Math.hypot(values.dx, values.dy) > 0.2 || Math.abs(values.scale - 1) > .002 || Math.abs(values.angle ?? 0) > .2))
            onCommit(values);
    };
    const cursor = mode === 'move' ? 'move' : mode === 'scale' ? 'nwse-resize' : 'grab';
    return _jsxs("svg", { className: "batch-canvas-overlay", "aria-label": `Multi-frame ${mode} on canvas`, "data-batch-mode": mode, onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end, children: [_jsx("polygon", { points: corners.map(p => `${p.x},${p.y}`).join(' '), className: "batch-canvas-outline", style: { cursor, pointerEvents: 'all' } }), corners.map((p, i) => _jsx("circle", { "data-batch-handle": "scale", cx: p.x, cy: p.y, r: mode === 'scale' ? 8 : 5, className: "batch-canvas-handle", style: { pointerEvents: 'all', cursor } }, i)), mode === 'rotate' && _jsxs(_Fragment, { children: [_jsx("line", { x1: centroid.x, y1: centroid.y, x2: topMid.x, y2: topMid.y, className: "batch-canvas-rotation-guide" }), _jsx("circle", { "data-batch-handle": "rotate", cx: topMid.x, cy: topMid.y, r: 10, className: "batch-canvas-rotation-handle", style: { pointerEvents: 'all', cursor: 'grab' } })] }), drag && _jsx("text", { x: centroid.x + 15, y: centroid.y - 20, className: "batch-canvas-value", children: mode === 'move' ? `${Math.round(preview.dx)}, ${Math.round(preview.dy)} px` : mode === 'scale' ? `${Math.round(preview.scale * 100)}%` : `${Math.round(preview.angle ?? 0)}°` })] });
});
