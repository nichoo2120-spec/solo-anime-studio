import {BrushSettingInput,BrushSettingSelect} from './BrushQuickSettings';
import {memo,useEffect,useRef} from 'react';
import {ExactRange} from './ExactRange';
import {blendDefaultsFor,blendModes,blendPresets,brushBlendSettingsFor,blendPressureCurves,blendRenderStyles,blendStrengthPresets,canBrushBlend,isBlendMode,isBlendSample,blendStyleFor,blendStyleNames,type BlendPressureCurve,type BlendRenderStyle,type BlendMode,type BlendStyle} from '../core/brushBlend';
import {brushStrokeMetadata} from '../core/paintTips';
import type {Stroke} from '../core/model';
import {drawStroke} from '../engine/renderer';
import {renderBrushBlend} from '../engine/brushBlend';
import type {BrushSettings} from '../engine/StudioEngine';
import {silkPresets,type SilkBlendControls} from '../core/silkBlend';
import {SilkBlendPanel} from './SilkBlendPanel';
import {renderSilkStroke} from '../engine/silkBlend';
const styleHints:Record<BlendStyle,string>={water:'soft wet bleed, transparent pigment mixing and a cloudy, grainy wash',dry:'rough, broken, scratchy drag with bristle gaps',pencil:'a gentle graphite smudge with paper grain',ink:'a crisp wet-ink smear that drags colour a long way',air:'a very soft, wide airbrush blur',oil:'thick, buttery drag with soft bristle streaks',marker:'a crisp marker smudge',texture:'blending through a canvas grain',soft:'smooth, soft blending'};
type Patch=(p:Partial<BrushSettings>)=>void;
/** v0.5.240 Paint / Blend switch, shown for every paint brush. */
export const BrushBlendToggle=memo(function BrushBlendToggle({settings:s,patch,shortcut}:{settings:BrushSettings;patch:Patch;shortcut?:string}){
 if(!canBrushBlend(s))return null;
 const on=!!s.bbEnabled,key=shortcut?` (${shortcut.toUpperCase()})`:'';
 return <div className="brush-blend-toggle" role="group" aria-label="Paint or Blend">
  <button type="button" aria-pressed={!on} className={on?'':'active'} title={'Paint: the brush lays down its colour'+key} onClick={()=>patch({bbEnabled:false})}>Paint</button>
  <button type="button" aria-pressed={on} className={on?'active':''} title={'Blend: the brush blends the colours already there, using its own tip and texture'+key} onClick={()=>patch({bbEnabled:true})}>Blend</button>
 </div>;
});
const pct=(v:number|undefined,fallback:number)=>Math.round((v??fallback)*100);
function BlendPreview({settings:s}:{settings:BrushSettings}){
 const ref=useRef<HTMLCanvasElement>(null);
 const mask=useRef<HTMLCanvasElement|null>(null);
 const latest=useRef(s);
 latest.current=s;
 const values=JSON.stringify(s);
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>{
   const canvas=ref.current;
   if(!canvas)return;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return;
   const w=canvas.width,h=canvas.height,settings=latest.current;
   const swatch=mask.current??=document.createElement('canvas');
   if(swatch.width!==w||swatch.height!==h){swatch.width=w;swatch.height=h;}
   const mc=swatch.getContext('2d',{willReadFrequently:true})!;
   mc.clearRect(0,0,w,h);
   ctx.fillStyle='#101c22';ctx.fillRect(0,0,w,h);
   ctx.fillStyle='#3d97e2';ctx.fillRect(12,6,w/2-12,h-12);
   ctx.fillStyle='#e2647c';ctx.fillRect(w/2,6,w/2-12,h-12);
   const stroke:Stroke={
    ...brushStrokeMetadata(settings),id:'blend-preview',kind:'stroke',tool:'brush',
    points:[{x:119,y:25,p:.1},{x:161,y:18,p:.1},{x:180,y:25,p:.1},{x:203,y:19,p:.1},{x:241,y:24,p:.1}],
    size:33,color:settings.color,opacity:settings.opacity,pressure:true,pressureWidth:false,
    pressureFlow:false,pressureOpacity:false,response:settings.response,brushKind:settings.brushKind,
    textureStrength:settings.textureStrength,stabilization:Math.max(settings.stabilization,settings.bbSmoothing??0),
   };
   if(stroke.silkBlendVersion)renderSilkStroke(ctx,stroke);
   else{drawStroke(mc,stroke);renderBrushBlend(ctx,swatch,stroke);}
  });
  return()=>cancelAnimationFrame(frame);
 },[values]);
 return <canvas ref={ref} className="brush-blend-preview" width={360} height={44} role="img" aria-label="Live preview of two colours blending with the current settings"/>;
}
/** v0.5.244 Blend settings. Existing controls remain available alongside v3 dynamics. */
export const BrushBlendSettingsPanel=memo(function BrushBlendSettingsPanel({settings:s,patch,shortcut,brushDefaults,silkSettings,onSaveAs}:{settings:BrushSettings;patch:Patch;shortcut?:string;brushDefaults?:Partial<BrushSettings>;silkSettings?:Partial<BrushSettings&SilkBlendControls>;onSaveAs?:(name:string)=>void}){
 if(!canBrushBlend(s))return <p className="hint">This brush is already a blender. Its own settings are in Paint.</p>;
 const familyDefaults=blendDefaultsFor(s),defaults=brushBlendSettingsFor(brushDefaults??s),values=brushBlendSettingsFor(s),mode:BlendMode=isBlendMode(s.bbMode)?s.bbMode:familyDefaults.bbMode,style=blendStyleFor(s);
 const active=blendPresets.find(p=>Object.entries(p.values).every(([k,v])=>((s as Record<string,unknown>)[k]??(familyDefaults as Record<string,unknown>)[k])===v))?.id;
 const reset=()=>patch({...defaults,bbEnabled:true});
 const resetSilk=()=>{
  const standard=silkPresets[0].values,b=brushDefaults;
  patch({
   silkMode:b?.silkMode??standard.silkMode,silkStrength:b?.silkStrength??standard.silkStrength,
   silkPickup:b?.silkPickup??standard.silkPickup,silkWetness:b?.silkWetness??standard.silkWetness,
   silkTexture:b?.silkTexture??standard.silkTexture,tipSpacing:b?.tipSpacing??standard.tipSpacing,
   stabilization:b?.stabilization??standard.stabilization,opacity:b?.opacity??standard.opacity,
   size:b?.size??s.size,
  });
 };
 const copyFromSilk=()=>patch({bbEnabled:true,bbMode:isBlendMode(silkSettings?.silkMode)?silkSettings.silkMode:familyDefaults.bbMode,bbAmount:silkSettings?.silkStrength??defaults.bbAmount,bbPickup:silkSettings?.silkPickup??defaults.bbPickup,bbWetness:silkSettings?.silkWetness??defaults.bbWetness,bbTextureKeep:silkSettings?.silkTexture??defaults.bbTextureKeep,bbSmoothing:silkSettings?.stabilization??defaults.bbSmoothing,bbEdgeDarkness:silkSettings?.edgeDarkness??0});
 const saveAs=()=>{const name=window.prompt('Name this brush in My brushes',s.brushKind?`${s.brushKind} blend`: 'Custom blend brush')?.trim();if(name)onSaveAs?.(name.slice(0,60));};
 return <div className="brush-blend-panel" role="group" aria-label="Blend settings">
  <BrushBlendToggle settings={s} patch={patch} shortcut={shortcut}/>
  {!s.bbEnabled?<p className="hint">Switch to Blend to adjust this brush’s blending. Its family look stays <strong>{blendStyleNames[style]}</strong>.</p>:<>
   <BlendPreview settings={s}/>
   <label className="studio-select">Blend style<BrushSettingSelect aria-label="Blend style" value={values.bbRenderStyle} onChange={e=>patch({bbRenderStyle:e.target.value as BlendRenderStyle})}>{Object.entries(blendRenderStyles).map(([key,name])=><option key={key} value={key}>{name}</option>)}</BrushSettingSelect></label>
   {values.bbRenderStyle==='silk'?<SilkBlendPanel settings={s} patch={patch} reset={resetSilk}/>:<>
   <label className="studio-select">Blend mode<BrushSettingSelect aria-label="Blend mode" value={mode} onChange={e=>patch({bbMode:e.target.value as BlendMode})}>{blendModes.map(m=><option key={m} value={m}>{m[0].toUpperCase()+m.slice(1)}</option>)}</BrushSettingSelect></label>
   <p className="hint brush-blend-style" aria-label="Brush family style">Brush character: <strong>{blendStyleNames[style]}</strong> — {styleHints[style]}.</p>
   <p className="hint">Blend mode uses this brush’s nib and grain to mix existing canvas colours. {shortcut?`Press ${shortcut.toUpperCase()} to switch Paint / Blend.`:''}</p>
   <div className="silk-presets" role="group" aria-label="Blend presets">{blendPresets.map(p=><button key={p.id} type="button" className={active===p.id?'active':''} aria-pressed={active===p.id} onClick={()=>patch({...p.values,bbEnabled:true})}>{p.name}</button>)}</div>
   <div className="silk-presets" role="group" aria-label="Blend strength presets">{blendStrengthPresets.map(p=><button key={p.name} type="button" className={values.bbStrength===p.strength?'active':''} aria-pressed={values.bbStrength===p.strength} onClick={()=>patch({bbStrength:p.strength})}>{p.name}</button>)}</div>
   <fieldset className="brush-blend-controls">
    <ExactRange live name="Blend strength" value={pct(values.bbStrength,1)} max={200} unit="%" set={v=>patch({bbStrength:v/100})}/>
    <label className="check-row"><span>Pressure affects blend</span><BrushSettingInput aria-label="Pressure changes blend" type="checkbox" checked={values.bbPressure} onChange={e=>patch({bbPressure:e.target.checked})}/></label>
    <label className="studio-select">Pressure curve<BrushSettingSelect aria-label="Blend pressure curve" value={values.bbPressureCurve} onChange={e=>patch({bbPressureCurve:e.target.value as BlendPressureCurve})}>{blendPressureCurves.map(curve=><option key={curve} value={curve}>{curve[0].toUpperCase()+curve.slice(1)}</option>)}</BrushSettingSelect></label>
    <ExactRange live name="Minimum blend at light pressure" value={pct(values.bbMinPressure,.7)} unit="%" set={v=>patch({bbMinPressure:v/100})}/>
    <ExactRange live name="Blend amount" value={pct(s.bbAmount,defaults.bbAmount)} unit="%" set={v=>patch({bbAmount:v/100})}/>
    <ExactRange live name="Pickup" value={pct(s.bbPickup,defaults.bbPickup)} unit="%" set={v=>patch({bbPickup:v/100})}/>
    <ExactRange live name="Drag / pull length" value={pct(s.bbStretch,defaults.bbStretch)} unit="%" set={v=>patch({bbStretch:v/100})}/>
    <ExactRange live name="Wetness" value={pct(s.bbWetness,defaults.bbWetness)} unit="%" set={v=>patch({bbWetness:v/100})}/>
    <ExactRange live name="Color carry" value={pct(s.bbColorCarry,defaults.bbColorCarry)} unit="%" set={v=>patch({bbColorCarry:v/100})}/>
    <ExactRange live name="Softness" value={pct(s.bbSoftness,defaults.bbSoftness)} unit="%" set={v=>patch({bbSoftness:v/100})}/>
    <ExactRange live name="Texture keep" value={pct(s.bbTextureKeep,defaults.bbTextureKeep)} unit="%" set={v=>patch({bbTextureKeep:v/100})}/>
    <ExactRange live name="Smoothing" value={pct(s.bbSmoothing,defaults.bbSmoothing)} unit="%" set={v=>patch({bbSmoothing:v/100})}/>
    <ExactRange live name="Edge darkness" value={pct(s.bbEdgeDarkness,defaults.bbEdgeDarkness)} unit="%" set={v=>patch({bbEdgeDarkness:v/100})}/>
   </fieldset>
   <details className="brush-blend-extras"><summary>More blend controls</summary>
    <fieldset className="brush-blend-controls">
     <ExactRange live name="Mix" value={pct(s.bbMix,defaults.bbMix)} unit="%" set={v=>patch({bbMix:v/100})}/>
     <ExactRange live name="Blend Flow" value={pct(s.bbFlow,defaults.bbFlow)} unit="%" set={v=>patch({bbFlow:v/100})}/>
     <ExactRange live name="Paint Load" value={pct(s.bbPaintLoad,defaults.bbPaintLoad)} unit="%" set={v=>patch({bbPaintLoad:v/100})}/>
     <label className="studio-select">Sample<BrushSettingSelect aria-label="Blend sample" value={isBlendSample(s.bbSample)?s.bbSample:'layer'} onChange={e=>patch({bbSample:e.target.value as 'layer'|'all'})}><option value="layer">Current layer</option><option value="all">All layers</option></BrushSettingSelect></label>
     <label className="check-row"><span>Clean brush after each stroke</span><BrushSettingInput aria-label="Clean brush after each stroke" type="checkbox" checked={s.bbClean??defaults.bbClean} onChange={e=>patch({bbClean:e.target.checked})}/></label>
     <label className="check-row"><span>Protect transparency</span><BrushSettingInput aria-label="Protect transparency" type="checkbox" checked={s.bbProtectAlpha??defaults.bbProtectAlpha} onChange={e=>patch({bbProtectAlpha:e.target.checked})}/></label>
    </fieldset>
   </details>
   <div className="silk-actions brush-blend-actions"><button type="button" onClick={copyFromSilk}>Copy settings from Silk Blend</button><button type="button" aria-label="Reset Blend settings" onClick={reset}>Reset to brush default</button></div>
   </>}
   <div className="silk-actions brush-blend-actions"><button type="button" onClick={saveAs}>Save as My Brush</button></div>
  </>}
 </div>;
});
