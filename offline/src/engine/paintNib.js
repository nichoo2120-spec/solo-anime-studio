import { defaultColorNib } from '../core/coloring.js';
import { watercolorSeedFor } from '../core/paintTips.js';
import { paintHash, paintNoise } from './paintingTips.js';
const profiles = new Map(), grains = new Map(), tips = new Map();
let profileBytes = 0, grainBytes = 0, tipBytes = 0;
const clamp = (v) => Math.max(0, Math.min(1, v)), ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
/** Loaded bristle geometry and deposited pigment are separate. A small set of
 * seeded pigment states is selected by travelled distance, never frame number.
 * Their irregular marks belong to each contact, rather than canvas coordinates. */
export function physicalPaintNib(s, arc, level = 1) {
    const nib = s.colorNib ?? defaultColorNib(s.brushTip), side = 64, seed = s.colorSeed ?? watercolorSeedFor(s.rasterSourceId ?? s.id), texture = Math.round((s.textureStrength ?? .6) * 40) / 40, hardness = Math.round((s.hardness ?? .8) * 20) / 20, phase = Math.floor(arc / Math.max(12, s.size * .8) * 8) % 8, ordinal = Math.floor(arc / Math.max(1, s.size * .045)), variant = (ordinal + Math.floor(paintHash(seed + Math.floor(ordinal / 16), 719) * 16)) % 16, bands = nib === 'rake' ? 7 : Math.max(28, Math.min(128, Math.round(s.size * .55 / 4) * 4)), base = [nib, side, seed, hardness, phase, bands].join(':'), load = Math.round(clamp(level) * 32), grainKey = [side, seed, texture, variant].join(':'), key = base + ':' + grainKey + ':' + load;
    let tip = tips.get(key);
    if (tip) {
        tips.delete(key);
        tips.set(key, tip);
        return tip;
    }
    let profile = profiles.get(base);
    if (!profile) {
        profile = new Float32Array(side * side * 2);
        const packet = Math.floor(phase / 8), t = ease(phase % 8 / 8), laneLoads = Float32Array.from({ length: bands }, (_, i) => paintHash(seed + i * 43, packet * 113) * (1 - t) + paintHash(seed + i * 43, (packet + 1) * 113) * t), feather = Math.max(.008, (1 - hardness) * .045), tops = new Float32Array(side), bottoms = new Float32Array(side), films = new Float32Array(side), fringes = Float32Array.from({ length: side }, (_, y) => .80 + .19 * paintNoise(seed + 37, ((y + .5) * 2 / side - 1) * 19 + phase * .08));
        for (let x = 0; x < side; x++) {
            const u = (x + .5) * 2 / side - 1, lanePosition = (u * .5 + .5) * bands, lane = Math.max(0, Math.min(bands - 1, Math.floor(lanePosition))), fraction = lanePosition - Math.floor(lanePosition), hair = laneLoads[lane], front = .40 + .57 * paintHash(seed + lane * 7, 131) + hair * .025, back = .40 + .57 * paintHash(seed + lane * 19, 337) + hair * .025, depth = nib === 'round' ? Math.sqrt(Math.max(0, 1 - u * u)) : nib === 'oval' ? .62 * Math.sqrt(Math.max(0, 1 - u * u)) : nib === 'filbert' ? .42 * Math.cbrt(Math.max(0, 1 - Math.abs(u) ** 3)) : nib === 'bristle' ? .28 : nib === 'rake' ? .30 : .32;
            tops[x] = -depth * front;
            bottoms[x] = depth * back;
            films[x] = nib === 'rake' ? ease((.28 - Math.abs(fraction - (.5 + (paintHash(seed + lane * 31, 991) - .5) * .4))) / .095) : 1;
        }
        for (let y = 0; y < side; y++)
            for (let x = 0; x < side; x++) {
                const u = (x + .5) * 2 / side - 1, v = (y + .5) * 2 / side - 1;
                let edge;
                if (nib === 'fan') {
                    const width = v <= -.05 ? (v + .65) / .6 : Math.sqrt(Math.max(0, 1 - ((v + .05) / .75) ** 2));
                    edge = ease((Math.min(.99, width) - Math.abs(u)) / feather) * ease((v + .65) / feather) * ease((.70 - v) / feather);
                }
                else
                    edge = ease((fringes[y] - Math.abs(u)) / feather) * ease((v - tops[x]) / feather) * ease((bottoms[x] - v) / feather);
                const j = (y * side + x) * 2;
                profile[j] = films[x];
                profile[j + 1] = edge;
            }
        profiles.set(base, profile);
        profileBytes += profile.byteLength;
        while (profileBytes > 12 * 1024 * 1024 && profiles.size > 1) {
            const first = profiles.keys().next().value;
            profileBytes -= profiles.get(first).byteLength;
            profiles.delete(first);
        }
    }
    let grain = grains.get(grainKey);
    if (!grain) {
        grain = new Float32Array(side * side);
        const sx = (seed & 65535), sy = (seed >>> 16) + variant * .55;
        for (let y = 0; y < side; y++)
            for (let x = 0; x < side; x++) {
                const n = paintNoise(sx + x * 43.52 / side, sy + y * 7.04 / side), scratch = ease((n - texture * .31) / .10);
                grain[y * side + x] = (.86 + .14 * paintNoise(sx + x * 15.36 / side, sy + y * 5.12 / side)) * scratch;
            }
        grains.set(grainKey, grain);
        grainBytes += grain.byteLength;
        while (grainBytes > 4 * 1024 * 1024 && grains.size > 1) {
            const first = grains.keys().next().value;
            grainBytes -= grains.get(first).byteLength;
            grains.delete(first);
        }
    }
    const gray = document.createElement('canvas'), alpha = document.createElement('canvas');
    gray.width = gray.height = alpha.width = alpha.height = side;
    const gc = gray.getContext('2d'), ac = alpha.getContext('2d'), g = gc.createImageData(side, side), a = ac.createImageData(side, side);
    for (let i = 0; i < side * side; i++) {
        const j = i * 4, value = Math.round(255 * profile[i * 2] * grain[i] * load / 32), contact = profile[i * 2 + 1];
        g.data[j] = g.data[j + 1] = g.data[j + 2] = value;
        g.data[j + 3] = Math.round(255 * contact);
        a.data[j] = a.data[j + 1] = a.data[j + 2] = 255;
        a.data[j + 3] = Math.round(value * contact);
    }
    gc.putImageData(g, 0, 0);
    ac.putImageData(a, 0, 0);
    tip = { gray, alpha, side };
    tips.set(key, tip);
    tipBytes += side * side * 8;
    while (tipBytes > 24 * 1024 * 1024 && tips.size > 1) {
        const first = tips.keys().next().value, old = tips.get(first);
        tipBytes -= old.side * old.side * 8;
        old.gray.width = old.alpha.width = 0;
        tips.delete(first);
    }
    return tip;
}
