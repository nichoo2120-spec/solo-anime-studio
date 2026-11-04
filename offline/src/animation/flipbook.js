import { currentFrameIndex, frameList } from './timeline.js';
export function flipCandidate(project, direction) {
    const frames = frameList(project), index = currentFrameIndex(project) + direction;
    return index >= 0 && index < frames.length ? frames[index] : null;
}
/** The preview represents the whole visible drawing, not just the active layer. */
export function flipVisibleLayers(project, frame) {
    return { ...project, animation: undefined, layers: project.layers.filter(l => l.visible && !l.reference)
            .map(l => ({ ...l, operations: frame.drawings[l.id] ?? [] })) };
}
