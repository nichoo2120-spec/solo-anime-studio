const clamp = (x) => Math.max(0, Math.min(1, x));
const canvas = () => document.createElement('canvas');
let sample, tiny, blur, masked;
function fit(c, w, h) { if (c.width !== w)
    c.width = w; if (c.height !== h)
    c.height = h; }
export function applyNativeBrushMix(ctx, mask, s, sourceX = 0, sourceY = 0, dirty, base) {
    if (s.nativeMixVersion !== 1 && s.nativeMixVersion !== 2 || s.tool === 'eraser')
        return;
    sample ??= canvas();
    tiny ??= canvas();
    blur ??= canvas();
    masked ??= canvas();
    const amount = clamp(s.nativeMixAmount ?? .58) * clamp(s.opacity);
    if (amount <= 0)
        return;
    const surface = base ?? ctx.canvas;
    const rect = dirty ?? { x: 0, y: 0, width: ctx.canvas.width, height: ctx.canvas.height };
    const x = Math.max(0, Math.floor(rect.x)), y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(ctx.canvas.width, Math.ceil(rect.x + rect.width)), bottom = Math.min(ctx.canvas.height, Math.ceil(rect.y + rect.height));
    const w = right - x, h = bottom - y;
    if (w <= 0 || h <= 0)
        return;
    // The sample halo prevents seams where a dirty tile crosses a colour edge.
    const radius = s.nativeMixVersion === 2 ? Math.max(4, Math.min(48, s.size * (s.nativeMixRadius ?? .5) * .76)) : Math.max(2, Math.min(30, s.size * (s.nativeMixRadius ?? .5) * .38));
    const pad = Math.ceil(radius * 1.5) + 2;
    const sx = Math.max(0, x - pad), sy = Math.max(0, y - pad), ex = Math.min(ctx.canvas.width, right + pad), ey = Math.min(ctx.canvas.height, bottom + pad), sw = ex - sx, sh = ey - sy;
    fit(sample, sw, sh);
    const sc = sample.getContext('2d');
    sc.clearRect(0, 0, sw, sh);
    sc.drawImage(surface, sx, sy, sw, sh, 0, 0, sw, sh);
    // New v2 Mix uses an actual local blur kernel. The old two-resampling
    // approximation had almost no visible effect away from an exact hard edge.
    // Keep v1 unchanged for pixel-identical loading of earlier Mix strokes.
    fit(blur, w, h);
    const bc = blur.getContext('2d');
    bc.clearRect(0, 0, w, h);
    if (s.nativeMixVersion === 2 && 'filter' in bc) {
        bc.save();
        bc.filter = `blur(${Math.max(2, radius * .6)}px)`;
        bc.drawImage(sample, sx - x, sy - y);
        bc.restore();
    }
    else {
        const step = Math.max(2, Math.min(18, Math.round(radius * .7)));
        const tw = Math.max(1, Math.ceil(sw / step)), th = Math.max(1, Math.ceil(sh / step));
        fit(tiny, tw, th);
        const tc = tiny.getContext('2d');
        tc.clearRect(0, 0, tw, th);
        tc.imageSmoothingEnabled = true;
        tc.drawImage(sample, 0, 0, sw, sh, 0, 0, tw, th);
        bc.imageSmoothingEnabled = true;
        bc.drawImage(tiny, 0, 0, tw, th, sx - x, sy - y, sw, sh);
    }
    // Clip blurred pigment to the *actual* native brush texture and pressure.
    fit(masked, w, h);
    const mc = masked.getContext('2d');
    mc.clearRect(0, 0, w, h);
    mc.drawImage(blur, 0, 0);
    mc.globalCompositeOperation = 'destination-in';
    mc.drawImage(mask, sourceX - x, sourceY - y);
    mc.globalCompositeOperation = 'source-over';
    // Apply from an immutable base in a worker; synchronous replay uses the layer
    // before this stroke as its base. Preserve the original coverage/alpha.
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(sample, x - sx, y - sy, w, h, x, y, w, h);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = amount;
    ctx.drawImage(masked, x, y);
    ctx.restore();
}
