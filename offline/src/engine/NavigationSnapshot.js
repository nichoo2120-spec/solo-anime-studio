/** A transient reprojection of the last visible frame, never used for saved art. */
export class NavigationSnapshot {
    canvas = document.createElement('canvas');
    key;
    constructor() { Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', transformOrigin: '0 0', willChange: 'transform', display: 'none' }); }
    capture(source, p, view, width, height) {
        if (!source.width || !source.height || !width || !height)
            return;
        const c = this.canvas, scale = Math.min(1, Math.sqrt(8388608 / (source.width * source.height))), w = Math.max(1, Math.round(source.width * scale)), h = Math.max(1, Math.round(source.height * scale));
        if (c.width !== w)
            c.width = w;
        if (c.height !== h)
            c.height = h;
        const ctx = c.getContext('2d'), dpr = c.width / width;
        ctx.resetTransform();
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath();
        ctx.rect(18, 18, Math.max(0, width - 18), Math.max(0, height - 18));
        ctx.clip();
        ctx.translate(view.x, view.y);
        ctx.rotate(view.rotation);
        ctx.scale(view.zoom, view.zoom);
        ctx.beginPath();
        ctx.rect(0, 0, p.width, p.height);
        ctx.clip();
        ctx.resetTransform();
        ctx.drawImage(source, 0, 0, c.width, c.height);
        ctx.restore();
        c.style.width = width + 'px';
        c.style.height = height + 'px';
        this.key = { id: p.id, width: p.width, height: p.height, view: { ...view }, cssWidth: width, cssHeight: height };
    }
    present(p, view, width, height) {
        const k = this.key;
        if (!k || k.id !== p.id || k.width !== p.width || k.height !== p.height || k.cssWidth !== width || k.cssHeight !== height)
            return false;
        const scale = view.zoom / k.view.zoom, angle = view.rotation - k.view.rotation, a = Math.cos(angle) * scale, b = Math.sin(angle) * scale, x = view.x - a * k.view.x + b * k.view.y, y = view.y - b * k.view.x - a * k.view.y;
        this.canvas.style.transform = `matrix(${a},${b},${-b},${a},${x},${y})`;
        this.canvas.style.display = 'block';
        return true;
    }
    hide() { this.canvas.style.display = 'none'; }
    clear() { this.hide(); this.key = undefined; this.canvas.width = this.canvas.height = 0; }
}
