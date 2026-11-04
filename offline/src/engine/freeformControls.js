export const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const edgeHandles = (corners) => corners.map((p, i) => midpoint(p, corners[(i + 1) % 4]));
export const rotationRadius = (center, top, zoom, corners = []) => (Math.max(22 / zoom, Math.hypot(top.x - center.x, top.y - center.y) + 20 / zoom, ...corners.map(p => Math.hypot(p.x - center.x, p.y - center.y) + 20 / zoom)));
export function freeformHit(point, corners, rotation, center, top, zoom, perspective = false) {
    const near = (p, px = 11) => Math.hypot(p.x - point.x, p.y - point.y) <= px / zoom;
    const corner = corners.findIndex(p => near(p));
    if (corner >= 0)
        return { kind: 'corner', index: corner };
    if (!perspective) {
        const edge = edgeHandles(corners).findIndex(p => near(p));
        if (edge >= 0)
            return { kind: 'edge', index: edge };
    }
    const radius = rotationRadius(center, top, zoom, corners);
    if (near(rotation, 14) || Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - radius) < 8 / zoom)
        return { kind: 'rotation' };
    return { kind: 'none' };
}
