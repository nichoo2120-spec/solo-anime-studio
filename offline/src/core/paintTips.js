import { smudgeMetadata } from './smudge.js';
import { dryStrokeMetadata } from './dryBrush.js';
import { coloringTips, isColoringTip, defaultColorNib } from './coloring.js';
export const paintTips = [
    ...coloringTips,
    { id: 'soft-round', name: 'Soft paint' },
    { id: 'bristle', name: 'Bristle paint' },
    { id: 'flat-bristle', name: 'Flat bristles' },
    { id: 'chalk', name: 'Chalk grain' },
    { id: 'felt', name: 'Chisel felt' },
    { id: 'wash', name: 'Watercolor edge' },
    { id: 'wash-flat', name: 'Watercolor flat wash' },
    { id: 'wash-dagger', name: 'Watercolor dagger' },
    { id: 'wash-cats-tongue', name: "Watercolor cat’s tongue" },
    { id: 'wash-liner', name: 'Watercolor liner' },
    { id: 'water-smooth', name: 'Smooth watercolor' },
    { id: 'water-rough', name: 'Rough watercolor' },
    { id: 'water-wet', name: 'Soft wet watercolor' },
    { id: 'water-flat', name: 'Flat watercolor' },
    { id: 'water-gradient', name: 'Gradient watercolor' },
    { id: 'round', name: 'Original tip' },
];
const mixTips = ['soft-round', 'bristle', 'flat-bristle', 'chalk', 'felt'];
export const isMixTip = (value) => mixTips.some(t => t === value);
export const canMixTips = (tip) => tip === 'round' || isMixTip(tip);
/** Explicit nib mixes only: existing presets without these fields keep their
 * original renderer. At either endpoint, use that physical tip on its own. */
export function tipMixMetadata(s) {
    const { mixTipA: a, mixTipB: b, mixBlend: t } = s;
    if (s.dryBristleVersion || !canMixTips(s.brushTip) || !isMixTip(a) || !isMixTip(b) || typeof t !== 'number' || !Number.isFinite(t))
        return {};
    if (a === b || t <= .01 || t >= .99)
        return { brushTip: t >= .99 ? b : a, mixTipA: undefined, mixTipB: undefined, mixBlend: undefined };
    return { brushTip: a, mixTipA: a, mixTipB: b, mixBlend: t };
}
export const isNewWatercolorTip = (tip) => !!tip?.startsWith('water-');
export const isWatercolorTip = (tip) => tip === 'wash' || !!tip?.startsWith('wash-');
/** Drawing choices exclude retired watercolor tips; saved artwork still validates. */
export const selectablePaintTips = paintTips.filter(t => !isWatercolorTip(t.id));
export const isPaintTip = (value) => paintTips.some(t => t.id === value);
/** Stable seed stored at contact, independent of replay or display updates. */
export function watercolorSeedFor(id) { let h = 2166136261; for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; }
/** One metadata source for captured strokes, brush previews and saved replay. */
export function brushStrokeMetadata(s) {
    const mix = tipMixMetadata(s), tip = mix.brushTip ?? s.brushTip, textured = !!tip && tip !== 'round', kind = s.brushKind ?? '';
    return { ...smudgeMetadata(s), ...dryStrokeMetadata(s), blendPreserveAlpha: s.brushTip === 'color-blender' ? s.blendPreserveAlpha : undefined, coloringAppearanceVersion: s.brushTip === 'color-texture' || s.brushTip === 'color-blender' ? 3 : undefined, coloringEngine: isColoringTip(s.brushTip) ? 1 : undefined, colorNib: isColoringTip(s.brushTip) ? s.colorNib ?? defaultColorNib(s.brushTip) : undefined, colorNibFollow: isColoringTip(s.brushTip) ? s.colorNibFollow : undefined, colorSeed: isColoringTip(s.brushTip) ? s.colorSeed : undefined, watercolorAppearanceVersion: isNewWatercolorTip(s.brushTip) ? s.watercolorAppearanceVersion : undefined, watercolorShape: isNewWatercolorTip(s.brushTip) ? s.watercolorShape : undefined, watercolorMode: isNewWatercolorTip(s.brushTip) ? s.watercolorMode : undefined, mixVersion: s.mixColors || s.watercolorMode === 'wet' ? 2 : undefined, watercolorEngine: isNewWatercolorTip(s.brushTip) ? 1 : undefined, pigmentAmount: s.pigmentAmount, waterAmount: s.waterAmount, edgeSoftness: s.edgeSoftness, dryness: s.dryness, pigmentBuildup: s.pigmentBuildup, pigmentDepletion: s.pigmentDepletion, pigmentReload: s.pigmentReload, wetDiffusion: s.wetDiffusion, edgeBleeding: s.edgeBleeding, watercolorMaterialVersion: isWatercolorTip(s.brushTip) ? 2 : undefined, watercolorStyle: s.watercolorStyle, pigmentPooling: s.pigmentPooling, brushTip: s.brushTip, tipAngle: s.tipAngle, tipSpacing: s.tipSpacing, flow: s.flow, hardness: s.hardness, pressureFlow: s.pressureFlow, paintTipVersion: textured ? 2 : undefined, watercolorVersion: isWatercolorTip(s.brushTip) ? 3 : undefined,
        ...mix, liveRefinementVersion: textured || ['marker', 'paint', 'dry-round', 'dry-grain', 'watercolor', 'airbrush', 'flat', 'eraser-soft'].includes(kind) ? 3 : 2,
        flatNibVersion: kind === 'flat' && !textured ? 1 : undefined,
        paintNibVersion: textured || ['paint', 'marker', 'eraser-soft', 'dry-round', 'dry-grain', 'watercolor'].includes(kind) ? 1 : undefined,
        engineVersion: kind === 'dry-round' || kind.startsWith('graphite-') ? 9 : ['dry-grain', 'watercolor', 'airbrush'].includes(kind) ? 8 : 10 };
}
