import { paintHash, paintNoise } from './paintingTips.js';
const SIZE = 192, papers = new Map();
/** Fine fixed paper only: no watercolor pigment, pool or bristle pattern. */
export function finishNewWaterPaper(ctx, strength, x, y, w, h) {
    if (!strength)
        return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = strength;
    for (let ty = Math.floor(y / SIZE); ty * SIZE < y + h; ty++)
        for (let tx = Math.floor(x / SIZE); tx * SIZE < x + w; tx++) {
            const key = tx + ':' + ty;
            let c = papers.get(key);
            if (!c) {
                c = document.createElement('canvas');
                c.width = c.height = SIZE;
                const cc = c.getContext('2d'), d = cc.createImageData(SIZE, SIZE);
                for (let py = 0; py < SIZE; py++)
                    for (let px = 0; px < SIZE; px++) {
                        const wx = tx * SIZE + px, wy = ty * SIZE + py, n = paintNoise(wx * .24 + wy * .08 + 17, wy * .27 - wx * .07 + 61), micro = paintHash(wx, wy);
                        d.data[(py * SIZE + px) * 4 + 3] = Math.round(255 * (.08 + n * .56 + micro * .19));
                    }
                cc.putImageData(d, 0, 0);
                papers.set(key, c);
                if (papers.size > 64) {
                    const first = papers.keys().next().value;
                    papers.get(first).width = 0;
                    papers.delete(first);
                }
            }
            ctx.drawImage(c, tx * SIZE, ty * SIZE);
        }
    ctx.restore();
}
