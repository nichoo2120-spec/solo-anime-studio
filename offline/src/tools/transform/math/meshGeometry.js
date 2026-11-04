const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
const copy = (p) => ({ x: p.x, y: p.y });
/** Build regular mesh topology. Rows and columns count cells, not handles. */
export function createRegularMesh(area, rows, cols) {
    if (!finite(area) || !Number.isFinite(area.w) || !Number.isFinite(area.h) || area.w <= 0 || area.h <= 0)
        throw Error('Invalid mesh bounds');
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 64 || cols > 64)
        throw Error('Invalid mesh density');
    const vertices = [];
    for (let y = 0; y <= rows; y++)
        for (let x = 0; x <= cols; x++) {
            const u = x / cols, v = y / rows, source = { x: area.x + area.w * u, y: area.y + area.h * v };
            vertices.push({ source: Object.freeze(source), uv: Object.freeze({ x: u, y: v }), destination: copy(source), locked: false });
        }
    const faces = [];
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
            const a = y * (cols + 1) + x, b = a + 1, d = a + cols + 1, c = d + 1;
            faces.push([a, b, c], [a, c, d]);
        }
    return { vertices, faces };
}
/** Clones the editable vertex state but preserves the original source and topology. */
export function copyMesh(mesh) {
    return { vertices: mesh.vertices.map(v => ({ source: v.source, uv: v.uv, destination: copy(v.destination), locked: v.locked })), faces: mesh.faces };
}
/** Move destination only. The original coordinates are never rewritten. */
export function moveVertex(mesh, index, target) {
    const v = mesh.vertices[index];
    if (!v || v.locked || !finite(target))
        return false;
    v.destination = copy(target);
    return true;
}
export function validateMesh(mesh) {
    const issues = [];
    mesh.faces.forEach(([i, j, k], face) => {
        if (![i, j, k].every(n => Number.isInteger(n) && n >= 0 && n < mesh.vertices.length) || new Set([i, j, k]).size !== 3) {
            issues.push({ face, reason: 'invalid-index' });
            return;
        }
        const a = mesh.vertices[i], b = mesh.vertices[j], c = mesh.vertices[k];
        if (![a.source, b.source, c.source, a.destination, b.destination, c.destination].every(finite)) {
            issues.push({ face, reason: 'non-finite' });
            return;
        }
        const sourceArea = cross(a.source, b.source, c.source), targetArea = cross(a.destination, b.destination, c.destination);
        if (Math.abs(sourceArea) < 1e-7) {
            issues.push({ face, reason: 'degenerate-source' });
            return;
        }
        if (sourceArea * targetArea <= 1e-10)
            issues.push({ face, reason: 'folded-destination' });
    });
    return issues;
}
/** Barycentric inverse-map for a destination pixel; null outside all faces.
 * A renderer samples the ORIGINAL bitmap at the returned coordinate.
 */
export function sourceAt(mesh, p) {
    if (!finite(p))
        return null;
    for (const [ia, ib, ic] of mesh.faces) {
        const va = mesh.vertices[ia], vb = mesh.vertices[ib], vc = mesh.vertices[ic];
        if (!va || !vb || !vc)
            continue;
        const a = va.destination, b = vb.destination, c = vc.destination, denom = cross(a, b, c);
        if (!Number.isFinite(denom) || Math.abs(denom) < 1e-10)
            continue;
        const wb = cross(a, p, c) / denom, wc = cross(a, b, p) / denom, wa = 1 - wb - wc;
        if (wa >= -1e-8 && wb >= -1e-8 && wc >= -1e-8) {
            return { x: wa * va.source.x + wb * vb.source.x + wc * vc.source.x, y: wa * va.source.y + wb * vb.source.y + wc * vc.source.y };
        }
    }
    return null;
}
/** Geometry-only validation of an undeformed identity mesh. */
export function isIdentityMesh(mesh, tolerance = 1e-8) {
    return mesh.vertices.every(v => Math.hypot(v.destination.x - v.source.x, v.destination.y - v.source.y) <= tolerance);
}
