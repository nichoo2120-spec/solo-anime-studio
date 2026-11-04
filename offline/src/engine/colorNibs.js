const circle = Array.from({ length: 32 }, (_, i) => ({ x: Math.cos(i * Math.PI / 16), y: Math.sin(i * Math.PI / 16) }));
const shapes = {
    round: circle, oval: circle.map(p => ({ x: p.x, y: p.y * .62 })),
    flat: [{ x: -1, y: -.32 }, { x: 1, y: -.32 }, { x: 1, y: .32 }, { x: -1, y: .32 }],
    chisel: [{ x: -1, y: -.48 }, { x: 1, y: -.16 }, { x: 1, y: .48 }, { x: -1, y: .16 }],
    filbert: circle.map(p => ({ x: Math.sign(p.x) * Math.abs(p.x) ** .7, y: Math.sign(p.y) * Math.abs(p.y) ** .7 * .42 })),
    bristle: [{ x: -1, y: -.28 }, { x: 1, y: -.28 }, { x: 1, y: .28 }, { x: -1, y: .28 }],
    rake: [{ x: -1, y: -.3 }, { x: 1, y: -.3 }, { x: 1, y: .3 }, { x: -1, y: .3 }],
    fan: [{ x: 0, y: -.65 }, ...Array.from({ length: 25 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 24; return { x: Math.sin(a), y: Math.cos(a) * .75 - .05 }; })],
};
export function colorNibFootprint(nib) { return shapes[nib]; }
const outlines = new Map();
export function colorNibOutline(nib) { let p = outlines.get(nib); if (p)
    return p; p = new Path2D(); shapes[nib].forEach((q, i) => i ? p.lineTo(q.x * .5, q.y * .5) : p.moveTo(q.x * .5, q.y * .5)); p.closePath(); if (nib === 'rake' || nib === 'bristle')
    for (let i = 1; i < (nib === 'rake' ? 7 : 13); i++) {
        const x = (-1 + i * 2 / (nib === 'rake' ? 7 : 13)) * .5;
        p.moveTo(x, -.12);
        p.lineTo(x, .12);
    } outlines.set(nib, p); return p; }
