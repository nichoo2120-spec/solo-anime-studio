import { paintSamples } from './paintPass.js';
import { paintDabs } from './paintDabs.js';
import { physicalPaintNib } from './paintNib.js';
import { coverageColorFilter } from './paintColorFilter.js';
let pooled, out;
/** Real textured contacts deposit pigment; no whole-stroke texture shader runs. */
export function drawPigmentBrush(ctx, s, g, region, pass) {
    const samples = pass?.samples ?? paintSamples(g, .18);
    if (!samples.points.length || s.flow === 0)
        return;
    const pad = s.size * .76 + 5;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const p of samples.points) {
        left = Math.min(left, p.x);
        top = Math.min(top, p.y);
        right = Math.max(right, p.x);
        bottom = Math.max(bottom, p.y);
    }
    const x = Math.max(0, Math.floor(Math.max(left - pad, region?.x ?? 0))), y = Math.max(0, Math.floor(Math.max(top - pad, region?.y ?? 0))), rx = Math.min(ctx.canvas.width, Math.ceil(Math.min(right + pad, region ? region.x + region.width : ctx.canvas.width))), by = Math.min(ctx.canvas.height, Math.ceil(Math.min(bottom + pad, region ? region.y + region.height : ctx.canvas.height))), w = rx - x, h = by - y;
    if (w <= 0 || h <= 0)
        return;
    const mask = pass?.mask ?? (pooled ??= document.createElement('canvas'));
    if (mask.width !== ctx.canvas.width)
        mask.width = ctx.canvas.width;
    if (mask.height !== ctx.canvas.height)
        mask.height = ctx.canvas.height;
    const mc = mask.getContext('2d');
    mc.save();
    mc.globalCompositeOperation = 'source-over';
    mc.globalAlpha = 1;
    if (!pass?.append) {
        mc.fillStyle = '#000';
        mc.fillRect(x, y, w, h);
        if (pass?.base)
            mc.drawImage(pass.base, x, y, w, h, x, y, w, h);
    }
    mc.beginPath();
    mc.rect(x, y, w, h);
    mc.clip();
    mc.globalCompositeOperation = 'source-over';
    const from = pass?.from ? samples.arc[pass.from - 1] : 0, to = pass ? samples.arc[Math.max(0, pass.to - 1)] : samples.total;
    for (const d of paintDabs(s, samples)) {
        if ((pass?.from ? d.arc <= from + 1e-7 : d.arc < from - 1e-7) || d.arc > to + 1e-7 || pass?.append && d.tail || d.radius < .001 || !d.level || d.x + d.radius * 1.5 < x || d.x - d.radius * 1.5 > rx || d.y + d.radius * 1.5 < y || d.y - d.radius * 1.5 > by)
            continue;
        const nib = physicalPaintNib(s, d.arc, d.level);
        mc.save();
        mc.translate(d.x, d.y);
        mc.rotate(d.angle);
        mc.drawImage(nib.gray, -d.radius, -d.radius, d.radius * 2, d.radius * 2);
        mc.restore();
    }
    mc.restore();
    if (pass?.append)
        return;
    const filter = coverageColorFilter(s.color);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (filter) {
        ctx.filter = filter;
        ctx.drawImage(mask, x, y, w, h, x, y, w, h);
    }
    else {
        const image = mc.getImageData(x, y, w, h), rgb = s.color.slice(1).match(/../g).map(n => parseInt(n, 16));
        for (let i = 0; i < image.data.length; i += 4) {
            const a = image.data[i];
            image.data[i] = rgb[0];
            image.data[i + 1] = rgb[1];
            image.data[i + 2] = rgb[2];
            image.data[i + 3] = a;
        }
        const c = out ??= document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').putImageData(image, 0, 0);
        ctx.drawImage(c, x, y);
    }
    ctx.restore();
}
