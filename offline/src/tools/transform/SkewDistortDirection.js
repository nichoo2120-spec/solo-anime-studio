const norm = (v) => { const d = Math.hypot(v.x, v.y); return d > 1e-6 && Number.isFinite(d) ? { x: v.x / d, y: v.y / d } : null; };
/** Only cursor feedback: never limits the actual distortion geometry. */
export function deformDirection(quad, handle, delta, mode) {
    const moving = norm(delta);
    if (!moving)
        return null;
    if (handle.type === 'inside' || handle.type === 'pivot')
        return moving;
    if (handle.type === 'corner')
        return moving;
    if (handle.type === 'edge' && mode === 'skew') {
        const i = handle.index % 4, a = quad[i], b = quad[(i + 1) % 4];
        const tangent = norm({ x: b.x - a.x, y: b.y - a.y });
        if (!tangent)
            return moving;
        return tangent.x * moving.x + tangent.y * moving.y >= 0 ? tangent : { x: -tangent.x, y: -tangent.y };
    }
    return moving;
}
