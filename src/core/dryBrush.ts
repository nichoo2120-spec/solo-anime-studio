/** Additive, opt-in controls. Unflagged saved strokes retain their old renderer. */
export type DryBristleControls={dryBristleVersion?:1|2|3;dryMaterial?:'ink'|'paint';dryBristleSeed?:number;dryLoad?:number;dryDepletion?:number;drySpeedDry?:number;dryLag?:number;dryClumps?:number;dryClumpAmp?:number;dryFray?:number;dryHair?:number;dryFlecks?:number;dryLift?:number;dryTooth?:number;dryToothScale?:number;dryBlur?:number;dryWash?:number};
export const dryControlLimits=[['dryLoad',0,1],['dryDepletion',1,30],['drySpeedDry',0,4],['dryLag',0,1],['dryClumps',2,32],['dryClumpAmp',0,.6],['dryFray',0,.4],['dryHair',0,.6],['dryFlecks',0,3],['dryLift',.1,2],['dryTooth',0,1],['dryToothScale',1,6],['dryBlur',0,1.5],['dryWash',0,.5]] as const;
export const dryLiftSpan=(s:{size:number;dryLift?:number;dryBristleVersion?:1|2|3})=>(s.dryBristleVersion===2||s.dryBristleVersion===3)?16:s.size*(s.dryLift??.8)*1.8+8;
/** Flying hairs/flecks need more space than an ordinary circular nib. */
export const dryRasterPadding=(s:{size:number})=>s.size*3+12;

export function dryStrokeMetadata(s:DryBristleControls):DryBristleControls{if(s.dryBristleVersion!==1&&s.dryBristleVersion!==2&&s.dryBristleVersion!==3)return {};const result:DryBristleControls={dryBristleVersion:s.dryBristleVersion};if((s.dryBristleVersion===2||s.dryBristleVersion===3)&&s.dryMaterial)result.dryMaterial=s.dryMaterial;for(const [key]of dryControlLimits)if(s[key]!==undefined)(result[key] as number)=s[key]!;if(s.dryBristleSeed!==undefined)result.dryBristleSeed=s.dryBristleSeed;return result;}
