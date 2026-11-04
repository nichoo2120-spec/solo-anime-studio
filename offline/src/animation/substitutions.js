/** Phase 2B Tool 2 — project-local, undoable drawing substitution snapshots.
 * A shelf entry is independent reusable artwork, not a live/linked cel.
 * Capturing never changes source art; applying clones operation IDs on purpose.
 */
import { uid } from '../core/model.js';
import { insertLayerKey, isLayerHeld, frameList, currentFrameIndex, syncActiveFrame } from './timeline.js';
export const MAX_SUBSTITUTIONS = 32;
export const MAX_SUBSTITUTION_OPERATIONS = 1500;
export const substitutionCategories = ['mouth', 'eyes', 'hands', 'pose', 'fx', 'other'];
export const substitutionItems = (p) => p.substitutionShelf?.items ?? [];
export function saveSubstitution(project, name, category, selectedIds) {
    const label = name.trim();
    if (!label || label.length > 60)
        throw Error('Give the drawing a name (up to 60 characters).');
    if (!substitutionCategories.includes(category))
        throw Error('Choose a valid shelf category.');
    const entries = substitutionItems(project);
    if (entries.length >= MAX_SUBSTITUTIONS)
        throw Error('The shelf is full (32 drawings).');
    const layer = project.layers.find(l => l.id === project.activeLayerId);
    if (!layer || layer.reference)
        throw Error('Select a drawing layer, not a reference layer.');
    const ids = selectedIds?.length ? new Set(selectedIds) : null;
    const source = ids ? layer.operations.filter(o => ids.has(o.id)) : layer.operations;
    if (!source.length)
        throw Error(ids ? 'No selected strokes belong to the active layer.' : 'Draw something on the active layer first.');
    if (source.length > MAX_SUBSTITUTION_OPERATIONS)
        throw Error('This artwork has too many operations for one shelf item.');
    const entry = { id: uid(), name: label, category, layerKind: layer.kind === 'vector' ? 'vector' : 'raster', operations: [...source] };
    return { ...project, substitutionShelf: { version: 1, items: [...entries, entry] } };
}
export function renameSubstitution(project, id, name) {
    const label = name.trim();
    if (!label || label.length > 60)
        throw Error('Enter a name of up to 60 characters.');
    const items = substitutionItems(project), index = items.findIndex(item => item.id === id);
    if (index < 0 || items[index].name === label)
        return project;
    return { ...project, substitutionShelf: { version: 1, items: items.map(item => item.id === id ? { ...item, name: label } : item) } };
}
export function deleteSubstitution(project, id) {
    const items = substitutionItems(project);
    if (!items.some(i => i.id === id))
        return project;
    return { ...project, substitutionShelf: { version: 1, items: items.filter(i => i.id !== id) } };
}
/** Apply only to current frame's current layer; any held destination is split into
 * a real key first. No accidental modification of previous key's artwork.
 * A subsequent held frame may continue this new key by normal animation semantics.
 */
export function applySubstitution(project, id, mode = 'append') {
    const item = substitutionItems(project).find(i => i.id === id);
    if (!item)
        throw Error('Shelf drawing no longer exists.');
    if (mode !== 'append' && mode !== 'replace')
        throw Error('Unknown apply mode.');
    const original = project.layers.find(l => l.id === project.activeLayerId);
    if (!original || original.locked || !original.visible || original.reference)
        throw Error('Choose an unlocked, visible artwork layer.');
    if ((original.kind === 'vector' ? 'vector' : 'raster') !== item.layerKind)
        throw Error('Shelf artwork type does not match this layer (raster/vector).');
    const activeFrameId = frameList(project)[currentFrameIndex(project)].id;
    const p = isLayerHeld(project, original.id, activeFrameId) ? insertLayerKey(project, original.id, activeFrameId, false) : project;
    const fresh = item.operations.map(op => ({ ...op, id: uid() }));
    return syncActiveFrame({ ...p, layers: p.layers.map(layer => layer.id === p.activeLayerId ? { ...layer, operations: mode === 'append' ? [...layer.operations, ...fresh] : fresh } : layer) });
}
