import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { memo, useMemo, useState } from '../../react.js';
import { BookmarkPlus, Copy, Trash2, PenLine } from '../../lucide.js';
import { substitutionCategories, MAX_SUBSTITUTIONS } from '../animation/substitutions.js';
/** Deliberately lightweight SVG thumbnail. Never invokes the full canvas renderer
 * and only scans its immutable shelf item on save/change, not on each pen stroke. */
const ShelfThumbnail = memo(function ShelfThumbnail({ item }) {
    const preview = useMemo(() => {
        const paths = [];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const op of item.operations.slice(0, 25)) {
            const points = op.kind === 'stroke' ? op.points : op.kind === 'vector' ? op.nodes : [];
            const color = op.kind === 'stroke' || op.kind === 'vector' ? op.color : '#a0c7c2';
            if (op.kind === 'stroke' && op.tool === 'eraser')
                continue;
            if (!points.length)
                continue;
            const step = Math.max(1, Math.floor(points.length / 70));
            const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
            for (const point of sampled) {
                x0 = Math.min(x0, point.x);
                y0 = Math.min(y0, point.y);
                x1 = Math.max(x1, point.x);
                y1 = Math.max(y1, point.y);
            }
            paths.push({ id: op.id, d: sampled.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '), color });
        }
        if (!paths.length)
            return null;
        const w = Math.max(25, x1 - x0), h = Math.max(25, y1 - y0), pad = Math.max(w, h) * .12;
        return { viewBox: [x0 - pad, y0 - pad, w + pad * 2, h + pad * 2].join(' '), paths };
    }, [item]);
    return _jsx("svg", { className: "substitution-thumb", viewBox: preview?.viewBox ?? '0 0 100 65', "aria-label": "Simplified drawing preview", role: "img", preserveAspectRatio: "xMidYMid meet", children: preview ? preview.paths.map(path => _jsx("path", { d: path.d, stroke: path.color, strokeWidth: "2", vectorEffect: "non-scaling-stroke", fill: "none", opacity: ".85", strokeLinecap: "round", strokeLinejoin: "round" }, path.id)) : _jsx("text", { x: "50", y: "33", fill: "#78aba7", fontSize: "10", textAnchor: "middle", children: "ART" }) });
});
export function SubstitutionShelf({ items, layerName, selectedCount, disabled, onSave, onApply, onRename, onDelete }) {
    const [name, setName] = useState(''), [category, setCategory] = useState('mouth');
    const [filter, setFilter] = useState('all');
    const [mode, setMode] = useState('append');
    const shown = filter === 'all' ? items : items.filter(item => item.category === filter);
    const capture = (selection) => { if (onSave(name, category, selection))
        setName(''); };
    return _jsxs("div", { className: "substitution-shelf", role: "region", "aria-label": "Drawing Substitution Shelf", children: [_jsxs("div", { className: "substitution-intro", children: [_jsx("strong", { children: "DRAWING SUBSTITUTIONS" }), _jsxs("span", { children: [items.length, "/", MAX_SUBSTITUTIONS] })] }), _jsx("p", { className: "hint", children: "Reuse your own mouth, eye, hand, pose or FX drawings. Saved in this project. Copies are independent, never linked." }), _jsxs("label", { className: "substitution-label", children: ["Name", _jsx("input", { "aria-label": "Name new substitution", maxLength: 60, value: name, onChange: e => setName(e.target.value), placeholder: "e.g. Mouth A / Blink Closed" })] }), _jsxs("label", { className: "substitution-label", children: ["Category", _jsx("select", { "aria-label": "Substitution category", value: category, onChange: e => setCategory(e.target.value), children: substitutionCategories.map(cat => _jsx("option", { value: cat, children: cat.toUpperCase() }, cat)) })] }), _jsxs("div", { className: "substitution-save-buttons", children: [_jsxs("button", { disabled: disabled || !selectedCount || !name.trim() || items.length >= MAX_SUBSTITUTIONS, title: "Save selected strokes from active layer only", onClick: () => capture(true), children: [_jsx(BookmarkPlus, { size: 14 }), " Save selection"] }), _jsxs("button", { disabled: disabled || !name.trim() || items.length >= MAX_SUBSTITUTIONS, title: 'Save everything drawn on ' + layerName, onClick: () => capture(false), children: [_jsx(BookmarkPlus, { size: 14 }), " Save layer"] })] }), _jsxs("small", { className: "substitution-caption", children: ["Active layer: ", layerName, ". Select strokes with S / Shift-click / lasso, then save your selection."] }), _jsx("div", { className: "substitution-divider" }), _jsxs("label", { className: "substitution-label", children: ["Show", _jsxs("select", { "aria-label": "Filter saved drawings", value: filter, onChange: e => setFilter(e.target.value), children: [_jsx("option", { value: "all", children: "All drawings" }), substitutionCategories.map(cat => _jsx("option", { value: cat, children: cat.toUpperCase() }, cat))] })] }), _jsxs("label", { className: "substitution-label", children: ["Insert mode", _jsxs("select", { "aria-label": "Substitution insert mode", value: mode, onChange: e => setMode(e.target.value), children: [_jsx("option", { value: "append", children: "Add to current layer (safe)" }), _jsx("option", { value: "replace", children: "Replace current layer (confirm)" })] })] }), _jsxs("div", { className: "substitution-cards", children: [shown.map(item => _jsxs("div", { className: "substitution-card", children: [_jsx(ShelfThumbnail, { item: item }), _jsxs("div", { className: "substitution-card-heading", children: [_jsx("strong", { title: item.name, children: item.name }), _jsxs("small", { children: [item.category.toUpperCase(), " \u00B7 ", item.layerKind] })] }), _jsxs("div", { className: "substitution-card-actions", children: [_jsxs("button", { className: "substitution-insert", title: 'Insert independent copy into ' + layerName, disabled: disabled, onClick: () => onApply(item.id, mode), children: [_jsx(Copy, { size: 12 }), " Insert"] }), _jsx("button", { "aria-label": 'Rename ' + item.name, title: "Rename", disabled: disabled, onClick: () => { const label = window.prompt('Rename drawing:', item.name); if (label !== null)
                                            onRename(item.id, label); }, children: _jsx(PenLine, { size: 13 }) }), _jsx("button", { "aria-label": 'Delete ' + item.name, title: "Remove from shelf (original artwork unaffected)", disabled: disabled, onClick: () => { if (window.confirm('Remove “' + item.name + '” from this project shelf? Existing artwork is not affected.'))
                                            onDelete(item.id); }, children: _jsx(Trash2, { size: 13 }) })] })] }, item.id)), !shown.length && _jsx("p", { className: "hint", children: items.length ? 'Nothing in this category yet.' : 'No drawings saved yet. Make a drawing, name it above, then choose Save selection or Save layer.' })] }), _jsx("p", { className: "hint", children: "Held animation cels automatically become independent keys when you insert a substitution. Undo restores the previous drawing. No automatic linked edits or cycles yet." })] });
}
