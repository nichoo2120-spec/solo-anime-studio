import { paintNoise } from './paintingTips.js';
import { watercolorSeedFor } from '../core/paintTips.js';
/** Fine pigment particles have their own saved stroke frame. Averaging water
 * contacts must not average away the deposited particles or reconstruct them
 * from a cancelling tangent. The stationary paper surface is applied later. */
export function watercolorGranulation(s) {
    const seed = s.watercolorSeed ?? watercolorSeedFor(s.id), sx = (seed & 65535) + 503, sy = (seed >>> 16) + 719, origin = s.points[0] ?? { x: 0, y: 0 }, angle = (s.tipAngle ?? 0) * Math.PI / 180, co = Math.cos(angle), si = Math.sin(angle), fine = Math.max(2.2, Math.min(4, s.size * .035));
    return (x, y) => { const dx = x - origin.x, dy = y - origin.y, a = dx * co + dy * si, b = -dx * si + dy * co; return paintNoise(sx + (a + b * .27) / fine, sy + (b - a * .19) / fine); };
}
/** Pigment travels in this stroke's coordinates; paper remains a separate surface.
 * Coherent fields use the stored stroke seed, never a frame number or tile image. */
export function watercolorAppearance(s) {
    const kind = s.brushTip?.slice(6), seed = s.watercolorSeed ?? watercolorSeedFor(s.id), sx = seed & 65535, sy = seed >>> 16;
    const size = s.size * (s.watercolorShape === 'liner' ? .2 : 1), cloud = Math.max(12, size * .28), fine = Math.max(2.2, Math.min(4, size * .035)), texture = s.textureStrength ?? .2;
    return (d, out) => {
        const a = d.along ?? 0, b = d.across ?? 0;
        // Coherent domain warping breaks up the value-noise lattice without moving
        // paper, rotating a stamp, or changing a stroke's saved pigment pattern.
        const broad = paintNoise(sx + (a + b * .37) / cloud, sy + (b - a * .21) / (cloud * .85));
        const warp = (broad - .5) * 1.4;
        const patch = paintNoise(sx + 91 + a / (cloud * .42) + warp, sy + 57 + b / (cloud * .53) - warp * .7);
        const granules = paintNoise(sx + 171 + (a + b * .27) / fine, sy + 331 + (b - a * .19) / fine);
        const directional = kind === 'rough' ? paintNoise(sx + 37 + a / Math.max(8, size * .16), sy + 81 + b / Math.max(.9, size * .018)) : granules;
        const variation = kind === 'wet' ? broad * .76 + patch * .24 : broad * .48 + patch * .52;
        const gain = kind === 'flat' ? 1.02 + variation * .66 : kind === 'rough' ? .78 + variation * 1.2 : kind === 'wet' ? .74 + variation * 1.1 : .90 + variation * .94;
        out.pigment = gain * (1 + (granules - .5) * (.16 + texture * .65));
        out.grain = kind === 'rough' ? granules * .48 + directional * .52 : granules;
        out.edge = (patch - .5) * 2;
        // Pool only on selected coherent sections, avoiding an outline around every edge.
        const bank = Math.max(0, Math.min(1, (broad - .48) / .32));
        out.pool = bank * bank * (.45 + granules * .55) * (kind === 'wet' ? .42 : kind === 'flat' ? .08 : .18);
        return out;
    };
}
