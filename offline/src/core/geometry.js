export function toScreen(p, v) { const c = Math.cos(v.rotation), s = Math.sin(v.rotation); return { x: v.x + (p.x * c - p.y * s) * v.zoom, y: v.y + (p.x * s + p.y * c) * v.zoom }; }
export function toProject(p, v) { const x = (p.x - v.x) / v.zoom, y = (p.y - v.y) / v.zoom, c = Math.cos(v.rotation), s = Math.sin(v.rotation); return { x: x * c + y * s, y: -x * s + y * c }; }
export function fitView(w, h, pw, ph, rotation = 0) { const c = Math.cos(rotation), s = Math.sin(rotation), rw = Math.abs(pw * c) + Math.abs(ph * s), rh = Math.abs(pw * s) + Math.abs(ph * c), zoom = Math.max(.02, Math.min((w - 90) / rw, (h - 90) / rh)); return { x: w / 2 - (pw * c - ph * s) * zoom / 2, y: h / 2 - (pw * s + ph * c) * zoom / 2, zoom, rotation }; }
export function transformMatrix(cx, cy, dx, dy, scale, angle, scaleY = scale) { const a = Math.cos(angle) * scale, b = Math.sin(angle) * scale, c = -Math.sin(angle) * scaleY, d = Math.cos(angle) * scaleY; return [a, b, c, d, cx + dx - a * cx - c * cy, cy + dy - b * cx - d * cy]; }
export function bounds(points) { let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity; for (const p of points) {
    x = Math.min(x, p.x);
    y = Math.min(y, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
} return { x, y, w: right - x, h: bottom - y }; }
export function pressureWidth(size, p, enabled, response) { return size * (enabled ? Math.max(.08, Math.pow(p, response)) : 1); }
