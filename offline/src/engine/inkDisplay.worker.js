import { drawSolidInkV10 } from './solidInkV10.js';
const worker = self;
/** Preserve paths, fill order and sampling. Only the cold final preview runs
 * here; the editable document has already been committed on the main thread. */
worker.onmessage = ({ data: j }) => {
    try {
        const out = new OffscreenCanvas(j.width, j.height), ctx = out.getContext('2d');
        ctx.drawImage(j.base, 0, 0);
        const scale = Math.hypot(j.matrix[0], j.matrix[1]), quality = Math.max(1, Math.ceil(scale * 2 - 1e-6) / 2);
        if (j.stroke.tool === 'brush' && j.stroke.opacity === 1) {
            ctx.setTransform(...j.matrix);
            drawSolidInkV10(ctx, j.stroke, j.geometry, undefined, quality);
        }
        else {
            const mask = new OffscreenCanvas(j.width, j.height), mc = mask.getContext('2d');
            mc.setTransform(...j.matrix);
            drawSolidInkV10(mc, j.stroke, j.geometry, undefined, quality);
            ctx.globalAlpha = j.stroke.opacity;
            ctx.globalCompositeOperation = j.stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.drawImage(mask, 0, 0);
            mask.width = mask.height = 0;
        }
        const bitmap = out.transferToImageBitmap();
        worker.postMessage({ token: j.token, bitmap }, [bitmap]);
        out.width = out.height = 0;
    }
    catch (error) {
        worker.postMessage({ token: j.token, error: String(error) });
    }
    finally {
        j.base.close();
    }
};
