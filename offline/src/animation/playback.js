import { frameHold, frameList } from './timeline.js';
export const PLAYBACK_FPS_MIN = 1;
export const PLAYBACK_FPS_MAX = 60;
export function playbackFps(value) {
    return Number.isFinite(value) ? Math.min(PLAYBACK_FPS_MAX, Math.max(PLAYBACK_FPS_MIN, Math.round(value))) : 24;
}
/** Cumulative exclusive ends: [2,5] means cel A covers 1–2 and B covers 3–5. */
export function exposurePlan(project) {
    const ends = [];
    let total = 0;
    for (const frame of frameList(project)) {
        total += frameHold(frame);
        ends.push(total);
    }
    return { ends, total };
}
export function positionAtExposure(plan, oneBased) {
    const exposure = Math.max(1, Math.min(plan.total, Math.floor(oneBased) || 1));
    let low = 0, high = plan.ends.length - 1;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (exposure <= plan.ends[mid])
            high = mid;
        else
            low = mid + 1;
    }
    return { exposure, celIndex: low, ended: false };
}
/** Use elapsed wall-clock time instead of counting animation callbacks. Slow displays
 * never change the project's timing or duplicate held drawings. */
export function positionAtElapsed(plan, startExposure, elapsedMs, fps, loop) {
    const steps = Math.max(0, Math.floor(Math.max(0, elapsedMs) * playbackFps(fps) / 1000));
    const raw = Math.max(0, Math.min(plan.total - 1, Math.floor(startExposure) - 1)) + steps;
    const ended = !loop && raw >= plan.total;
    const zeroBased = loop ? raw % plan.total : Math.min(plan.total - 1, raw);
    return { ...positionAtExposure(plan, zeroBased + 1), ended };
}
