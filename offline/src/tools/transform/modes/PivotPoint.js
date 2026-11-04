export const pivotPoint = (s, d, p) => { s.pivot = { x: d.pivot.x + p.x - d.point.x, y: d.pivot.y + p.y - d.point.y }; };
