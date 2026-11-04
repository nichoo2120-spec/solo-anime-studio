import { jsx as _jsx, jsxs as _jsxs } from "../../jsx-runtime.js";
import { allTools } from './icons.js';
import { commandLabels, shortcutPattern, shortcutValid } from '../core/shortcuts.js';
export function ShortcutEditor({ bindings, onChange, notify }) {
    return _jsx("div", { className: "shortcut-grid", children: Object.entries(bindings).map(([id, key]) => { const item = allTools.find(t => t.id === id), label = item?.name ?? commandLabels[id] ?? id; return _jsxs("label", { children: [_jsx("span", { children: label }), _jsx("input", { "aria-label": label + ' shortcut', value: key.toUpperCase(), maxLength: 12, onChange: e => { const next = e.target.value.toLowerCase(); if (!shortcutPattern.test(next))
                        return; if (!shortcutValid(next, id, bindings)) {
                        notify('That key is already assigned.');
                        return;
                    } onChange({ ...bindings, [id]: next }); }, onKeyDown: e => { if (e.key.length === 1 && (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey || e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey)) {
                        e.preventDefault();
                        const next = (e.ctrlKey ? 'ctrl+alt+' : 'shift+') + e.key.toLowerCase();
                        if (shortcutValid(next, id, bindings))
                            onChange({ ...bindings, [id]: next });
                        else
                            notify('That shortcut is already assigned or reserved.');
                    } } })] }, id); }) });
}
