import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { useRef, useState } from '../../react.js';
import { readPreference, writePreference } from './preferences.js';
/** Lightweight pointer-drag panel. Only the grip starts dragging, never buttons/inputs. */
export function FloatingTransformPanel({ id, className, label, children }) {
    const [offset, setOffset] = useState(() => readPreference('floating-transform-' + id, { x: 0, y: 0 }));
    const drag = useRef(null);
    const start = (e) => {
        if (e.button !== 0)
            return;
        e.preventDefault();
        e.stopPropagation();
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, origin: offset };
        e.currentTarget.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        // Stay within a conservative canvas-adjacent distance; artist can reset by double-clicking grip.
        setOffset({ x: Math.max(-500, Math.min(1100, d.origin.x + e.clientX - d.x)), y: Math.max(-850, Math.min(140, d.origin.y + e.clientY - d.y)) });
    };
    const end = (e) => {
        if (!drag.current || drag.current.id !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        const d = drag.current, position = { x: Math.max(-500, Math.min(1100, d.origin.x + e.clientX - d.x)), y: Math.max(-850, Math.min(140, d.origin.y + e.clientY - d.y)) };
        drag.current = null;
        if (e.type === 'pointerup') {
            setOffset(position);
            writePreference('floating-transform-' + id, position);
        }
        else
            setOffset(d.origin);
    };
    return _jsxs("div", { className: className + ' floating-transform-panel', role: "toolbar", "aria-label": label, style: { transform: `translate(${offset.x}px, ${offset.y}px)` }, children: [_jsx("button", { type: "button", className: "floating-panel-grip", title: "Drag to move this toolbar \u00B7 double-click to reset", "aria-label": "Drag transform toolbar", onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onDoubleClick: () => { const at = { x: 0, y: 0 }; setOffset(at); writePreference('floating-transform-' + id, at); }, children: "\u283F" }), children] });
}
