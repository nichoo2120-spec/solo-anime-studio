import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useEffect, useRef } from '../../react.js';
import { brushStrokeMetadata, paintTips } from '../core/paintTips.js';
import { isColoringTip, defaultColorNib, colorNibs } from '../core/coloring.js';
import { coloringPreview } from '../engine/coloringPreview.js';
const TipCard = memo(function TipCard({ preset, active, onChoose }) {
    const canvas = useRef(null), s = preset.settings;
    useEffect(() => { const frame = requestAnimationFrame(() => { const c = canvas.current, ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); ctx.save(); coloringPreview(ctx, { ...s, ...brushStrokeMetadata(s), id: 'tip-dot', kind: 'stroke', tool: 'brush', size: Math.min(19, s.size), color: '#dce5e9', pressure: false, points: [{ x: 17, y: 24, p: 1 }] }); coloringPreview(ctx, { ...s, ...brushStrokeMetadata(s), id: 'tip-preview', kind: 'stroke', tool: 'brush', size: Math.min(19, s.size), color: '#dce5e9', points: Array.from({ length: 32 }, (_, i) => ({ x: 46 + i / 31 * 81, y: 24 + 8 * Math.sin(i / 31 * Math.PI * 2), p: .25 + .75 * Math.sin(i / 31 * Math.PI) })) }); ctx.globalCompositeOperation = 'destination-in'; ctx.globalAlpha = s.opacity; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore(); }); return () => cancelAnimationFrame(frame); }, [s]);
    const tip = isColoringTip(s.brushTip) ? colorNibs.find(n => n.id === (s.colorNib ?? defaultColorNib(s.brushTip)))?.name ?? 'Nib' : s.brushTip === 'round' ? (s.brushKind === 'airbrush' ? 'Soft round' : 'Original tip') : paintTips.find(t => t.id === s.brushTip)?.name ?? 'Original tip';
    return _jsxs("button", { type: "button", className: 'paint-tip-card' + (active ? ' selected' : ''), title: preset.name + ' · ' + tip, "aria-label": 'Use ' + preset.name, "aria-pressed": active, onClick: () => onChoose(preset.id), children: [_jsx("canvas", { ref: canvas, width: "140", height: "48", "aria-label": preset.name + ' stroke preview' }), _jsx("span", { children: preset.name }), _jsx("small", { children: tip })] });
});
export const PaintBrushPicker = memo(function PaintBrushPicker({ presets, selected, family, onChoose }) {
    return _jsx("div", { className: "paint-tip-picker", role: "group", "aria-label": "Paint brush tips", children: presets.filter(p => p.category === 'Paint' && (!family || p.family === family)).map(p => _jsx(TipCard, { preset: p, active: p.id === selected, onChoose: onChoose }, p.id)) });
});
