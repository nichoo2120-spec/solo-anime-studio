import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useId } from '../../react.js';
const makeToolIcon = (symbol) => memo(function StudioToolIcon({ size = 24, className }) {
    const id = useId().replace(/:/g, '');
    const silver = `url(#${id}-silver)`, cyan = `url(#${id}-cyan)`;
    const thin = { fill: 'none', stroke: silver, strokeWidth: 3.1, strokeLinecap: 'round', strokeLinejoin: 'round' };
    const accent = { fill: 'none', stroke: cyan, strokeWidth: 3.1, strokeLinecap: 'round', strokeLinejoin: 'round' };
    let art;
    switch (symbol) {
        case 'eraser':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M5.7 29.7 24.5 8.7a5 5 0 0 1 7.1-.2l8 7.2a5 5 0 0 1 .3 7L22 43H12L5.8 37a5.1 5.1 0 0 1-.1-7.3Z", fill: silver }), _jsx("path", { d: "m13 21 17 15-6.2 7H12l-6.2-6a5.1 5.1 0 0 1-.1-7.3Z", fill: "#5d778b" }), _jsx("path", { d: "m11 25.8 16.5 15M33.3 12.1l5.9 5.6", ...accent, strokeWidth: 2.2 }), _jsx("path", { d: "M29 43h14", ...thin, strokeWidth: 2.4 })] });
            break;
        case 'lasso':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M30 36.3C17 40.5 5.4 34.5 5.7 23.1c.4-10.5 10.1-16.7 21.2-14.8C37.2 10 43 16.4 41.3 25c-1.5 7.3-8.5 10.3-16.2 11.1", ...thin, strokeWidth: 3.4 }), _jsx("path", { d: "M28.6 35.7c1.1 3.4 3 4.7 6.4 4.8", ...accent, strokeWidth: 2.7 }), _jsx("path", { d: "M31 40.7c0-3 4-4.3 5.7-1.8 1.5 2.2-.6 5.5-2.9 5.1-1.8-.3-2.8-1.7-2.8-3.3Z", fill: silver })] });
            break;
        case 'move':
            art = _jsxs(_Fragment, { children: [_jsx("g", { fill: "none", stroke: "#64e3ee", strokeWidth: "1.55", strokeLinecap: "round", children: _jsx("path", { d: "M16 5.8A19.1 19.1 0 0 1 32 5.8M42.2 16A19.1 19.1 0 0 1 42.2 32M32 42.2A19.1 19.1 0 0 1 16 42.2M5.8 32A19.1 19.1 0 0 1 5.8 16" }) }), _jsx("g", { fill: "none", stroke: "#affcff", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M24 17V9m0 0-3.6 3.7M24 9l3.6 3.7M24 31v8m0 0-3.6-3.7M24 39l3.6-3.7M17 24H9m0 0 3.7-3.6M9 24l3.7 3.6M31 24h8m0 0-3.7-3.6M39 24l-3.7 3.6" }) }), _jsx("circle", { cx: "24", cy: "24", r: "2.5", fill: "#affcff" })] });
            break;
        case 'fill':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "m9 23 15-15 15 15-15 15L9 23Z", fill: "none", stroke: silver, strokeWidth: 3.6, strokeLinejoin: "round" }), _jsx("path", { d: "M18.6 6.8 34.9 23", ...thin, strokeWidth: 2.6 }), _jsx("path", { d: "M12.6 27 24 38l11-10.7", ...accent, strokeWidth: 4.3 }), _jsx("path", { d: "M39 30c-2.2 4.8-5.1 7.4-5.1 10.4a4.6 4.6 0 1 0 9.2 0c0-3-2-6.2-4.1-10.4Z", fill: cyan })] });
            break;
        case 'hand':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M10.5 26.3 9 21.5a3.1 3.1 0 0 1 5.6-2.7l2.8 3.9V9.1a3 3 0 0 1 6 0v11.1-14a3 3 0 1 1 6 0v13.4V9a3 3 0 0 1 6 0v11.7-6.1a3.1 3.1 0 0 1 6.2 0v14.7c0 7.4-4.9 13.2-13 13.2h-3.2c-6.9 0-10.9-6.3-14.9-16.2Z", fill: silver, stroke: "#7c9bad", strokeWidth: ".9", strokeLinejoin: "round" }), _jsx("path", { d: "M18 38.1c1.7 2.5 4.1 4.1 8.2 4.2", ...accent, strokeWidth: 2.3 })] });
            break;
        case 'zoom':
            art = _jsxs(_Fragment, { children: [_jsx("circle", { cx: "20.2", cy: "19.9", r: "13.4", stroke: silver, strokeWidth: "4.2", fill: "none" }), _jsx("path", { d: "M29.9 30.1 41.3 41.5", ...thin, strokeWidth: 6 }), _jsx("path", { d: "M12.8 19.9h14.8M20.2 12.5v14.8", ...accent, strokeWidth: 2.65 }), _jsx("path", { d: "M10.5 13c1.9-3 4.9-4.9 8.6-5.3", ...thin, strokeWidth: 1.8 })] });
            break;
        case 'rotate-canvas':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M37.8 16a17.8 17.8 0 1 0 3.5 15.9", ...thin, strokeWidth: 4.2 }), _jsx("path", { d: "m29.5 7.4 11 .9-2.9 10.3-8.1-11.2Z", fill: silver }), _jsx("path", { d: "m15 26.9 8-8 10 6", ...accent, strokeWidth: 2.4 }), _jsx("circle", { cx: "24", cy: "25", r: "2.5", fill: silver })] });
            break;
        case 'eyedropper':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "m26 16 8.7-8.7a4.3 4.3 0 0 1 6.1 6L32 22l2.7 2.7-4.9 4.9-4.1-4-14 14.2a4 4 0 0 1-5.7-5.7l14-14-3.6-3.6 4.9-4.9L26 16Z", fill: silver }), _jsx("path", { d: "M15 34.6 32 17.5", ...accent, strokeWidth: 2.4 }), _jsx("path", { d: "M5.5 42h8.3", ...thin, strokeWidth: 2.3 }), _jsx("circle", { cx: "40", cy: "7.5", r: "2.3", fill: cyan })] });
            break;
        case 'vector':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "m13 32 17-21 7 7-21 17-5 3 2-6Z", fill: silver }), _jsx("path", { d: "m16.5 32.5 13.7-15.4", ...accent, strokeWidth: 2.2 }), _jsx("path", { d: "M6 11C13 7 19 8 25 11s11 4 17-1", ...accent, strokeWidth: 2.6 }), _jsx("circle", { cx: "6", cy: "11", r: "3.1", fill: "#071c25", stroke: silver, strokeWidth: 2.2 }), _jsx("circle", { cx: "25", cy: "11", r: "3.1", fill: silver }), _jsx("circle", { cx: "42", cy: "10", r: "3.1", fill: "#071c25", stroke: silver, strokeWidth: 2.2 })] });
            break;
        case 'stroke-select':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M9 5 11.8 39.8l8.1-9.2 8.7 10 5.8-5.2-9.1-10.1 12-4.6L9 5Z", fill: silver, stroke: "#6b8da0", strokeWidth: "1.05", strokeLinejoin: "round" }), _jsx("path", { d: "M33.3 7C38 10 41 13 43 17", ...accent, strokeWidth: 2.6 }), _jsx("circle", { cx: "34", cy: "8", r: "3", fill: "#0c2531", stroke: cyan, strokeWidth: "2.4" }), _jsx("circle", { cx: "43", cy: "17", r: "2.5", fill: cyan })] });
            break;
        case 'rectangle':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M9 9h7M22 9h8M36 9h3v6M39 21v8M39 35v4h-8M25 39h-9M10 39H9v-8M9 25v-8", ...thin, strokeWidth: 3.1 }), _jsx("path", { d: "M6 6h6v6H6ZM36 36h6v6h-6Z", fill: cyan }), _jsx("path", { d: "M36 6h6v6h-6ZM6 36h6v6H6Z", fill: silver })] });
            break;
        case 'freeform':
            art = _jsxs(_Fragment, { children: [_jsx("rect", { x: "11", y: "12", width: "26", height: "25", stroke: "#9df9fa", strokeWidth: "1.65", fill: "none" }), _jsx("path", { d: "M9 13A19.7 19.7 0 0 1 24 4.8a19.7 19.7 0 0 1 18.7 20.5M39.2 33.4A19.7 19.7 0 0 1 24 43a19.7 19.7 0 0 1-18.5-19.7", fill: "none", stroke: "#46dcea", strokeWidth: "1.4", strokeDasharray: "5.5 3" }), _jsx("path", { d: "M24 15v19M14.5 24.5h19", stroke: "#c4fffd", strokeWidth: "1.65", strokeLinecap: "round" }), _jsx("path", { d: "m24 14-3.5 5h7ZM24 35l-3.5-5h7ZM13 24.5l5-3.5v7ZM35 24.5l-5-3.5v7Z", fill: "#a9fcfa" }), _jsxs("g", { fill: "#b5ffff", stroke: "#36cee2", strokeWidth: ".65", children: [_jsx("rect", { x: "8.3", y: "9.3", width: "5.4", height: "5.4" }), _jsx("rect", { x: "34.3", y: "9.3", width: "5.4", height: "5.4" }), _jsx("rect", { x: "8.3", y: "34.3", width: "5.4", height: "5.4" }), _jsx("rect", { x: "34.3", y: "34.3", width: "5.4", height: "5.4" })] }), _jsx("path", { d: "M24 12V6", stroke: "#8cf7f8", strokeWidth: "1.1" }), _jsx("circle", { cx: "24", cy: "5", r: "2.05", fill: "#d0ffff", stroke: "#2fd4dc", strokeWidth: "1.1" })] });
            break;
        case 'scale':
            art = _jsxs(_Fragment, { children: [_jsx("rect", { x: "10", y: "10", width: "28", height: "28", fill: "none", stroke: "#c7fffe", strokeWidth: "1.55" }), _jsx("g", { stroke: "#8ceff4", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", children: _jsx("path", { d: "M20 20 13 13M28 20l7-7M20 28l-7 7M28 28l7 7" }) }), _jsx("g", { fill: "#b2ffff", children: _jsx("path", { d: "m9 17 0-8 8 0-3.5 3.4ZM31 9h8v8l-4-4ZM9 31v8h8l-4-4ZM39 31v8h-8l4-4Z" }) }), _jsxs("g", { fill: "#abffff", stroke: "#2acbdc", strokeWidth: ".7", children: [_jsx("rect", { x: "7", y: "7", width: "6", height: "6" }), _jsx("rect", { x: "35", y: "7", width: "6", height: "6" }), _jsx("rect", { x: "7", y: "35", width: "6", height: "6" }), _jsx("rect", { x: "35", y: "35", width: "6", height: "6" })] }), _jsx("rect", { x: "22.25", y: "22.25", width: "3.5", height: "3.5", fill: "#98fafa" })] });
            break;
        case 'rotate-object':
            art = _jsxs(_Fragment, { children: [_jsx("circle", { cx: "24", cy: "24", r: "17.5", stroke: "#48cce0", strokeWidth: "1.4", fill: "none", strokeDasharray: "45 9 33 9" }), _jsx("circle", { cx: "24", cy: "24", r: "14.7", stroke: "#94f8fd", strokeWidth: "1.05", fill: "none", strokeDasharray: "21 12 30 32" }), _jsx("path", { d: "M24 3.7v9M24 35v9.3M3.7 24h8.7M35.6 24h8.7", stroke: "#4cd1e6", strokeWidth: ".95" }), _jsx("path", { d: "M24 8.3v31.4M8.3 24h31.4", stroke: "#6be6f2", strokeWidth: ".8", opacity: ".48" }), _jsx("path", { d: "m22.6 3.9 4.1 4.2-4.9 1.2Z M42.3 22.2l-4.7 4.2-1.2-5.5Z M12.7 37.3l-1.3-6.1 5.4 2.1Z", fill: "#b5fcff" }), _jsx("circle", { cx: "24", cy: "24", r: "4.45", stroke: "#84f9fd", strokeWidth: "1.3", fill: "#0e1a22" }), _jsx("path", { d: "M20.4 24h7.2M24 20.4v7.2", stroke: "#afffff", strokeWidth: "1.15" }), _jsx("circle", { cx: "24", cy: "24", r: ".95", fill: "#bfffff" })] });
            break;
        case 'perspective':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M10.5 13.5 36.5 7.5 41 40 7 36Z", stroke: "#adffff", strokeWidth: "1.55", fill: "none", strokeLinejoin: "round" }), _jsxs("g", { stroke: "#46d7e6", strokeWidth: ".88", opacity: ".85", fill: "none", children: [_jsx("path", { d: "M17.2 12 15.6 37M23.8 10.5 24.2 38M30.2 9 32.6 39" }), _jsx("path", { d: "M9.7 20 37.4 15.7M8.5 27.3 39 27.4" })] }), _jsx("circle", { cx: "24", cy: "24.5", r: "2", fill: "#9ffcff", stroke: "#34cdde", strokeWidth: ".8" }), _jsxs("g", { fill: "#c9ffff", stroke: "#18bfd5", strokeWidth: ".75", children: [_jsx("rect", { x: "7.7", y: "10.7", width: "5.6", height: "5.6" }), _jsx("rect", { x: "33.7", y: "4.7", width: "5.6", height: "5.6" }), _jsx("rect", { x: "4.2", y: "33.2", width: "5.6", height: "5.6" }), _jsx("rect", { x: "38.2", y: "37.2", width: "5.6", height: "5.6" })] })] });
            break;
        case 'skew':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M16 9H41L32 39H7Z", fill: "none", stroke: "#b9ffff", strokeWidth: "1.8", strokeLinejoin: "round" }), _jsx("path", { d: "M20 9 11 39M25 9l-9 30M31 9l-9 30", stroke: "#47ddeb", strokeWidth: ".8", opacity: ".8" }), _jsx("path", { d: "M17 6h19M13 42h19", stroke: "#75f0f7", strokeWidth: "1.3" }), _jsx("path", { d: "m17 6 3-2v4Zm19 0-3-2v4ZM13 42l3-2v4Zm19 0-3-2v4Z", fill: "#8efffc" })] });
            break;
        case 'distort':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M11 9 37 7 41 36 8 41Z", fill: "none", stroke: "#c2fffe", strokeWidth: "1.7", strokeLinejoin: "round" }), _jsx("path", { d: "M12 24 39 22M24 8 24 39", stroke: "#46dce8", strokeWidth: ".85", opacity: ".75" }), _jsxs("g", { fill: "#a8ffff", stroke: "#16bed2", strokeWidth: ".8", children: [_jsx("rect", { x: "8", y: "6", width: "6", height: "6" }), _jsx("rect", { x: "34", y: "4", width: "6", height: "6" }), _jsx("rect", { x: "38", y: "33", width: "6", height: "6" }), _jsx("rect", { x: "5", y: "38", width: "6", height: "6" })] })] });
            break;
        case 'perspective-move':
            art = _jsxs(_Fragment, { children: [_jsx("path", { d: "M10 36 26 12 41 36H10Z", stroke: silver, strokeWidth: 2.8, fill: "none", strokeLinejoin: "round" }), _jsx("path", { d: "M18 36 26 12l7 24M10 36h31", ...thin, strokeWidth: 1.7 }), _jsx("path", { d: "m26 34 0-18M21 22l5-6 5 6", ...accent, strokeWidth: 3 }), _jsx("circle", { cx: "26", cy: "8", r: "3", fill: cyan })] });
            break;
    }
    return _jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 48 48", className: className, "aria-hidden": "true", focusable: "false", fill: "none", children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: `${id}-silver`, x1: "6", y1: "6", x2: "39", y2: "42", gradientUnits: "userSpaceOnUse", children: [_jsx("stop", { stopColor: "#fff" }), _jsx("stop", { offset: ".47", stopColor: "#eaf7ff" }), _jsx("stop", { offset: "1", stopColor: "#9ac9dc" })] }), _jsxs("linearGradient", { id: `${id}-cyan`, x1: "8", y1: "7", x2: "42", y2: "42", gradientUnits: "userSpaceOnUse", children: [_jsx("stop", { stopColor: "#8efffa" }), _jsx("stop", { offset: ".65", stopColor: "#2debe1" }), _jsx("stop", { offset: "1", stopColor: "#08b9dd" })] })] }), art] });
});
export const StudioEraserIcon = makeToolIcon('eraser');
export const StudioLassoIcon = makeToolIcon('lasso');
export const StudioMoveIcon = makeToolIcon('move');
export const StudioFillIcon = makeToolIcon('fill');
export const StudioHandIcon = makeToolIcon('hand');
export const StudioZoomIcon = makeToolIcon('zoom');
export const StudioRotateCanvasIcon = makeToolIcon('rotate-canvas');
export const StudioEyedropperIcon = makeToolIcon('eyedropper');
export const StudioVectorIcon = makeToolIcon('vector');
export const StudioStrokeSelectIcon = makeToolIcon('stroke-select');
export const StudioRectangleIcon = makeToolIcon('rectangle');
export const StudioFreeformIcon = makeToolIcon('freeform');
export const StudioScaleIcon = makeToolIcon('scale');
export const StudioRotateObjectIcon = makeToolIcon('rotate-object');
export const StudioPerspectiveIcon = makeToolIcon('perspective');
export const StudioPerspectiveMoveIcon = makeToolIcon('perspective-move');
export const StudioSkewIcon = makeToolIcon('skew');
export const StudioDistortIcon = makeToolIcon('distort');
