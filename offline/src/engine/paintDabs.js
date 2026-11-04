import { pressureResponse, taperFactor } from './strokeGeometry.js';
import { widthResponse, opacityResponse } from './pressureChannels.js';
const clamp = (v) => Math.max(0, Math.min(1, v));
/** Contact follows distance, pressure and a gently turning physical brush.
 * Frame count and pointer-event frequency never select the pigment pattern. */
export function paintDabs(s, samples) {
    const result = [];
    if (!samples.points.length)
        return result;
    let segment = 1, distance = 0, previousAngle = 0, previousDistance = 0;
    const evaluate = (d, tail = false) => {
        while (segment < samples.points.length - 1 && samples.arc[segment] < d)
            segment++;
        const a = samples.points[Math.max(0, segment - 1)] ?? samples.points[0], b = samples.points[segment] ?? a, start = samples.arc[segment - 1] ?? 0, span = (samples.arc[segment] ?? 0) - start, t = span ? clamp((d - start) / span) : 0, p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, v: (a.v ?? .65) + ((b.v ?? .65) - (a.v ?? .65)) * t };
        const pressure = s.pressure ? pressureResponse(p.p ** s.response, s.pressureCurve) : 1, width = s.pressure && s.pressureWidth !== false || s.velocityTaper ? widthResponse(pressure * (s.velocityTaper ? p.v ?? 1 : 1), s) : 1, radius = s.size * .5 * width * taperFactor(d, samples.total, s.taperStart, s.taperEnd, Math.max(64, s.size * 12)), target = (s.tipAngle ?? 0) * Math.PI / 180 + (s.colorNibFollow && samples.points.length > 1 ? Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2 : 0);
        let angle = target;
        if (result.length && s.colorNibFollow) {
            let turn = target - previousAngle;
            while (turn > Math.PI)
                turn -= Math.PI * 2;
            while (turn < -Math.PI)
                turn += Math.PI * 2;
            angle = previousAngle + turn * (1 - Math.exp(-(d - previousDistance) / Math.max(.6, s.size * .045)));
        }
        previousAngle = angle;
        previousDistance = d;
        const level = clamp((s.flow ?? 1) * (s.pressure && s.pressureFlow ? pressure : 1) * (s.pressure && s.pressureOpacity ? opacityResponse(pressure, s) : 1));
        const dab = { x: p.x, y: p.y, radius, angle, arc: d, level, tail };
        result.push(dab);
        return dab;
    };
    while (distance <= samples.total + 1e-7) {
        const dab = evaluate(Math.min(distance, samples.total));
        distance += s.brushTip === 'color-blender' ? Math.max(.3, Math.min(28, s.size * .09, dab.radius * .3)) : Math.max(.3, Math.min(8, s.size * .045, dab.radius * .16));
    }
    if (samples.total - (result.at(-1)?.arc ?? 0) > 1e-6)
        evaluate(samples.total, true);
    return result;
}
