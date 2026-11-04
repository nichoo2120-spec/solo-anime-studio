export const initialShortcuts = { brush: 'b', eraser: 'e', lasso: 'l', rectangle: 'm', transform: 'v', 'stroke-select': 's', fill: 'g', hand: 'h', pencil: 'p', zoom: 'z', rotate: 'r', eyedropper: 'i', vector: 'n', resetRotation: 'shift+r', fit: 'f', lightTable: 'shift+l', pinLightTable: 'shift+p', xsheet: 'shift+x', substitutionShelf: 'shift+u', reuseShelf: 'shift+c', linkCel: 'ctrl+alt+l', unlinkCel: 'ctrl+alt+u', openProjects: 'ctrl+alt+o', audioTrack: 'shift+a', motionPlanning: 'shift+m', batchTransform: 'shift+t' };
export const commandLabels = { 'stroke-select': 'Select drawn strokes', pencil: 'Select Pencil', zoom: 'Zoom tool', rotate: 'Rotate Canvas tool', eyedropper: 'Eyedropper', resetRotation: 'Reset rotation', fit: 'Fit canvas', lightTable: 'Toggle advanced light table', pinLightTable: 'Pin / unpin current drawing', xsheet: 'Switch Timeline / Xsheet', substitutionShelf: 'Open drawing substitutions shelf', reuseShelf: 'Open linked drawings and cycles', linkCel: 'Link drawing to selected destination frame', unlinkCel: 'Unlink current drawing', openProjects: 'Open local projects / project cleanup', audioTrack: 'Show / hide animation audio waveform', motionPlanning: 'Open timing notes and motion arcs', batchTransform: 'Open Multi-Cel Transform' };
export function keyChord(event) {
    // Ctrl+Alt is reserved here for explicit link/unlink commands. All existing
    // single-letter and Shift+letter tool shortcuts keep their original meaning.
    if (event.ctrlKey && event.altKey && !event.metaKey)
        return 'ctrl+alt+' + (event.shiftKey ? 'shift+' : '') + event.key.toLowerCase();
    return (event.shiftKey ? 'shift+' : '') + event.key.toLowerCase();
}
export const shortcutPattern = /^(?:(?:shift\+)?|ctrl\+alt\+)[a-z]$/;
const reserved = (key) => key === 'o' || key === 'shift+w' || key === 'ctrl+alt+d';
export function shortcutValid(key, command, bindings) { return shortcutPattern.test(key) && !reserved(key) && !Object.entries(bindings).some(([id, value]) => id !== command && value === key); }
export function normalizeShortcuts(value) {
    const bindings = {}, used = new Set();
    // Existing user choices take precedence over newly introduced default keys.
    if (value && typeof value === 'object')
        for (const [command, key] of Object.entries(value))
            if (command in initialShortcuts && typeof key === 'string' && shortcutPattern.test(key) && !reserved(key) && !used.has(key)) {
                bindings[command] = key;
                used.add(key);
            }
    for (const [command, key] of Object.entries(initialShortcuts))
        if (!bindings[command]) {
            const letter = key.split('+').at(-1), options = [key, 'shift+' + letter, 'ctrl+alt+' + letter, ...'abcdefghijklmnopqrstuvwxyz'.split(''), ...'abcdefghijklmnopqrstuvwxyz'.split('').map(k => 'shift+' + k), ...'abcdefghijklmnopqrstuvwxyz'.split('').map(k => 'ctrl+alt+' + k)], available = options.find(candidate => !reserved(candidate) && !used.has(candidate));
            bindings[command] = available;
            used.add(available);
        }
    return bindings;
}
