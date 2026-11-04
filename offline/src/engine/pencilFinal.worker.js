import { strokeRasterBounds } from './paintCompositing.js';
import { drawModernStroke } from './brushRaster.js';
// The pencil renderer only asks for scratch canvases. Saved rendering uses the
// same cropped mask and pixel conversion here, with worker-owned surfaces.
Object.defineProperty(globalThis, 'document', { value: { createElement: (tag) => { if (tag !== 'canvas')
            throw Error('Unsupported scratch element'); return new OffscreenCanvas(1, 1); } } });
const worker = self;
worker.onmessage = async ({ data: j }) => { try {
    const c = new OffscreenCanvas(j.width, j.height), ctx = c.getContext('2d', { willReadFrequently: true });
    drawModernStroke(ctx, j.stroke, 'final', j.geometry);
    const rect = strokeRasterBounds(j.stroke, j.width, j.height), bitmap = await createImageBitmap(c, rect.x, rect.y, rect.width, rect.height);
    worker.postMessage({ token: j.token, bitmap, rect }, [bitmap]);
    c.width = c.height = 0;
}
catch (error) {
    worker.postMessage({ token: j.token, error: String(error) });
} };
