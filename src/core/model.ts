import {smudgeLimits} from './smudge';
import {dryControlLimits,type DryBristleControls} from './dryBrush';
import {isPaintTip,isWatercolorTip,isNewWatercolorTip,isMixTip,type PaintTip,type TipMixControls} from './paintTips';
import {isColoringTip,isColorNib,coloringNibs,type ColoringControls} from './coloring';
import type {VectorLine} from '../engine/vector';
import type {DrawingTimeline} from '../animation/timeline';
import type {SubstitutionShelfData} from '../animation/substitutions';
import type {CycleShelf} from '../animation/reuse';
import {validateSceneAudio,type SceneAudio} from '../animation/audio';
import {validateMotionPlanning,type MotionPlanning} from '../animation/motionPlanning';
import {validateSceneCamera,pruneCameraDepth,type SceneCamera} from '../animation/sceneCamera';
import type {ShotFrame} from './shotFrame';
export type Tool = 'brush' | 'eraser' | 'lasso' | 'rectangle' | 'transform' | 'fill' | 'hand' | 'zoom' | 'rotate' | 'eyedropper' | 'vector' | 'stroke-select';
export type Point = {x:number;y:number;p:number;v?:number};
export type WatercolorShape='round'|'filbert'|'angular'|'liner'|'mop';
export type WatercolorMode='wet'|'glaze'|'even';
export type WatercolorControls={watercolorAppearanceVersion?:1;watercolorShape?:WatercolorShape;watercolorMode?:WatercolorMode;pigmentAmount?:number;waterAmount?:number;edgeSoftness?:number;dryness?:number;pigmentBuildup?:number;pigmentDepletion?:number;pigmentReload?:boolean;wetDiffusion?:number;edgeBleeding?:number};
export type PressureSettings={minSize?:number;maxSize?:number;minOpacity?:number;maxOpacity?:number;velocityTaper?:boolean};
export type Matrix = [number,number,number,number,number,number];
export type PerspectiveMatrix = [number,number,number,number,number,number,number,number,number];
export type Stroke = {id:string;kind:'stroke';tool:'brush'|'eraser';points:Point[];size:number;opacity:number;color:string;pressure:boolean;response:number;watercolorEngine?:1;mixVersion?:2;nativeMixVersion?:1|2|3;nativeMixAmount?:number;nativeMixRadius?:number;nativeMixPaintLoad?:number;rasterTransformVersion?:1;rasterSourceId?:string;engineVersion?:2|3|4|5|6|7|8|9|10;/** Continuous flat-nib sweep for new strokes only. */flatNibVersion?:1;/** Diameter-scaled soft-paint sampling for new strokes. */paintNibVersion?:1;paintTipVersion?:1|2;/** Reference-guided watercolor coverage and edge pooling, new strokes only. */watercolorVersion?:1|2|3;/** Reference-guided materials on the continuous version-3 front. */watercolorMaterialVersion?:1|2;watercolorSeed?:number;watercolorStyle?:'paper'|'dry'|'bloom';pigmentPooling?:number;mixStops?:{x:number;y:number;color:string}[];flow?:number;hardness?:number;pressureFlow?:boolean;brushTip?:PaintTip;tipAngle?:number;tipSpacing?:number;liveRefinementVersion?:1|2|3;/** Canvas zoom captured on pen-down. New strokes only: makes spatial stroke cleanup consistent in screen pixels. */captureZoom?:number;stabilization?:number;smoothness?:number;pressureWidth?:boolean;pressureOpacity?:boolean;pressureCurve?:{x:number;y:number}[];taperStart?:number;taperEnd?:number;brushKind?:string;textureStrength?:number;/** Non-destructive affine transform of one line. */transform?:Matrix;/** Projective transform for independent corner sizing. */perspective?:PerspectiveMatrix}&PressureSettings&WatercolorControls&ColoringControls&DryBristleControls&TipMixControls;
export type Fill = {id:string;kind:'fill';png:string;under?:boolean};
export type ImageOperation={id:string;kind:'image';png:string;x:number;y:number;width:number;height:number};
export type ClearOperation={id:string;kind:'clear';polygon:Point[]};
export type Transform = {id:string;kind:'transform';polygon:Point[];matrix:Matrix};
export type ArtworkOrigin={inShot?:true;inPreviousStage?:true};
export type Operation = (Stroke | Fill | Transform | VectorLine | ImageOperation | ClearOperation)&ArtworkOrigin;
export type BlendMode='normal'|'multiply'|'screen'|'overlay'|'add';
export type Layer = {id:string;name:string;visible:boolean;locked:boolean;opacity:number;operations:Operation[];kind?:'raster'|'vector';blend?:BlendMode;reference?:boolean;exportReference?:boolean};
export type Project = {format:'solo-anime-studio';version:1|2|3|4|5;id:string;name:string;width:number;height:number;shotFrame?:ShotFrame;previousStage?:ShotFrame;activeLayerId:string;layers:Layer[];settings:{guides:boolean};createdAt:string;animation?:DrawingTimeline;substitutionShelf?:SubstitutionShelfData;cycleShelf?:CycleShelf;audio?:SceneAudio;motionPlanning?:MotionPlanning;camera?:SceneCamera};
export const MAX_STAGE_SIDE=8192,MAX_STAGE_PIXELS=16_777_216;
export const uid = () => crypto.randomUUID();
export function newLayer(name:string,kind:'raster'|'vector'='raster'):Layer {return {id:uid(),name,visible:true,locked:false,opacity:1,operations:[],kind};}
export function newProject(name='Untitled scene',width=1920,height=1080):Project {
 const layers=['Rough','Line','Color','Background'].map(name=>newLayer(name));
 return {format:'solo-anime-studio',version:3,id:uid(),name,width,height,activeLayerId:layers[1].id,layers,settings:{guides:true},createdAt:new Date().toISOString()};
}
export const activeLayer = (p:Project) => p.layers.find(l=>l.id===p.activeLayerId)!;
export function editLayer(p:Project,id:string,patch:Partial<Layer>):Project {return {...p,version:p.version>=3?p.version:3,layers:p.layers.map(l=>l.id===id?{...l,...patch}:l)};}
export function appendOperation(p:Project,op:Operation):Project {
 const layer=activeLayer(p); if(layer.locked||!layer.visible)return p;
 return editLayer(p,layer.id,{operations:[...layer.operations,op]});
}
export function removeLayer(p:Project,id:string):Project {
 if(p.layers.length===1)return p;
 const layers=p.layers.filter(l=>l.id!==id);
 return {...p,layers,activeLayerId:p.activeLayerId===id?layers[0].id:p.activeLayerId,...(p.camera?{camera:pruneCameraDepth(p.camera,new Set(layers.map(l=>l.id)))}:{}),...(p.motionPlanning?{motionPlanning:{...p.motionPlanning,arcs:p.motionPlanning.arcs.filter(arc=>arc.layerId!==id)}}:{})};
}
export function duplicateLayer(p:Project,id:string):Project {
 if(p.layers.length>=100)return p;
 const index=p.layers.findIndex(l=>l.id===id); if(index<0)return p;
 const copy={...p.layers[index],id:uid(),name:p.layers[index].name+' copy',operations:p.layers[index].operations.map(o=>({...o,id:uid()}))};
 const layers=[...p.layers];layers.splice(index,0,copy);return {...p,layers,activeLayerId:copy.id};
}
export function reorderLayer(p:Project,id:string,delta:number):Project {
 const index=p.layers.findIndex(l=>l.id===id),next=index+delta;
 if(index<0||next<0||next>=p.layers.length)return p;
 const layers=[...p.layers];[layers[index],layers[next]]=[layers[next],layers[index]];return {...p,layers};
}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const bounded=(n:unknown,min:number,max:number)=>finite(n)&&n>=min&&n<=max;
const point=(p:any)=>p&&finite(p.x)&&finite(p.y)&&Math.abs(p.x)<=1e6&&Math.abs(p.y)<=1e6&&bounded(p.p,0,1)&&(p.v===undefined||bounded(p.v,0,1));
export function validateProject(value:unknown):Project {
 const p=value as any;
 if(!p||p.format!=='solo-anime-studio'||![1,2,3,4,5].includes(p.version))throw Error('Unsupported project format or version.');
 const frame=p.shotFrame,expanded=p.version>=4,previous=p.previousStage;
 if(typeof p.id!=='string'||typeof p.name!=='string'||p.name.length>200||typeof p.createdAt!=='string'||!Number.isInteger(p.width)||!Number.isInteger(p.height)||!bounded(p.width,64,expanded?MAX_STAGE_SIDE:4096)||!bounded(p.height,64,expanded?MAX_STAGE_SIDE:4096)||p.width*p.height>(expanded?MAX_STAGE_PIXELS:8388608))throw Error('Invalid project dimensions or metadata.');
 if(expanded){
  if(!frame||![frame.x,frame.y,frame.width,frame.height].every(Number.isInteger)||frame.x<1||frame.y<1||
    !bounded(frame.width,64,4096)||!bounded(frame.height,64,4096)||frame.width*frame.height>8388608||
    frame.x+frame.width>=p.width||frame.y+frame.height>=p.height)throw Error('Invalid shot frame.');
 }else if(frame!==undefined)throw Error('Shot frame requires an expanded project.');
 if(previous!==undefined&&(p.version!==5||!previous||![previous.x,previous.y,previous.width,previous.height].every(Number.isInteger)||
    previous.x<0||previous.y<0||previous.x>=frame.x||previous.y>=frame.y||previous.x+previous.width>p.width||previous.y+previous.height>p.height||
    previous.x+previous.width<=frame.x+frame.width||previous.y+previous.height<=frame.y+frame.height))throw Error('Invalid previous drawing area.');
 if(!Array.isArray(p.layers)||p.layers.length<1||p.layers.length>100)throw Error('Projects require 1–100 layers.');
 const ids=new Set<string>();let count=0;
 for(const l of p.layers){
  if(!l||typeof l.id!=='string'||ids.has(l.id)||typeof l.name!=='string'||l.name.length>200||typeof l.visible!=='boolean'||typeof l.locked!=='boolean'||!bounded(l.opacity,0,1)||!Array.isArray(l.operations))throw Error('Invalid layer data.');
  ids.add(l.id);
  if(l.kind!==undefined&&!['raster','vector'].includes(l.kind))throw Error('Invalid layer type.');
  if(l.blend!==undefined&&!['normal','multiply','screen','overlay','add'].includes(l.blend))throw Error('Invalid blend mode.');
  if(['reference','exportReference'].some(k=>l[k]!==undefined&&typeof l[k]!=='boolean'))throw Error('Invalid reference settings.');
  if(l.kind==='vector'&&l.operations.some((o:any)=>o.kind!=='vector'))throw Error('Vector layers contain only editable vector lines.');
  if(l.kind!=='vector'&&l.operations.some((o:any)=>o.kind==='vector'))throw Error('Vector lines require a vector layer.');
  for(const o of l.operations){
   if(!o||typeof o.id!=='string'||++count>100000)throw Error('Invalid drawing operation.');
   if(o.inShot!==undefined&&(!expanded||o.inShot!==true))throw Error('Invalid drawing operation frame.');
   if(o.inPreviousStage!==undefined&&(!previous||o.inPreviousStage!==true))throw Error('Invalid drawing operation area.');
   if(o.kind==='stroke'){
    if(!['brush','eraser'].includes(o.tool)||!bounded(o.size,.1,500)||!bounded(o.opacity,0,1)||!/^#[\da-f]{6}$/i.test(o.color)||typeof o.pressure!=='boolean'||!bounded(o.response,.2,3)||!Array.isArray(o.points)||!o.points.length||o.points.length>200000||!o.points.every(point))throw Error('Invalid stroke data.');
    if(o.engineVersion!==undefined&&o.engineVersion!==2&&o.engineVersion!==3&&o.engineVersion!==4&&o.engineVersion!==5&&o.engineVersion!==6&&o.engineVersion!==7&&o.engineVersion!==8&&o.engineVersion!==9&&o.engineVersion!==10)throw Error('Unsupported stroke renderer.');
    if(o.mixVersion!==undefined&&o.mixVersion!==2)throw Error('Invalid color mixing version.');
    if(o.nativeMixVersion!==undefined&&(![1,2,3].includes(o.nativeMixVersion)||o.tool!=='brush'||o.brushTip==='color-blender'||!bounded(o.nativeMixAmount,0,1)||(o.nativeMixRadius!==undefined&&!bounded(o.nativeMixRadius,.02,1))))throw Error('Invalid native brush mixing version or settings.');
    if(o.nativeMixPaintLoad!==undefined&&(o.nativeMixVersion!==3||!bounded(o.nativeMixPaintLoad,0,1)))throw Error('Invalid native Mix paint load.');
    if((o.mixTipA!==undefined&&!isMixTip(o.mixTipA))||(o.mixTipB!==undefined&&!isMixTip(o.mixTipB))||(o.mixBlend!==undefined&&!bounded(o.mixBlend,0,1)))throw Error('Invalid mixed paint tip.');
    if(o.rasterSourceId!==undefined&&(typeof o.rasterSourceId!=='string'||o.rasterSourceId.length>1000))throw Error('Invalid reflection source.');
    if(o.rasterTransformVersion!==undefined&&(o.rasterTransformVersion!==1||!(o.transform||o.perspective)))throw Error('Invalid reflected stroke.');
    if(o.coloringEngine!==undefined&&(o.coloringEngine!==1||o.paintTipVersion!==2||!isColoringTip(o.brushTip)))throw Error('Invalid coloring engine.');
    if(isColoringTip(o.brushTip)&&o.coloringEngine!==1)throw Error('Coloring style requires its renderer.');
    if(o.dryBristleVersion!==undefined&&((o.dryBristleVersion!==1&&o.dryBristleVersion!==2&&o.dryBristleVersion!==3)||o.brushKind!=='dry-bristle'))throw Error('Invalid dry bristle renderer.');
    if(o.dryMaterial!==undefined&&((o.dryBristleVersion!==2&&o.dryBristleVersion!==3)||!['ink','paint'].includes(o.dryMaterial)))throw Error('Invalid dry bristle material.');
    for(const [key,min,max]of dryControlLimits)if(o[key]!==undefined&&((o.dryBristleVersion!==1&&o.dryBristleVersion!==2&&o.dryBristleVersion!==3)||!bounded(o[key],min,max)))throw Error('Invalid dry bristle control.');
    if(o.dryBristleSeed!==undefined&&((o.dryBristleVersion!==1&&o.dryBristleVersion!==2&&o.dryBristleVersion!==3)||!Number.isInteger(o.dryBristleSeed)||!bounded(o.dryBristleSeed,0,4294967295)))throw Error('Invalid dry bristle seed.');
    if(o.smudgeVersion!==undefined&&((o.smudgeVersion!==2&&o.smudgeVersion!==3)||o.coloringEngine!==1||o.brushTip!=='color-blender'))throw Error('Invalid wet smudge renderer.');
    for(const [key,min,max]of smudgeLimits)if(o[key]!==undefined&&((o.smudgeVersion===2||o.smudgeVersion===3)?!bounded(o[key],min,max):key!=='mixAmount'))throw Error('Invalid wet smudge control.');
    if(o.coloringAppearanceVersion!==undefined&&(![2,3].includes(o.coloringAppearanceVersion)||o.coloringEngine!==1||!['color-texture','color-blender'].includes(o.brushTip??'')))throw Error('Invalid coloring appearance.');
    if(o.blendPreserveAlpha!==undefined&&(typeof o.blendPreserveAlpha!=='boolean'||o.coloringAppearanceVersion!==3||o.brushTip!=='color-blender'))throw Error('Invalid Blender transparency control.');
    if(o.colorNib!==undefined&&(!isColorNib(o.colorNib)||o.coloringEngine!==1||!coloringNibs(o.brushTip).includes(o.colorNib)))throw Error('Invalid coloring nib.');
    if(o.colorNibFollow!==undefined&&(typeof o.colorNibFollow!=='boolean'||o.coloringEngine!==1))throw Error('Invalid nib orientation.');
    if(o.colorSeed!==undefined&&(o.coloringEngine!==1||!Number.isInteger(o.colorSeed)||!bounded(o.colorSeed,0,4294967295)))throw Error('Invalid coloring seed.');
    if(o.watercolorAppearanceVersion!==undefined&&(o.watercolorAppearanceVersion!==1||o.watercolorEngine!==1))throw Error('Invalid watercolor appearance version.');
    if(o.watercolorShape!==undefined&&(!['round','filbert','angular','liner','mop'].includes(o.watercolorShape)||o.watercolorEngine!==1))throw Error('Invalid watercolor brush shape.');
    if(o.watercolorMode!==undefined&&(!['wet','glaze','even'].includes(o.watercolorMode)||o.watercolorEngine!==1))throw Error('Invalid watercolor painting mode.');
    if(o.flatNibVersion!==undefined&&o.flatNibVersion!==1)throw Error('Unsupported flat nib.');
    if(o.paintNibVersion!==undefined&&o.paintNibVersion!==1)throw Error('Unsupported paint nib.');
    if(o.paintTipVersion!==undefined&&(![1,2].includes(o.paintTipVersion)||!isPaintTip(o.brushTip)||o.brushTip==='round'))throw Error('Invalid textured paint tip.');
    if(o.paintTipVersion===1&&o.brushTip==='soft-round')throw Error('Invalid legacy paint tip.');
    if(o.watercolorVersion!==undefined&&(![1,2,3].includes(o.watercolorVersion)||o.paintTipVersion!==2||!isWatercolorTip(o.brushTip)))throw Error('Invalid watercolor version.');
    if(o.brushTip?.startsWith('wash-')&&![1,2,3].includes(o.watercolorVersion))throw Error('Watercolor shape requires its renderer version.');
    for(const key of ['flow','hardness'])if(o[key]!==undefined&&!bounded(o[key],0,1))throw Error('Invalid paint dynamics.');
    if(o.watercolorMaterialVersion!==undefined&&(![1,2].includes(o.watercolorMaterialVersion)||o.watercolorVersion!==3))throw Error('Invalid watercolor material.');
    if(o.watercolorEngine!==undefined&&(o.watercolorEngine!==1||o.paintTipVersion!==2||!isNewWatercolorTip(o.brushTip)||o.watercolorVersion!==undefined))throw Error('Invalid natural watercolor engine.');
    if(isNewWatercolorTip(o.brushTip)&&o.watercolorEngine!==1)throw Error('Natural watercolor tip requires its renderer.');
    for(const key of ['pigmentAmount','waterAmount','edgeSoftness','dryness','pigmentBuildup','pigmentDepletion','wetDiffusion','edgeBleeding'])if(o[key]!==undefined&&!bounded(o[key],0,1))throw Error('Invalid natural watercolor control.');
    if(o.pigmentReload!==undefined&&typeof o.pigmentReload!=='boolean')throw Error('Invalid pigment reload.');
    if(o.watercolorSeed!==undefined&&(!(o.watercolorEngine===1||[1,2].includes(o.watercolorMaterialVersion))||!Number.isInteger(o.watercolorSeed)||!bounded(o.watercolorSeed,0,4294967295)))throw Error('Invalid watercolor seed.');
    if(o.watercolorStyle!==undefined&&!['paper','dry','bloom'].includes(o.watercolorStyle))throw Error('Invalid wash style.');
    if(o.pigmentPooling!==undefined&&!bounded(o.pigmentPooling,0,1))throw Error('Invalid pigment pooling.');
    if(o.mixStops!==undefined&&(!Array.isArray(o.mixStops)||o.mixStops.length>200000||!o.mixStops.every((v:any)=>v&&bounded(v.x,-1e6,1e6)&&bounded(v.y,-1e6,1e6)&&/^#[\da-f]{6}$/i.test(v.color))))throw Error('Invalid pigment samples.');
    if(o.pressureFlow!==undefined&&typeof o.pressureFlow!=='boolean')throw Error('Invalid pressure flow.');
    if(o.brushTip!==undefined&&!isPaintTip(o.brushTip))throw Error('Unknown brush tip.');
    if(o.tipAngle!==undefined&&(!Number.isFinite(o.tipAngle)||o.tipAngle< -180||o.tipAngle>180))throw Error('Invalid tip angle.');
    if(o.tipSpacing!==undefined&&(!Number.isFinite(o.tipSpacing)||o.tipSpacing<.02||o.tipSpacing>.5))throw Error('Invalid tip spacing.');
    if(o.liveRefinementVersion!==undefined&&o.liveRefinementVersion!==1&&o.liveRefinementVersion!==2&&o.liveRefinementVersion!==3)throw Error('Unsupported live stroke refinement.');
    if(o.transform!==undefined&&(!Array.isArray(o.transform)||o.transform.length!==6||!o.transform.every((v:unknown)=>bounded(v,-1e6,1e6))))throw Error('Invalid stroke transform.');
    if(o.perspective!==undefined&&(!Array.isArray(o.perspective)||o.perspective.length!==9||!o.perspective.every((v:unknown)=>bounded(v,-1e6,1e6))))throw Error('Invalid perspective stroke transform.');
    if(o.captureZoom!==undefined&&!bounded(o.captureZoom,.25,8))throw Error('Invalid captured zoom for stroke.');
    for(const [key,min,max] of [['stabilization',0,1],['smoothness',0,100],['taperStart',0,1],['taperEnd',0,1],['textureStrength',0,1],['minSize',0,1],['maxSize',0,1],['minOpacity',0,1],['maxOpacity',0,1]] as const)if(o[key]!==undefined&&!bounded(o[key],min,max))throw Error('Invalid stroke setting.');
    if((o.minSize??0)>(o.maxSize??1)||(o.minOpacity??0)>(o.maxOpacity??1))throw Error('Minimum pressure response exceeds maximum.');
    if(o.pressureCurve!==undefined&&(!Array.isArray(o.pressureCurve)||o.pressureCurve.length!==5||o.pressureCurve.some((n:any,i:number)=>!n||n.x!==i/4||!bounded(n.y,0,1)||(i>0&&n.y<o.pressureCurve[i-1].y))))throw Error('Invalid pressure curve.');
    if(['pressureWidth','pressureOpacity','velocityTaper'].some(key=>o[key]!==undefined&&typeof o[key]!=='boolean'))throw Error('Invalid pressure control.');
   }else if(o.kind==='fill'){
    if(typeof o.png!=='string'||!o.png.startsWith('data:image/png;base64,')||o.png.length>50000000)throw Error('Invalid fill data.');
    if(o.under!==undefined&&typeof o.under!=='boolean')throw Error('Invalid fill placement.');
   }else if(o.kind==='image'){
    if(p.version<3||typeof o.png!=='string'||!o.png.startsWith('data:image/png;base64,')||o.png.length>50000000||![o.x,o.y].every((n:unknown)=>bounded(n,-1e6,1e6))||![o.width,o.height].every((n:unknown)=>bounded(n,.1,8192)))throw Error('Invalid placed image.');
   }else if(o.kind==='clear'){
    if(p.version<3||!Array.isArray(o.polygon)||o.polygon.length<3||o.polygon.length>200000||!o.polygon.every(point))throw Error('Invalid cleared selection.');
   }else if(o.kind==='transform'){
    if(!Array.isArray(o.polygon)||o.polygon.length<3||o.polygon.length>200000||!o.polygon.every(point)||!Array.isArray(o.matrix)||o.matrix.length!==6||!o.matrix.every((n:unknown)=>bounded(n,-1e6,1e6)))throw Error('Invalid transform data.');
   }else if(o.kind==='vector'){
    if(p.version<2||!Array.isArray(o.nodes)||o.nodes.length<2||o.nodes.length>10000||!o.nodes.every((n:any)=>point(n)&&n.in&&n.out&&finite(n.in.x)&&finite(n.in.y)&&finite(n.out.x)&&finite(n.out.y)&&[n.in.x,n.in.y,n.out.x,n.out.y].every(v=>Math.abs(v)<=1e6))||!bounded(o.width,.1,500)||!bounded(o.opacity,0,1)||!/^#[\da-f]{6}$/i.test(o.color)||typeof o.pressure!=='boolean'||!bounded(o.smoothness,0,100))throw Error('Invalid vector line.');
    if(o.profileVersion!==undefined&&o.profileVersion!==1&&o.profileVersion!==2&&o.profileVersion!==3&&o.profileVersion!==4&&o.profileVersion!==5&&o.profileVersion!==6)throw Error('Unsupported vector width renderer.');
    if(o.widthProfile!==undefined&&(!Array.isArray(o.widthProfile)||o.widthProfile.length<2||o.widthProfile.length>256||o.widthProfile.some((pt:any,i:number)=>!pt||!bounded(pt.t,0,1)||!bounded(pt.p,0,1)||(i>0&&pt.t<=o.widthProfile[i-1].t))||o.widthProfile[0].t!==0||o.widthProfile.at(-1).t!==1))throw Error('Invalid vector pressure profile.');
    if(o.profileVersion===6||o.inkSections!==undefined){
     if(o.profileVersion!==6||!Array.isArray(o.inkSections)||!o.inkSections.length||o.inkSections.length>=o.nodes.length||o.inkSections.some((s:any,i:number)=>!s||!Number.isInteger(s.end)||s.end<1||s.end>=o.nodes.length||(i>0&&s.end<=o.inkSections[i-1].end)||!Array.isArray(s.widthProfile)||s.widthProfile.length<2||s.widthProfile.length>256||s.widthProfile.some((pt:any,j:number)=>!pt||!bounded(pt.t,0,1)||!bounded(pt.p,0,1)||(j>0&&pt.t<=s.widthProfile[j-1].t))||s.widthProfile[0].t!==0||s.widthProfile.at(-1).t!==1)||o.inkSections.at(-1).end!==o.nodes.length-1)throw Error('Invalid streaming vector sections.');
    }
    for(const key of ['minWidthPercent','maxWidthPercent'] as const)if(o[key]!==undefined&&!bounded(o[key],1,300))throw Error('Invalid vector width level.');
    for(const key of ['taperStart','taperEnd'] as const)if(o[key]!==undefined&&!bounded(o[key],0,1))throw Error('Invalid vector taper.');
    if(o.minWidthPercent!==undefined&&o.maxWidthPercent!==undefined&&o.minWidthPercent>o.maxWidthPercent)throw Error('Vector width minimum exceeds maximum.');
    if(o.sourceNodes!==undefined&&(!Array.isArray(o.sourceNodes)||o.sourceNodes.length!==o.nodes.length||!o.sourceNodes.every((n:any)=>point(n)&&n.in&&n.out&&[n.in.x,n.in.y,n.out.x,n.out.y].every(finite))))throw Error('Invalid vector source nodes.');
    if(o.pressureCurve!==undefined&&(!Array.isArray(o.pressureCurve)||o.pressureCurve.length!==5||o.pressureCurve.some((n:any,i:number)=>!n||n.x!==i/4||!bounded(n.y,0,1)||(i>0&&n.y<o.pressureCurve[i-1].y))))throw Error('Invalid vector pressure curve.');
   }else throw Error('Unknown drawing operation.');
  }
 }
 if(p.substitutionShelf!==undefined){
  const shelf=p.substitutionShelf;
  if(p.version<3||!shelf||shelf.version!==1||!Array.isArray(shelf.items)||shelf.items.length>32)throw Error('Invalid drawing substitution shelf.');
  const seen=new Set<string>();
  for(const item of shelf.items){
   if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>60||!['mouth','eyes','hands','pose','fx','other'].includes(item.category)||!['raster','vector'].includes(item.layerKind)||!Array.isArray(item.operations)||item.operations.length<1||item.operations.length>1500)throw Error('Invalid drawing substitution.');
   seen.add(item.id);
   const source=p.layers[0],validationLayer={...source,kind:item.layerKind,operations:item.operations};
   validateProject({...p,motionPlanning:undefined,animation:undefined,substitutionShelf:undefined,cycleShelf:undefined,audio:undefined,activeLayerId:source.id,layers:[validationLayer]});
  }
 }
 if(p.cycleShelf!==undefined){
  const shelf=p.cycleShelf;
  if(p.version<3||!shelf||shelf.version!==1||!Array.isArray(shelf.items)||shelf.items.length>16)throw Error('Invalid animation cycle shelf.');
  const seenCycles=new Set<string>();
  for(const item of shelf.items){
   if(!item||typeof item.id!=='string'||!item.id||seenCycles.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>60||!['raster','vector'].includes(item.kind)||!Array.isArray(item.frames)||item.frames.length<2||item.frames.length>16)throw Error('Invalid reusable cycle.');
   seenCycles.add(item.id);
   for(const ops of item.frames){
    if(!Array.isArray(ops)||ops.length>1500)throw Error('Invalid cycle artwork.');
    const layer={...p.layers[0],kind:item.kind,operations:ops};
    validateProject({...p,motionPlanning:undefined,animation:undefined,substitutionShelf:undefined,cycleShelf:undefined,audio:undefined,activeLayerId:layer.id,layers:[layer]});
   }
  }
 }
 if(p.animation!==undefined){
  const a=p.animation;
  if(p.version<3||!a||a.version!==1||!Array.isArray(a.frames)||a.frames.length<1||a.frames.length>240||typeof a.activeFrameId!=='string')throw Error('Invalid animation timeline.');
  const frameIds=new Set<string>();let operationsCount=0;
  for(const frame of a.frames){
   if(!frame||typeof frame.id!=='string'||!frame.id||frameIds.has(frame.id)||!frame.drawings||typeof frame.drawings!=='object'||Array.isArray(frame.drawings))throw Error('Invalid drawing frame.');
   if(frame.hold!==undefined&&(!Number.isInteger(frame.hold)||frame.hold<1||frame.hold>24))throw Error('Invalid frame hold duration (1–24 frames).');
   frameIds.add(frame.id);
   const keys=Object.keys(frame.drawings);
   if(keys.length!==p.layers.length||keys.some(k=>!ids.has(k)))throw Error('Frame layer IDs do not match project layers.');
   const layers=p.layers.map((l:Layer)=>({...l,operations:frame.drawings[l.id]}));
   if(layers.some((l:Layer)=>!Array.isArray(l.operations)))throw Error('Invalid frame drawing operations.');
   operationsCount+=layers.reduce((sum:number,l:Layer)=>sum+l.operations.length,0);
   if(operationsCount>100000)throw Error('Animation has too many drawing operations.');
   // Reuse all existing stroke/vector/fill validation for every saved frame.
   validateProject({...p,motionPlanning:undefined,animation:undefined,substitutionShelf:undefined,cycleShelf:undefined,audio:undefined,layers});
  }
  if(a.layerHolds!==undefined){
   if(!a.layerHolds||typeof a.layerHolds!=='object'||Array.isArray(a.layerHolds)||Object.keys(a.layerHolds).some(id=>!ids.has(id)))throw Error('Invalid animation layer tracks.');
   for(const [id,track] of Object.entries(a.layerHolds) as [string,any][]){
    if(!track||!Array.isArray(track.held)||track.held.length>240||new Set(track.held).size!==track.held.length||track.held.some((fid:unknown)=>typeof fid!=='string'||!frameIds.has(fid)||fid===a.frames[0].id)||!track.stash||typeof track.stash!=='object'||Array.isArray(track.stash))throw Error('Invalid layer exposure holds.');
    if(Object.keys(track.stash).some(fid=>!track.held.includes(fid)))throw Error('Stashed drawing has no matching layer hold.');
    for(const ops of Object.values(track.stash) as any[]){
     if(!Array.isArray(ops))throw Error('Invalid stashed animation cel.');
     const layer=p.layers.find((l:Layer)=>l.id===id)!;
     validateProject({...p,motionPlanning:undefined,animation:undefined,substitutionShelf:undefined,cycleShelf:undefined,audio:undefined,activeLayerId:id,layers:[{...layer,operations:ops}]});
    }
   }
  }
  if(a.celLinks!==undefined){
   if(!a.celLinks||typeof a.celLinks!=='object'||Array.isArray(a.celLinks))throw Error('Invalid linked cel metadata.');
   for(const [layerId,groups] of Object.entries(a.celLinks) as [string,any][]){
    if(!ids.has(layerId)||!groups||typeof groups!=='object'||Array.isArray(groups))throw Error('Invalid linked cel layer.');
    const counts=new Map<string,number>();
    for(const [fid,group] of Object.entries(groups)){
     if(!frameIds.has(fid)||a.layerHolds?.[layerId]?.held.includes(fid)||typeof group!=='string'||!group||group.length>120)throw Error('Invalid linked key reference.');
     counts.set(group,(counts.get(group)??0)+1);
    }
    if([...counts.values()].some(n=>n<2))throw Error('Orphan linked drawing.');
    for(const group of counts.keys()){
     const members=Object.entries(groups).filter(([,v])=>v===group).map(([id])=>a.frames.find((f:any)=>f.id===id).drawings[layerId]);
     if(members.some((ops:any)=>JSON.stringify(ops)!==JSON.stringify(members[0])))throw Error('Linked drawing members disagree.');
    }
   }
  }
  if(!frameIds.has(a.activeFrameId))throw Error('Missing active drawing frame.');
  const active=a.frames.find((f:any)=>f.id===a.activeFrameId);
  if(p.layers.some((l:Layer)=>l.operations.length!==active.drawings[l.id].length||l.operations.some((o:Operation,i:number)=>o.id!==active.drawings[l.id][i].id)))throw Error('Active frame and canvas drawings disagree.');
 }
 if(p.audio!==undefined&&!validateSceneAudio(p.audio))throw Error('Invalid scene audio.');
 if(!validateMotionPlanning(p))throw Error('Invalid motion/timing notes.');
 if(p.camera!==undefined){if(!validateSceneCamera(p.camera))throw Error('Invalid scene camera.');p.camera=pruneCameraDepth(p.camera,ids);}
 if(!ids.has(p.activeLayerId)||!p.settings||typeof p.settings.guides!=='boolean')throw Error('Invalid document settings.');
 return p as Project;
}
