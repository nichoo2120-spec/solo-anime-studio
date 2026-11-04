import type {SmudgeControls} from './smudge';
export const coloringTips=[{id:'color-solid',name:'Solid Paint'},{id:'color-soft',name:'Soft Paint'},{id:'color-air',name:'Airbrush'},{id:'color-texture',name:'Textured Paint'},{id:'color-blender',name:'Blender'}] as const;
export type ColoringTip=typeof coloringTips[number]['id'];
export type ColorNib='round'|'flat'|'chisel'|'oval'|'filbert'|'bristle'|'rake'|'fan';
export type ColoringControls={coloringEngine?:1;coloringAppearanceVersion?:2|3;blendPreserveAlpha?:boolean;colorNib?:ColorNib;colorNibFollow?:boolean;colorSeed?:number}&SmudgeControls;
export const colorNibs=[{id:'round',name:'Round'},{id:'flat',name:'Flat'},{id:'chisel',name:'Chisel'},{id:'oval',name:'Oval'},{id:'filbert',name:'Filbert'},{id:'bristle',name:'Flat bristle'},{id:'rake',name:'Rake'},{id:'fan',name:'Fan'}] as const;
export const isColoringTip=(value:unknown):value is ColoringTip=>coloringTips.some(t=>t.id===value);
export const isColorNib=(value:unknown):value is ColorNib=>colorNibs.some(n=>n.id===value);
export function coloringNibs(tip:unknown):readonly ColorNib[]{return tip==='color-solid'?['round','flat','chisel']:tip==='color-soft'?['round','flat','oval','filbert']:tip==='color-air'?['round','oval']:tip==='color-texture'?['flat','filbert','bristle','rake','fan']:['round','flat','filbert','bristle','fan'];}
export function defaultColorNib(tip:unknown):ColorNib{return tip==='color-solid'?'chisel':tip==='color-air'?'oval':tip==='color-texture'?'bristle':'filbert';}
