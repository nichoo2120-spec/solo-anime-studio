const N = 96;
const levels = 16;
const nibCache = new Map();
const profileCache = new Map();
const clamp = (a) => Math.max(0, Math.min(1, a));
function noise(x, y, seed) { let h = Math.imul(x + seed * 43, 374761393) ^ Math.imul(y - seed * 29, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16) >>> 0) / 4294967295; }
/** Pure profile: testable without DOM. Values are luminance in [0,1]. */
export function paintNibCoverage(kind, u, v, variant = 0) {
    const r = Math.hypot(u, v), grain = noise(Math.floor((u + 1) * 151), Math.floor((v + 1) * 151), variant + 17);
    if (kind === 'airbrush')
        return r >= 1 ? 0 : Math.exp(-3.9 * r * r) * Math.pow(clamp(1 - r), .19);
    if (kind === 'watercolor') {
        const low = .04 * Math.sin(11 * u + variant * 1.9) + .055 * Math.sin(8 * v - 4 * u + variant * 2.1);
        const rough = (grain - .5) * .052;
        const edge = 1 + low + rough;
        if (r > edge)
            return 0;
        // Stained rim, mottled center, and a soft peripheral bleed.
        const rim = Math.exp(-Math.pow((r - (edge - .11)) / .065, 2)) * .19;
        const cloud = .8 + .13 * Math.sin(u * 9 + v * 5 + variant) + .1 * Math.sin(u * 17 - v * 11);
        const paper = .74 + .26 * grain;
        const fading = clamp((edge - r) / .12);
        return clamp((.36 * cloud + rim) * paper * fading);
    }
    // Dry flat bristles parallel to the dab's major axis (u). Some fibers
    // disappear completely; ragged nib silhouette is pressure independent.
    const bristle = Math.sin(v * 36 + .5 * Math.sin(u * 7 + variant)) + .42 * Math.sin(v * 83 + variant * 2.1);
    const fibers = bristle < -.46 ? .02 : bristle < -.10 ? .16 : bristle < .28 ? .57 : 1;
    const scallop = .85 + .08 * Math.sin(20 * v + variant * 1.4) + .07 * Math.sin(13 * u + 7 * v);
    const hole = noise(Math.floor((u + 1) * 31), Math.floor((v + 1) * 33), variant + 31);
    const blotch = .5 + .25 * Math.sin(u * 17 - v * 11 + variant) + .25 * Math.sin(u * 34 + v * 6);
    const inner = clamp((scallop - r) / .105);
    return clamp(inner * fibers * (hole < .09 ? .04 : hole < .16 ? .35 : .72 + .28 * grain) * (blotch < .30 ? .28 : blotch < .5 ? .66 : 1));
}
export function quantizeNibIntensity(intensity) { return Math.round(clamp(intensity / 255) * levels); }
export function getPaintNib(kind, intensity, variant) {
    const level = quantizeNibIntensity(intensity), v = kind === 'airbrush' ? 0 : variant % 3, key = `${kind}:${level}:${v}`;
    let nib = nibCache.get(key);
    if (nib)
        return nib;
    nib = document.createElement('canvas');
    nib.width = N;
    nib.height = N;
    const nc = nib.getContext('2d'), pixels = nc.createImageData(N, N), data = pixels.data;
    const profileKey = `${kind}:${v}`;
    let base = profileCache.get(profileKey);
    if (!base) {
        base = new Uint8Array(N * N);
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) {
                base[y * N + x] = Math.round(255 * paintNibCoverage(kind, 2 * (x + .5) / N - 1, 2 * (y + .5) / N - 1, v));
            }
        profileCache.set(profileKey, base);
    }
    for (let i = 0; i < N * N; i++) {
        const k = i * 4, value = Math.round(base[i] * level / levels);
        data[k] = value;
        data[k + 1] = value;
        data[k + 2] = value;
        data[k + 3] = 255;
    }
    nc.putImageData(pixels, 0, 0);
    // Bound the cache when many brush sizes/levels are sampled over time.
    if (nibCache.size >= 160)
        nibCache.delete(nibCache.keys().next().value);
    nibCache.set(key, nib);
    return nib;
}
export function paintSpacing(size) { return Math.min(5, Math.max(.85, size * .085)); }
/** Stable variant based on absolute stroke arc length, not skipped dirty tiles. */
export function paintStampVariant(distanceAlong, spacing) { return Math.max(0, Math.floor(distanceAlong / spacing + 1e-5)) % 3; }
