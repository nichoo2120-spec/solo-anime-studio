import type {Stroke} from '../core/model';

/** The brush settings that define a Mix gesture, excluding its growing points. */
export function mixStrokeSignature(s:Stroke){
 return [s.id,s.tool,s.size,s.opacity,s.flow,s.color,s.brushKind,s.brushTip,s.coloringEngine,s.coloringAppearanceVersion,s.smudgeVersion,s.nativeMixVersion,s.colorNib,s.colorSeed,s.rasterSourceId,s.smearStreak,s.mixAmount,s.holdLen,s.pickupLen,s.useSelectedColour,s.blendPreserveAlpha,s.pressure,s.response,s.pressureWidth,s.pressureFlow,s.pressureOpacity,s.velocityTaper,s.taperStart,s.taperEnd,s.colorNibFollow,s.tipAngle,s.paintTipVersion,s.dryBristleVersion,s.transform?.join(','),s.perspective?.join(','),s.pressureCurve?.map(p=>`${p.x},${p.y}`).join(';')].join('|');
}
