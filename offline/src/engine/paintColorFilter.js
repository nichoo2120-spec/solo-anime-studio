const ns = 'http://www.w3.org/2000/svg';
let supported, root;
const filters = new Map();
function filter(color) {
    let found = filters.get(color);
    if (found)
        return found;
    if (!root) {
        root = document.createElementNS(ns, 'svg');
        root.setAttribute('aria-hidden', 'true');
        root.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.append(root);
    }
    const id = 'solo-paint-color-' + color.slice(1), element = document.createElementNS(ns, 'filter'), matrix = document.createElementNS(ns, 'feColorMatrix');
    element.id = id;
    element.setAttribute('color-interpolation-filters', 'sRGB');
    const rgb = color.slice(1).match(/../g).map(n => parseInt(n, 16) / 255);
    matrix.setAttribute('type', 'matrix');
    matrix.setAttribute('values', `0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} 1 0 0 0 0`);
    element.append(matrix);
    root.append(element);
    found = `url(#${id})`;
    filters.set(color, found);
    if (filters.size > 128) {
        const oldest = filters.keys().next().value;
        document.getElementById('solo-paint-color-' + oldest.slice(1))?.remove();
        filters.delete(oldest);
    }
    return found;
}
/** Convert opaque grayscale coverage to colored alpha on the canvas backend.
 * A tiny capability check selects the original pixel route when SVG canvas
 * filters are unavailable. Existing saved renderers always retain that route. */
export function paintColorFilter(s) {
    if (s.paintTipVersion !== 1 && (s.liveRefinementVersion !== 3 || s.textureStrength || !['paint', 'marker', 'eraser-soft'].includes(s.brushKind ?? '')))
        return;
    return coverageColorFilter(s.color);
}
export function coverageColorFilter(color) {
    if (supported === undefined) {
        try {
            const a = document.createElement('canvas'), b = document.createElement('canvas');
            a.width = a.height = b.width = b.height = 2;
            const ac = a.getContext('2d'), bc = b.getContext('2d');
            ac.fillStyle = '#808080';
            ac.fillRect(0, 0, 2, 2);
            bc.filter = filter('#ff0000');
            bc.drawImage(a, 0, 0);
            const p = bc.getImageData(0, 0, 1, 1).data;
            supported = p[0] === 255 && p[1] === 0 && p[2] === 0 && p[3] === 128;
        }
        catch {
            supported = false;
        }
    }
    return supported ? filter(color) : undefined;
}
