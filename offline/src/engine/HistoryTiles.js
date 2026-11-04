const copy = (source, r) => { const c = document.createElement('canvas'); c.width = r.width; c.height = r.height; c.getContext('2d').drawImage(source, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height); return c; };
/** Exact native pixels, in bounded tiles. Reserve both directions before
 * allocating so an undo never unexpectedly doubles the history budget. */
export class HistoryTiles {
    rect;
    tiles = [];
    bytes;
    constructor(source, rect) {
        this.rect = rect;
        this.bytes = rect.width * rect.height * 8;
        for (let y = rect.y; y < rect.y + rect.height; y += 256)
            for (let x = rect.x; x < rect.x + rect.width; x += 256) {
                const r = { x, y, width: Math.min(256, rect.x + rect.width - x), height: Math.min(256, rect.y + rect.height - y) };
                this.tiles.push({ rect: r, before: copy(source, r) });
            }
    }
    finish(source) { for (const t of this.tiles)
        if (!t.after)
            t.after = copy(source, t.rect); }
    get complete() { return this.tiles.every(t => !!t.after); }
    restore(ctx, direction) {
        if (direction === 'after' && !this.complete)
            return false;
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        for (const t of this.tiles) {
            const r = t.rect;
            ctx.clearRect(r.x, r.y, r.width, r.height);
            ctx.drawImage(t[direction], r.x, r.y);
        }
        ctx.restore();
        return true;
    }
    clear() { for (const t of this.tiles) {
        t.before.width = t.before.height = 0;
        if (t.after)
            t.after.width = t.after.height = 0;
    } this.tiles.length = 0; }
}
