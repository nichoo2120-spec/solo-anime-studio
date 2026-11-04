import { currentFrameIndex, frameList } from './timeline.js';
export const DEFAULT_ONION_SETTINGS = { enabled: true, previous: true, next: true, previousOpacity: 28, nextOpacity: 22, currentLayerOnly: true, previousCount: 1, nextCount: 1 };
const clamp = (n, fallback) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
const count = (n, fallback) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(5, Math.floor(n))) : fallback;
export function sanitizeOnionSettings(raw) {
    const s = (raw && typeof raw === 'object' ? raw : {}), d = DEFAULT_ONION_SETTINGS;
    return { enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
        previous: typeof s.previous === 'boolean' ? s.previous : d.previous,
        next: typeof s.next === 'boolean' ? s.next : d.next,
        previousOpacity: clamp(s.previousOpacity, d.previousOpacity), nextOpacity: clamp(s.nextOpacity, d.nextOpacity),
        currentLayerOnly: typeof s.currentLayerOnly === 'boolean' ? s.currentLayerOnly : d.currentLayerOnly,
        previousCount: count(s.previousCount, d.previousCount), nextCount: count(s.nextCount, d.nextCount) };
}
export function onionNeighbors(project, settings) {
    if (!settings.enabled)
        return [];
    const frames = frameList(project), i = currentFrameIndex(project), result = [];
    // Farther ghosts are drawn first, closer ghosts stay clearer. Clamp counts
    // even for callers that did not pass settings through the UI sanitizer.
    for (let distance = count(settings.previousCount, 1); distance >= 1; distance--) {
        const j = i - distance;
        if (settings.previous && settings.previousOpacity > 0 && j >= 0)
            result.push({ kind: 'previous', frame: frames[j], index: j, opacity: settings.previousOpacity / 100 * Math.max(.35, 1 - .16 * (distance - 1)), color: '#e87986' });
    }
    for (let distance = count(settings.nextCount, 1); distance >= 1; distance--) {
        const j = i + distance;
        if (settings.next && settings.nextOpacity > 0 && j < frames.length)
            result.push({ kind: 'next', frame: frames[j], index: j, opacity: settings.nextOpacity / 100 * Math.max(.35, 1 - .16 * (distance - 1)), color: '#53bdde' });
    }
    return result;
}
