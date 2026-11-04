import { finishMaterialPaper } from './watercolorMaterial.js';
import { paintHash, paintNoise } from './paintingTips.js';
const TILE = 192, cache = new Map();
/** Paper is unique in document coordinates, never scaled with the nib or
 * the coarse water-front buffer. Cache edges sample the same world field. */
export function finishPaper(ctx, s, x, y, w, h) {
    if (!!s.watercolorMaterialVersion) {
        finishMaterialPaper(ctx, s, x, y, w, h);
        return;
    }
    const strength = s.textureStrength ?? 0;
    if (!strength)
        return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = strength * (s.watercolorStyle === 'bloom' ? .25 : 1);
    for (let ty = Math.floor(y / TILE); ty * TILE < y + h; ty++)
        for (let tx = Math.floor(x / TILE); tx * TILE < x + w; tx++) {
            const dry = s.watercolorStyle === 'dry', key = [tx, ty, dry, s.watercolorStyle].join(':');
            let c = cache.get(key);
            if (!c) {
                c = document.createElement('canvas');
                c.width = c.height = TILE;
                const cc = c.getContext('2d'), d = cc.createImageData(TILE, TILE);
                for (let py = 0; py < TILE; py++)
                    for (let px = 0; px < TILE; px++) {
                        const wx = tx * TILE + px, wy = ty * TILE + py, n = paintNoise(wx * .43 + wy * .17 + 17, wy * .51 - wx * .12 + 61), f = paintHash(wx, wy);
                        d.data[(py * TILE + px) * 4 + 3] = Math.round(255 * (dry ? (f < .1 ? .95 : Math.min(.95, n * .8 + f * .2)) : (s.watercolorStyle === 'paper' ? .12 : .04) + n * .26 + f * .12));
                    }
                cc.putImageData(d, 0, 0);
                cache.set(key, c);
                if (cache.size > 96) {
                    const first = cache.keys().next().value;
                    cache.get(first).width = 0;
                    cache.delete(first);
                }
            }
            ctx.drawImage(c, tx * TILE, ty * TILE);
        }
    ctx.restore();
}
