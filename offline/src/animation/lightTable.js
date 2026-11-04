import { frameList } from './timeline.js';
export const MAX_LIGHT_TABLE_PINS = 5;
const bounded = (value, min, max, defaultValue) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : defaultValue;
export function sanitizeLightTablePins(project, raw) {
    if (!Array.isArray(raw))
        return [];
    const ids = new Set(frameList(project).map(frame => frame.id)), seen = new Set(), pins = [];
    for (const item of raw) {
        if (!item || typeof item.frameId !== 'string' || !ids.has(item.frameId) || seen.has(item.frameId))
            continue;
        seen.add(item.frameId);
        pins.push({ frameId: item.frameId, opacity: bounded(item.opacity, 0, 100, 38), dx: bounded(item.dx, -4096, 4096, 0), dy: bounded(item.dy, -4096, 4096, 0), scale: bounded(item.scale, .25, 4, 1), angle: bounded(item.angle, -180, 180, 0), tint: ['original', 'teal', 'red'].includes(item.tint) ? item.tint : 'original' });
        if (pins.length >= MAX_LIGHT_TABLE_PINS)
            break;
    }
    return pins;
}
export function toggleLightTablePin(project, previous, frameId) {
    const pins = sanitizeLightTablePins(project, previous);
    if (pins.some(pin => pin.frameId === frameId))
        return pins.filter(pin => pin.frameId !== frameId);
    if (pins.length >= MAX_LIGHT_TABLE_PINS)
        return pins;
    return [...pins, { frameId, opacity: 38, dx: 0, dy: 0, scale: 1, angle: 0, tint: 'original' }];
}
