import { strokeGeometry } from './strokeGeometry.js';
import { drawSolidInkV10 } from './solidInkV10.js';
import { drawFlatInk } from './flatInk.js';
const layers = new Map();
const native = (s) => !s.pressureOpacity && !s.taperStart && !s.taperEnd && !(s.pressure && s.pressureWidth !== false) && !s.velocityTaper && ['technical', 'eraser-hard'].includes(s.brushKind ?? 'technical');
function draw(ctx, s) {
    const g = strokeGeometry(s);
    if (!g.points.length)
        return;
    ctx.save();
    if (s.transform)
        ctx.transform(...s.transform);
    if (native(s)) {
        ctx.fillStyle = ctx.strokeStyle = s.color;
        const p = new Path2D();
        if (!g.cubics.length) {
            p.arc(g.points[0].x, g.points[0].y, s.size / 2, 0, Math.PI * 2);
            ctx.fill(p);
        }
        else {
            p.moveTo(g.points[0].x, g.points[0].y);
            for (const c of g.cubics)
                p.bezierCurveTo(c.c1.x, c.c1.y, c.c2.x, c.c2.y, c.b.x, c.b.y);
            ctx.lineWidth = s.size;
            ctx.lineCap = ctx.lineJoin = 'round';
            ctx.stroke(p);
        }
    }
    else {
        const paths = [];
        if (s.flatNibVersion === 1)
            drawFlatInk(ctx, s, g, undefined, 1, paths);
        else
            drawSolidInkV10(ctx, s, g, undefined, 1, paths);
        ctx.fillStyle = s.color;
        for (const p of paths)
            ctx.fill(p);
    }
    ctx.restore();
}
/** Retain native clean-ink layers; an appended stroke never rebuilds their prefix. */
self.onmessage = async ({ data: j }) => {
    try {
        let out = layers.get(j.layer);
        if (j.append && (!out || out.width !== j.width || out.height !== j.height)) {
            self.postMessage({ token: j.token, rebuild: true });
            return;
        }
        if (!j.append) {
            if (out)
                out.width = out.height = 0;
            out = new OffscreenCanvas(j.width, j.height);
            layers.set(j.layer, out);
            if (j.base)
                out.getContext('2d').drawImage(j.base, 0, 0);
        }
        const ctx = out.getContext('2d');
        let mask;
        for (const s of j.parts) {
            if (!s.opacity)
                continue;
            if (native(s) || s.tool === 'brush' && s.opacity === 1) {
                ctx.globalAlpha = s.opacity;
                ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
                draw(ctx, s);
            }
            else {
                mask ??= new OffscreenCanvas(j.width, j.height);
                const mc = mask.getContext('2d');
                mc.clearRect(0, 0, j.width, j.height);
                draw(mc, s);
                ctx.globalAlpha = s.opacity;
                ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
                ctx.drawImage(mask, 0, 0);
            }
        }
        if (mask)
            mask.width = mask.height = 0;
        layers.delete(j.layer);
        layers.set(j.layer, out);
        let bytes = 0;
        for (const c of layers.values())
            bytes += c.width * c.height * 4;
        while (layers.size > 1 && (layers.size > 4 || bytes > 64 * 1024 * 1024)) {
            const key = layers.keys().next().value, c = layers.get(key);
            bytes -= c.width * c.height * 4;
            c.width = c.height = 0;
            layers.delete(key);
        }
        const bitmap = await createImageBitmap(out);
        self.postMessage({ token: j.token, bitmap }, [bitmap]);
    }
    catch (error) {
        self.postMessage({ token: j.token, error: String(error) });
    }
    finally {
        j.base?.close();
    }
};
