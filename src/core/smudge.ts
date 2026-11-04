/** Additive wet-smudge controls. Missing version always means the classic renderer. */
export type SmudgeControls={smudgeVersion?:2|3;mixAmount?:number;pickupLen?:number;holdLen?:number;smearStreak?:number;useSelectedColour?:number};
export const smudgeLimits=[['mixAmount',0,1],['pickupLen',.2,4],['holdLen',.5,12],['smearStreak',0,1],['useSelectedColour',0,1]] as const;
export const smudgeDefaults={mixAmount:.75,pickupLen:.9,holdLen:3.5,smearStreak:.5,useSelectedColour:0};
export function smudgeMetadata(s:SmudgeControls&{brushTip?:string}){
 if((s.smudgeVersion!==2&&s.smudgeVersion!==3)||s.brushTip!=='color-blender')return {};
 const result:SmudgeControls={smudgeVersion:s.smudgeVersion};
 for(const [key,lo,hi]of smudgeLimits){const n=s[key];result[key]=typeof n==='number'&&Number.isFinite(n)?Math.max(lo,Math.min(hi,n)):smudgeDefaults[key];}
 return result;
}
