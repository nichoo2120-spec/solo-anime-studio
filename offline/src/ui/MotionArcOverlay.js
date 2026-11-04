import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useState } from '../../react.js';
import { motionBezierSegments, motionControlDotPosition, motionTargetAtTime } from '../animation/motionPlanning.js';
import { toScreen, toProject } from '../core/geometry.js';
export const MotionArcOverlay = memo(function MotionArcOverlay({ planning, view, activeFrameId, frameIds, activeArcId, editing, addingDot, selectedDotId, onMovePoint, onAddDot, onMoveDot, onSelectDot }) {
    const [drag, setDrag] = useState(null);
    if (!planning?.arcs.length)
        return null;
    const localPoint = (e) => {
        const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
        return toProject({ x: e.clientX - rect.left, y: e.clientY - rect.top }, view);
    };
    const begin = (e, arc, id, kind, origin) => {
        if (!editing || arc.id !== activeArcId)
            return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const pointer = localPoint(e);
        if (kind === 'dot')
            onSelectDot(id);
        else
            onSelectDot('');
        setDrag({ x: origin.x, y: origin.y, arcId: arc.id, id, kind, pointerId: e.pointerId, downX: pointer.x, downY: pointer.y, originX: origin.x, originY: origin.y });
    };
    const position = (e, d) => {
        const pt = localPoint(e);
        return { x: d.originX + pt.x - d.downX, y: d.originY + pt.y - d.downY };
    };
    const move = (e) => {
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        setDrag({ ...drag, ...position(e, drag) });
    };
    const finish = (e) => {
        if (!drag || drag.pointerId !== e.pointerId)
            return;
        e.preventDefault();
        e.stopPropagation();
        const point = position(e, drag);
        setDrag(null);
        if (e.type !== 'pointerup' || Math.hypot(point.x - drag.originX, point.y - drag.originY) <= 0.5)
            return;
        if (drag.kind === 'dot')
            onMoveDot(drag.arcId, drag.id, point.x - drag.originX, point.y - drag.originY, activeFrameId);
        else
            onMovePoint(drag.arcId, drag.id, point.x, point.y);
    };
    const makePath = (arc) => {
        const adjusted = drag?.arcId === arc.id ? drag.kind === 'dot' ? { ...arc, controlDots: arc.controlDots?.map(d => d.id === drag.id ? { ...d, dx: d.dx + drag.x - drag.originX, dy: d.dy + drag.y - drag.originY } : d) } : { ...arc, points: arc.points.map(p => p.frameId === drag.id ? { ...p, x: drag.x, y: drag.y } : p) } : arc;
        const segments = motionBezierSegments(adjusted, frameIds);
        if (!segments.length)
            return '';
        const screen = (p) => { const s = toScreen(p, view); return `${s.x} ${s.y}`; };
        return `M${screen(segments[0].a)} ` + segments.map(s => `C${screen(s.c1)} ${screen(s.c2)} ${screen(s.b)}`).join(' ');
    };
    return _jsx("svg", { className: "motion-arc-overlay", role: "img", "aria-label": "Motion path guide overlay", children: planning.arcs.map((arc) => {
            const preview = drag?.arcId === arc.id ? drag.kind === 'dot' ? { ...arc, controlDots: arc.controlDots?.map(d => d.id === drag.id ? { ...d, dx: d.dx + drag.x - drag.originX, dy: d.dy + drag.y - drag.originY } : d) } : { ...arc, points: arc.points.map(p => p.frameId === drag.id ? { ...p, x: drag.x, y: drag.y } : p) } : arc;
            const positions = preview.points.map(pt => { const i = frameIds.indexOf(pt.frameId); return { ...toScreen(i >= 0 ? motionTargetAtTime(preview, frameIds, i) ?? pt : pt, view), frameId: pt.frameId }; });
            const dots = (preview.controlDots ?? []).map(dot => ({ dot, point: motionControlDotPosition(preview, frameIds, dot) })).filter((item) => item.point !== null);
            if (!positions.length)
                return null;
            const path = makePath(arc);
            const middle = arc.points[Math.floor(arc.points.length / 2)];
            return _jsxs("g", { children: [positions.length >= 2 && _jsx("path", { d: path, stroke: "#51ddbf", strokeWidth: "2", fill: "none", strokeDasharray: "7 4", strokeLinecap: "round", strokeLinejoin: "round" }), editing && arc.id === activeArcId && path && middle && _jsx("path", { d: path, stroke: "transparent", strokeWidth: "20", fill: "none", pointerEvents: "stroke", style: { cursor: addingDot ? 'crosshair' : 'grab', touchAction: 'none' }, "aria-label": addingDot ? 'Tap here to add a dot' : 'Drag to reshape path', onPointerDown: e => {
                            if (addingDot) {
                                e.preventDefault();
                                e.stopPropagation();
                                const p = localPoint(e);
                                onAddDot(arc.id, p.x, p.y);
                            }
                            else {
                                const origin = arc.points.find(p => p.frameId === middle.frameId);
                                begin(e, arc, middle.frameId, 'curve', origin);
                            }
                        }, onPointerMove: move, onPointerUp: finish, onPointerCancel: finish }), positions.map((point, index) => _jsxs("g", { transform: `translate(${point.x} ${point.y})`, children: [_jsx("circle", { r: point.frameId === activeFrameId ? 7 : 5, fill: point.frameId === activeFrameId ? '#e8cf70' : '#113e3b', stroke: "#7bf2d8", strokeWidth: "2" }), _jsx("text", { y: "-12", fill: "#b4f8e8", stroke: "#11232b", strokeWidth: "2.5", paintOrder: "stroke", fontSize: "10", textAnchor: "middle", children: index + 1 }), editing && arc.id === activeArcId && !addingDot && _jsx("circle", { r: "13", fill: "transparent", stroke: "#7bf2d8", strokeOpacity: ".25", pointerEvents: "all", style: { cursor: 'move', touchAction: 'none' }, onPointerDown: e => begin(e, arc, point.frameId, 'frame', arc.points[index]), onPointerMove: move, onPointerUp: finish, onPointerCancel: finish })] }, point.frameId)), dots.map(({ dot, point }, index) => {
                        const s = toScreen(point, view), selected = dot.id === selectedDotId;
                        return _jsxs("g", { transform: `translate(${s.x} ${s.y})`, children: [_jsx("circle", { r: selected ? 8 : 6, fill: selected ? '#ffe0a0' : '#27bdac', stroke: "#f9f7e5", strokeWidth: "2" }), _jsxs("text", { y: "-15", fontSize: "10", fill: "#e8fff6", textAnchor: "middle", stroke: "#11232b", strokeWidth: "2.5", paintOrder: "stroke", children: ["+", index + 1] }), editing && arc.id === activeArcId && !addingDot && _jsx("circle", { r: "15", fill: "transparent", pointerEvents: "all", style: { cursor: 'move', touchAction: 'none' }, onPointerDown: e => begin(e, arc, dot.id, 'dot', point), onPointerMove: move, onPointerUp: finish, onPointerCancel: finish })] }, dot.id);
                    })] }, arc.id);
        }) });
});
