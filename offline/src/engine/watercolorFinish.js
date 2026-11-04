import { watercolorMaterial, materialPaperField, materialBloomField, materialDensity, waterSmooth } from './watercolorMaterial.js';
import { joinWaterFront } from './watercolorFront.js';
import { watercolorField, WATER_TILE, erodeFineWatercolor } from './watercolorPaper.js';
let source, fine, downsampled, shaded;
let warped = new Float32Array(0), horizontal = new Float32Array(0);
/** Process only the changed region. Water-front variation is sampled in
 * document space before edge pooling, so the silhouette is slightly organic
 * without printing a texture or a separate dark ring onto each dab. */
export function finishWatercolor(ctx, s, mask, x, y, w, h, grayCoverage = false, pigment) {
    const material = s.watercolorMaterialVersion ? watercolorMaterial(s) : undefined;
    if (s.size <= 24 && !pigment) {
        const c = fine ??= document.createElement('canvas');
        if (c.width !== w)
            c.width = w;
        if (c.height !== h)
            c.height = h;
        const cc = c.getContext('2d');
        cc.save();
        cc.clearRect(0, 0, w, h);
        cc.globalAlpha = material ? Math.min(1, material.mass * .84) : .72;
        cc.drawImage(mask, x, y, w, h, 0, 0, w, h);
        cc.globalAlpha = 1;
        cc.globalCompositeOperation = 'source-in';
        cc.fillStyle = s.color;
        cc.fillRect(0, 0, w, h);
        erodeFineWatercolor(cc, (s.watercolorVersion ?? 0) >= 2 ? 0 : s.textureStrength ?? 0, x, y, w, h);
        cc.restore();
        ctx.drawImage(c, x, y);
        return;
    }
    // Broad watercolor has a water-softened boundary; process that field at a
    // fixed three-document-pixel grid. Fine brushes/liners keep native resolution.
    // World alignment makes both resolutions deterministic under cropped replay.
    const scale = s.size >= 96 ? 3 : 1, radius = Math.max(1, Math.min(3, Math.round(s.size * .012 / scale))), gain = Math.min(2.6, s.size / 42) * ((s.watercolorVersion ?? 0) >= 2 ? (s.pigmentPooling ?? .55) : 1), spread = (material ? Math.min(8, s.size * .025 * material.spread) : s.watercolorVersion === 3 ? Math.min(s.watercolorStyle === 'bloom' ? 5 : 3, s.size * (s.watercolorStyle === 'bloom' ? .045 : .025)) : Math.min(2.2, s.size * .014)) / scale, closure = s.size > 24 && s.watercolorVersion === 3 && s.brushTip !== 'wash-liner' ? Math.max(1, Math.min(6, Math.round(s.size * .085 / scale))) : 0, halo = (radius + Math.ceil(spread) + 4 + closure * 2) * scale;
    const sx = Math.max(0, Math.floor((x - halo) / scale) * scale), sy = Math.max(0, Math.floor((y - halo) / scale) * scale), right = Math.ceil(Math.min(mask.width, x + w + halo) / scale) * scale, bottom = Math.ceil(Math.min(mask.height, y + h + halo) / scale) * scale, cw = (right - sx) / scale, ch = (bottom - sy) / scale, count = cw * ch;
    const c = source ??= document.createElement('canvas');
    if (c.width !== cw)
        c.width = cw;
    if (c.height !== ch)
        c.height = ch;
    const cc = c.getContext('2d', { willReadFrequently: true });
    let image;
    if (scale > 1) {
        // Keep the resampling matrix anchored to the complete document. Scaling
        // independently cropped rectangles by 1/3 produces tiny platform rounding
        // differences that can otherwise change pixels between live/saved replay.
        const down = downsampled ??= document.createElement('canvas');
        const dw = Math.ceil(mask.width / scale), dh = Math.ceil(mask.height / scale);
        if (down.width !== dw)
            down.width = dw;
        if (down.height !== dh)
            down.height = dh;
        const dc = down.getContext('2d', { willReadFrequently: true });
        if (pigment) {
            dc.save();
            dc.beginPath();
            dc.rect(sx / scale, sy / scale, cw, ch);
            dc.clip();
        }
        dc.clearRect(0, 0, dw, dh);
        dc.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, mask.width / scale, mask.height / scale);
        if (pigment)
            dc.restore();
        image = dc.getImageData(sx / scale, sy / scale, cw, ch);
    }
    else {
        cc.clearRect(0, 0, cw, ch);
        cc.drawImage(mask, sx, sy, right - sx, bottom - sy, 0, 0, cw, ch);
        image = cc.getImageData(0, 0, cw, ch);
    }
    const data = image.data;
    pigment?.prepare(sx, sy, right - sx, bottom - sy);
    if (grayCoverage)
        for (let i = 0; i < data.length; i += 4)
            data[i + 3] = data[i];
    if (warped.length < count) {
        warped = new Float32Array(count);
        horizontal = new Float32Array(count);
    }
    if (closure)
        joinWaterFront(data, cw, ch, closure, warped, horizontal);
    warped.fill(0, 0, count);
    horizontal.fill(0, 0, count);
    // Skip empty 16px blocks, especially important for a small liner sweeping a
    // large bounding rectangle. Include neighboring blocks for warp/erosion.
    const blockShift = pigment ? 2 : 4, blockSize = 1 << blockShift, blockMask = blockSize - 1, columns = Math.ceil(cw / blockSize), rows = Math.ceil(ch / blockSize), occupied = new Uint8Array(columns * rows), active = new Uint8Array(columns * rows);
    for (let row = 0; row < ch; row++)
        for (let col = 0; col < cw; col++)
            if (data[(row * cw + col) * 4 + 3])
                occupied[(row >>> blockShift) * columns + (col >>> blockShift)] = 1;
    for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++)
            if (occupied[row * columns + col])
                for (let yy = Math.max(0, row - 1); yy <= Math.min(rows - 1, row + 1); yy++)
                    for (let xx = Math.max(0, col - 1); xx <= Math.min(columns - 1, col + 1); xx++)
                        active[yy * columns + xx] = 1;
    const blocks = [];
    for (let ty = Math.floor(sy / WATER_TILE); ty * WATER_TILE < bottom; ty++)
        for (let tx = Math.floor(sx / WATER_TILE); tx * WATER_TILE < right; tx++)
            blocks.push({ data: watercolorField(tx, ty), material: material && !pigment ? materialPaperField(tx, ty) : undefined, bloom: material?.backrun && !pigment ? materialBloomField(tx, ty, s.watercolorSeed ?? 0) : undefined, left: Math.max(sx, tx * WATER_TILE), top: Math.max(sy, ty * WATER_TILE), right: Math.min(right, (tx + 1) * WATER_TILE), bottom: Math.min(bottom, (ty + 1) * WATER_TILE), tx: tx * WATER_TILE, ty: ty * WATER_TILE });
    const carrier = { density: 0, edge: 0, dx: 0, dy: 0, settle: 0 }, pigments = pigment ? new Float32Array(count * 3) : undefined;
    for (const block of blocks)
        for (let wy = block.top; wy < block.bottom; wy += scale)
            for (let wx = block.left; wx < block.right; wx += scale) {
                const fx = (wx - sx) / scale, fy = (wy - sy) / scale, i = fy * cw + fx, k = ((wy - block.ty) * WATER_TILE + wx - block.tx) * 4;
                if (!active[(fy >>> blockShift) * columns + (fx >>> blockShift)]) {
                    wx += (blockMask - (fx & blockMask)) * scale;
                    continue;
                }
                if (pigment) {
                    pigment.sample(wx, wy, carrier);
                    pigments[i * 3] = carrier.density;
                    pigments[i * 3 + 1] = carrier.edge;
                    pigments[i * 3 + 2] = carrier.settle;
                }
                const worldX = wx / scale + (pigment ? carrier.dx / scale : (block.data[k] / 255 - .5) * spread * 2), worldY = wy / scale + (pigment ? carrier.dy / scale : (block.data[k + 1] / 255 - .5) * spread * 2), px = Math.max(sx / scale, Math.min(right / scale - 1, worldX)), py = Math.max(sy / scale, Math.min(bottom / scale - 1, worldY)), floorX = Math.floor(px), floorY = Math.floor(py), ix = floorX - sx / scale, iy = floorY - sy / scale, jx = Math.min(cw - 1, ix + 1), jy = Math.min(ch - 1, iy + 1), u = px - floorX, v = py - floorY;
                warped[i] = (data[(iy * cw + ix) * 4 + 3] * (1 - u) + data[(iy * cw + jx) * 4 + 3] * u) * (1 - v) + (data[(jy * cw + ix) * 4 + 3] * (1 - u) + data[(jy * cw + jx) * 4 + 3] * u) * v;
            }
    // Water joins neighboring deposits before pigment settles. A short
    // separable kernel removes concentric deposition steps at loaded stroke
    // caps without increasing the number of large brush stamps. Fine liners
    // retain their native, unblurred coverage.
    if (s.size >= 32) {
        for (let row = 0; row < ch; row++)
            for (let col = 0; col < cw; col++) {
                if (!active[(row >>> blockShift) * columns + (col >>> blockShift)]) {
                    col += blockMask - (col & blockMask);
                    continue;
                }
                const i = row * cw + col;
                horizontal[i] = .5 * warped[i] + .25 * (col ? warped[i - 1] : 0) + .25 * (col + 1 < cw ? warped[i + 1] : 0);
            }
        for (let row = 0; row < ch; row++)
            for (let col = 0; col < cw; col++) {
                if (!active[(row >>> blockShift) * columns + (col >>> blockShift)]) {
                    col += blockMask - (col & blockMask);
                    continue;
                }
                const i = row * cw + col;
                warped[i] = .5 * horizontal[i] + .25 * (row ? horizontal[i - cw] : 0) + .25 * (row + 1 < ch ? horizontal[i + cw] : 0);
            }
    }
    // A separable erosion locates real pigment boundaries. A small dead band
    // rejects 8-bit deposition ripple so tiny stamp differences are not turned
    // into dark internal hatching by the pooling operation.
    for (let row = 0; row < ch; row++)
        for (let col = 0; col < cw; col++) {
            if (!active[(row >>> blockShift) * columns + (col >>> blockShift)]) {
                col += blockMask - (col & blockMask);
                continue;
            }
            let minimum = 0;
            if (col >= radius && col < cw - radius) {
                minimum = 255;
                for (let k = -radius; k <= radius; k++)
                    minimum = Math.min(minimum, warped[row * cw + col + k]);
            }
            horizontal[row * cw + col] = minimum;
        }
    const rgb = s.color.slice(1).match(/../g).map(v => parseInt(v, 16)), texture = s.textureStrength ?? 0;
    for (const block of blocks)
        for (let wy = block.top; wy < block.bottom; wy += scale)
            for (let wx = block.left; wx < block.right; wx += scale) {
                const col = (wx - sx) / scale, row = (wy - sy) / scale, i = row * cw + col, k = ((wy - block.ty) * WATER_TILE + wx - block.tx) * 4;
                if (!active[(row >>> blockShift) * columns + (col >>> blockShift)]) {
                    wx += (blockMask - (col & blockMask)) * scale;
                    continue;
                }
                let inside = 0;
                if (row >= radius && row < ch - radius) {
                    inside = 255;
                    for (let d = -radius; d <= radius; d++)
                        inside = Math.min(inside, horizontal[(row + d) * cw + col]);
                }
                const a = warped[i], pool = block.data[k + 2] / 255, sediment = block.material ? block.material[k + 1] / 255 : .5, cloud = block.bloom ? block.bloom[k / 4] / 255 : .5, body = pigment ? a * material.mass * pigments[i * 3] : material ? a * material.mass * materialDensity(material, pool, sediment, cloud, Math.min(1.5, (s.pigmentPooling ?? .55) / .55)) : s.watercolorVersion === 3 ? .76 * a * (.62 + .55 * pool) : .72 * a * (.78 + .22 * pool), rim = Math.max(0, a - inside - 6) * gain * (pigment ? material.edge * pigments[i * 3 + 1] * (.55 + pigments[i * 3 + 2]) : material ? material.edge * waterSmooth(.40, .69, sediment + (pool - .5) * .15) : s.watercolorVersion === 3 ? Math.max(0, (pool - .38) * 2.5) : .6 + .4 * pool), paper = (s.watercolorVersion ?? 0) >= 2 ? 1 : 1 - texture * .11 * block.data[k + 3] / 255, j = i * 4;
                data[j] = rgb[0];
                data[j + 1] = rgb[1];
                data[j + 2] = rgb[2];
                data[j + 3] = Math.round(Math.min(255, body + rim) * paper);
            }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (scale > 1) {
        const out = shaded ??= document.createElement('canvas'), dw = Math.ceil(mask.width / scale), dh = Math.ceil(mask.height / scale);
        if (out.width !== dw)
            out.width = dw;
        if (out.height !== dh)
            out.height = dh;
        out.getContext('2d').putImageData(image, sx / scale, sy / scale);
        ctx.drawImage(out, 0, 0, dw * scale, dh * scale);
    }
    else {
        cc.putImageData(image, 0, 0);
        ctx.drawImage(c, sx, sy, cw, ch);
    }
    ctx.restore();
}
