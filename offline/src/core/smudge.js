export const smudgeLimits = [['mixAmount', 0, 1], ['pickupLen', .2, 4], ['holdLen', .5, 12], ['smearStreak', 0, 1], ['useSelectedColour', 0, 1]];
export const smudgeDefaults = { mixAmount: .75, pickupLen: .9, holdLen: 3.5, smearStreak: .5, useSelectedColour: 0 };
export function smudgeMetadata(s) {
    if ((s.smudgeVersion !== 2 && s.smudgeVersion !== 3) || s.brushTip !== 'color-blender')
        return {};
    const result = { smudgeVersion: s.smudgeVersion };
    for (const [key, lo, hi] of smudgeLimits) {
        const n = s[key];
        result[key] = typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : smudgeDefaults[key];
    }
    return result;
}
