export const dryControlLimits = [['dryLoad', 0, 1], ['dryDepletion', 1, 30], ['drySpeedDry', 0, 4], ['dryLag', 0, 1], ['dryClumps', 2, 32], ['dryClumpAmp', 0, .6], ['dryFray', 0, .4], ['dryHair', 0, .6], ['dryFlecks', 0, 3], ['dryLift', .1, 2], ['dryTooth', 0, 1], ['dryToothScale', 1, 6], ['dryBlur', 0, 1.5], ['dryWash', 0, .5]];
export const dryLiftSpan = (s) => (s.dryBristleVersion === 2 || s.dryBristleVersion === 3) ? 16 : s.size * (s.dryLift ?? .8) * 1.8 + 8;
/** Flying hairs/flecks need more space than an ordinary circular nib. */
export const dryRasterPadding = (s) => s.size * 3 + 12;
export function dryStrokeMetadata(s) { if (s.dryBristleVersion !== 1 && s.dryBristleVersion !== 2 && s.dryBristleVersion !== 3)
    return {}; const result = { dryBristleVersion: s.dryBristleVersion }; if ((s.dryBristleVersion === 2 || s.dryBristleVersion === 3) && s.dryMaterial)
    result.dryMaterial = s.dryMaterial; for (const [key] of dryControlLimits)
    if (s[key] !== undefined)
        result[key] = s[key]; if (s.dryBristleSeed !== undefined)
    result.dryBristleSeed = s.dryBristleSeed; return result; }
