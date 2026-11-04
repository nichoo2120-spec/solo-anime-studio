import { move } from './Move.js';
import { skew } from './Skew.js';
import { cloneQuad } from '../math/matrix.js';
import { quadValid } from '../math/homography.js';
/** Four-point, editable 2D perspective: corners reshape, sides skew, inside moves.
 *  Shift+corner makes a symmetric keystone (opposite corner moves in reverse).
 *  When angle snapping is enabled, constrain the corner drag direction from its
 *  original down position. Do not permit inverted/bow-tie quads during preview.
 */
export const perspective = (s, d, p, k) => {
    if (d.handle.type === 'inside') {
        move(s, d, p, k);
        return;
    }
    if (d.handle.type === 'edge') {
        skew(s, d, p, k);
        return;
    }
    if (d.handle.type !== 'corner')
        return;
    const i = d.handle.index;
    let dx = p.x - d.point.x, dy = p.y - d.point.y;
    if (s.perspectiveSnap) {
        const radius = Math.hypot(dx, dy);
        if (radius > 0) {
            const step = s.perspectiveSnap * Math.PI / 180;
            const angle = Math.round(Math.atan2(dy, dx) / step) * step;
            dx = Math.cos(angle) * radius;
            dy = Math.sin(angle) * radius;
        }
    }
    const next = cloneQuad(d.quad);
    next[i] = { x: d.quad[i].x + dx, y: d.quad[i].y + dy };
    if (k.shift) {
        const opposite = (i + 2) % 4;
        next[opposite] = { x: d.quad[opposite].x - dx, y: d.quad[opposite].y - dy };
    }
    if (quadValid(next))
        s.quad = next;
};
