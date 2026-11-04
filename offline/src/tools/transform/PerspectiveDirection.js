/**
 * Perspective cursor feedback is only a drawing aid. It does not constrain the
 * warp or change the user's pointer position. Quantise the movement to the
 * *current plane's* locally projected axes, never to screen X/Y compass bins.
 * Keeping the geometry pure also allows testing without React or Canvas.
 */
const EPS = 1e-7;
const normal = (v) => {
    const length = Math.hypot(v.x, v.y);
    return length > EPS && Number.isFinite(length) ? { x: v.x / length, y: v.y / length } : null;
};
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const neg = (a) => ({ x: -a.x, y: -a.y });
function planeDirections(a, b) {
    const u = normal(a), v = normal(b);
    if (!u)
        return v ? [v, neg(v)] : [];
    if (!v)
        return [u, neg(u)];
    const diagonals = [normal(add(u, v)), normal(subtract(u, v))].filter((d) => !!d);
    return [u, neg(u), v, neg(v), ...diagonals.flatMap(d => [d, neg(d)])];
}
/**
 * Corners use their two slanted adjoining edges. Side handles follow the
 * actual slanted side; the centre uses the two averaged plane axes. Direction
 * is driven by recent pen motion, so reversing direction reverses the arrow.
 */
export function perspectiveArrowDirection(quad, handle, movement) {
    const moving = normal(movement);
    if (!moving)
        return null;
    let candidates = [];
    if (handle.type === 'corner') {
        const i = handle.index % 4;
        candidates = planeDirections(subtract(quad[(i + 1) % 4], quad[i]), subtract(quad[(i + 3) % 4], quad[i]));
    }
    else if (handle.type === 'edge') {
        const i = handle.index % 4, tangent = normal(subtract(quad[(i + 1) % 4], quad[i]));
        // Side/skew mode travels along the tilted visible edge, not screen up/down.
        if (tangent)
            candidates = [tangent, neg(tangent)];
    }
    else if (handle.type === 'inside') {
        const horiz = add(subtract(quad[1], quad[0]), subtract(quad[2], quad[3]));
        const vert = add(subtract(quad[3], quad[0]), subtract(quad[2], quad[1]));
        candidates = planeDirections(horiz, vert);
    }
    if (!candidates.length)
        return null;
    let winner = candidates[0], best = -Infinity;
    for (const direction of candidates) {
        const match = direction.x * moving.x + direction.y * moving.y;
        if (match > best) {
            best = match;
            winner = direction;
        }
    }
    return winner;
}
