import { flattenCubic, pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse, opacityResponse } from './pressureChannels.js';
import { getPaintNib, paintSpacing, paintStampVariant } from './paintNibs.js';
let workingMask;
/** New paint revision. Prior engine revisions are rendered unchanged. */
export function drawPaintStroke(ctx, stroke, geometry, region) {
    const kind = stroke.brushKind;
    const points = geometry.cubics.length ? geometry.cubics.flatMap((curve, i) => flattenCubic(curve).slice(i ? 1 : 0)) : geometry.points;
    if (!points.length)
        return;
    const pad = stroke.size * 1.6 + 4;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const x = Math.max(0, region?.x ?? 0, Math.floor(minX - pad)), y = Math.max(0, region?.y ?? 0, Math.floor(minY - pad));
    const maxClipX = Math.min(ctx.canvas.width, region ? region.x + region.width : ctx.canvas.width);
    const maxClipY = Math.min(ctx.canvas.height, region ? region.y + region.height : ctx.canvas.height);
    const w = Math.max(0, Math.min(maxClipX, Math.ceil(maxX + pad)) - x), h = Math.max(0, Math.min(maxClipY, Math.ceil(maxY + pad)) - y);
    if (w === 0 || h === 0)
        return;
    const tile = workingMask ??= document.createElement('canvas');
    if (tile.width !== ctx.canvas.width)
        tile.width = ctx.canvas.width;
    if (tile.height !== ctx.canvas.height)
        tile.height = ctx.canvas.height;
    const mask = tile.getContext('2d', { willReadFrequently: true });
    mask.save();
    mask.globalCompositeOperation = 'source-over';
    mask.globalAlpha = 1;
    mask.fillStyle = '#000';
    mask.fillRect(x, y, w, h);
    mask.beginPath();
    mask.rect(x, y, w, h);
    mask.clip();
    mask.globalCompositeOperation = kind === 'watercolor' ? 'lighter' : 'lighten';
    mask.globalAlpha = kind === 'watercolor' ? .12 : 1;
    // Dense enough to avoid visible stamp seams; still far fewer dabs than
    // the revision-6 subpixel gradient path for broad paint brushes.
    const spacing = kind === 'airbrush' ? Math.min(2.6, paintSpacing(stroke.size)) : kind === 'watercolor' ? Math.min(2.3, paintSpacing(stroke.size)) : paintSpacing(stroke.size);
    let total = 0;
    for (let i = 1; i < points.length; i++)
        total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    let along = 0, stamp = 0;
    function dab(a, b, t, angle, distanceAlong) {
        const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
        if (px < x - pad || px > x + w + pad || py < y - pad || py > y + h + pad)
            return;
        const measured = a.p + (b.p - a.p) * t;
        const response = stroke.pressure ? pressureResponse(Math.pow(measured, stroke.response), stroke.pressureCurve) : 1;
        const velocity = stroke.velocityTaper ? (a.v ?? 1) + ((b.v ?? 1) - (a.v ?? 1)) * t : 1;
        const varying = stroke.pressure && stroke.pressureWidth !== false || !!stroke.velocityTaper;
        const taper = taperFactor(distanceAlong, total, stroke.taperStart, stroke.taperEnd, Math.max(64, stroke.size * 12));
        const radius = stroke.size * .5 * (varying ? widthResponse(response * velocity, stroke) : 1) * taper;
        if (radius < .08)
            return;
        const opacity = stroke.pressure && stroke.pressureOpacity ? opacityResponse(response, stroke) : 1;
        const intensity = 255 * opacity;
        const nib = getPaintNib(kind, intensity, paintStampVariant(distanceAlong, spacing));
        const halfWidth = radius * (kind === 'dry-grain' ? 1.65 : 1.0);
        const halfHeight = radius * (kind === 'dry-grain' ? .92 : 1.0);
        if (kind === 'dry-grain') {
            mask.save();
            mask.translate(px, py);
            mask.rotate(angle);
            mask.drawImage(nib, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
            mask.restore();
        }
        else
            mask.drawImage(nib, px - halfWidth, py - halfHeight, halfWidth * 2, halfHeight * 2);
    }
    if (points.length === 1)
        dab(points[0], points[0], 0, 0, 0);
    else {
        let next = 0, prevAngle = 0;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
            if (length <= 1e-6)
                continue;
            const angle = Math.atan2(b.y - a.y, b.x - a.x);
            prevAngle = angle;
            if (region && (Math.max(a.x, b.x) < x - pad || Math.min(a.x, b.x) > x + w + pad || Math.max(a.y, b.y) < y - pad || Math.min(a.y, b.y) > y + h + pad)) {
                along += length;
                continue;
            }
            if (next < along)
                next = Math.ceil(along / spacing) * spacing;
            while (next <= along + length + 1e-6) {
                dab(a, b, Math.min(1, (next - along) / length), angle, next);
                stamp++;
                next += spacing;
            }
            along += length;
        }
        // Make sure quick dots/very short flicks are represented.
        if (stamp === 0)
            dab(points[0], points.at(-1), 1, prevAngle, total);
    }
    // A very light continuous wash supports the blotchy watercolor perimeter.
    // Limit its diameter by the lightest sample so thin-pressure strokes stay thin.
    if (kind === 'watercolor' && points.length > 1) {
        mask.globalAlpha = 1;
        mask.globalCompositeOperation = 'lighten';
        const least = stroke.pressure && stroke.pressureWidth !== false ? points.reduce((a, p) => Math.min(a, p.p), 1) : 1;
        const opacity = stroke.pressure && stroke.pressureOpacity ? points.reduce((a, p) => Math.min(a, p.p), 1) : 1;
        const wash = Math.round(51 * opacity);
        if (wash > 1) {
            mask.strokeStyle = `rgb(${wash} ${wash} ${wash})`;
            mask.lineWidth = Math.max(.1, stroke.size * .48 * least);
            mask.lineCap = 'round';
            mask.lineJoin = 'round';
            mask.beginPath();
            mask.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++)
                mask.lineTo(points[i].x, points[i].y);
            mask.stroke();
        }
    }
    mask.restore();
    const pixels = mask.getImageData(x, y, w, h), rgba = pixels.data, red = parseInt(stroke.color.slice(1, 3), 16), green = parseInt(stroke.color.slice(3, 5), 16), blue = parseInt(stroke.color.slice(5, 7), 16);
    const texture = Math.max(0, Math.min(1, stroke.textureStrength ?? 0));
    // Keep paper grain locked to *document* pixels as the live stroke grows.
    for (let i = 0; i < rgba.length; i += 4) {
        let alpha = rgba[i];
        if (!alpha) {
            rgba[i + 3] = 0;
            continue;
        }
        if (kind !== 'airbrush') {
            const px = x + (i >> 2) % w, py = y + Math.floor((i >> 2) / w);
            let hash = Math.imul(Math.floor(px * 1.7), 374761393) ^ Math.imul(Math.floor(py * 1.7), 668265263);
            hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
            const grain = ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
            if (kind === 'dry-grain') {
                // Sparse paint trapped in canvas tooth; preserve bristle gaps even in
                // overlapping stamps to avoid a featureless smooth marker line.
                const fiber = Math.sin(py * .91 - px * .26), chunk = Math.sin(px * .18 + py * .39);
                const holes = fiber < -.55 ? .78 : chunk < -.82 ? .58 : .15 + .3 * (1 - grain);
                alpha *= 1 - texture * holes;
            }
            else {
                const bloom = .5 + .25 * Math.sin(px * .071 + py * .091) + .25 * Math.sin(px * .124 - py * .064);
                alpha *= 1 - texture * (.1 + .45 * (1 - grain)) + (bloom - .5) * texture * 27;
            }
        }
        rgba[i] = red;
        rgba[i + 1] = green;
        rgba[i + 2] = blue;
        rgba[i + 3] = Math.max(0, Math.min(255, Math.round(alpha)));
    }
    mask.putImageData(pixels, x, y);
    ctx.drawImage(tile, x, y, w, h, x, y, w, h);
}
