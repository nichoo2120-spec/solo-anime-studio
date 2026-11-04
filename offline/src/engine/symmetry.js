export const mirrorPivot = (s, p) => ({ x: (s.pivot?.x ?? s.center) * p.width, y: (s.pivot?.y ?? s.center) * p.height });
export function mirrorMatrix(s, p) { const pivot = mirrorPivot(s, p); return s.axis === 'vertical' ? [-1, 0, 0, 1, 2 * pivot.x, 0] : [1, 0, 0, -1, 0, 2 * pivot.y]; }
/** Reflect the finished pigment, not a new path through a different paper field. */
export function reflectedStroke(s, matrix, id) { return { ...s, id, transform: [...matrix], rasterTransformVersion: 1, rasterSourceId: s.rasterSourceId ?? s.id }; }
