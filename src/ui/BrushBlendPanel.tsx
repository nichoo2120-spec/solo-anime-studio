import {memo,useCallback,useEffect,useRef} from 'react';
import {ExactRange} from './ExactRange';
import {blendDefaultsFor,blendModes,blendPresets,brushBlendSettingsFor,canBlurBlendStyle,canBrushBlend,isBlendMode,isBlendSample,blendStyleFor,blendStyleNames,type BrushBlendSettings,type BlendMode,type BlendStyle} from '../core/brushBlend';
import type {BrushSettings} from '../engine/StudioEngine';
import type {SilkBlendControls} from '../core/silkBlend';
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
const hex=(r:number,g:number,b:number)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
/** Small, self-contained blend swatch. It redraws only after a settings value changes. */
function BlendPreview({settings:s,defaults:d,style}:{settings:BrushSettings;defaults:ReturnType<typeof blendDefaultsFor>;style:BlendStyle}){
 const ref=useRef<HTMLCanvasElement>(null);
 const draw=useCallback(()=>{
  const canvas=ref.current;if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#101c22';ctx.fillRect(0,0,w,h);
  const a=[61,151,226],b=[226,100,124],blend=clampPreview(s.bbMix??d.bbMix),amount=clampPreview(s.bbAmount??d.bbAmount),carry=clampPreview(s.bbColorCarry??d.bbColorCarry);
  const middle=a.map((v,i)=>v+(b[i]-v)*(.5+.38*blend*(1-carry)));
  const x0=48,x1=w-48,y=h/2,gradient=ctx.createLinearGradient(x0,0,x1,0),soft=clampPreview(s.bbSoftness??d.bbSoftness),wet=clampPreview(s.bbWetness??d.bbWetness);
  const blendPoint=.35+carry*.3;gradient.addColorStop(0,hex(...a as [number,number,number]));gradient.addColorStop(Math.max(.08,blendPoint-.08-soft*.06),hex(...middle as [number,number,number]));gradient.addColorStop(Math.min(.92,blendPoint+.08+wet*.05),hex(...middle as [number,number,number]));gradient.addColorStop(1,hex(...b as [number,number,number]));
  ctx.save();ctx.lineCap='round';ctx.strokeStyle=gradient;ctx.lineWidth=12+soft*4;ctx.filter=canBlurBlendStyle(style)&&soft>0?`blur(${(soft*1.5).toFixed(1)}px)`:'none';ctx.globalAlpha=.45+amount*.55;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.restore();
  ctx.fillStyle=hex(...a as [number,number,number]);ctx.fillRect(8,12,28,h-24);ctx.fillStyle=hex(...b as [number,number,number]);ctx.fillRect(w-36,12,28,h-24);
 },[style,s.bbMix,s.bbAmount,s.bbColorCarry,s.bbSoftness,s.bbWetness,d.bbMix,d.bbAmount,d.bbColorCarry,d.bbSoftness,d.bbWetness]);
 useEffect(()=>{const frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame);},[draw]);
 return <canvas ref={ref} className="brush-blend-preview" width={360} height={44} role="img" aria-label="Live preview of two colours blending with the current settings"/>;
}
function clampPreview(v:number){return Math.max(0,Math.min(1,v));}
/** v0.5.244 Blend settings. Existing controls remain available alongside v3 dynamics. */
export const BrushBlendSettingsPanel=memo(function BrushBlendSettingsPanel({settings:s,patch,shortcut,brushDefaults,silkSettings,onSaveAs}:{settings:BrushSettings;patch:Patch;shortcut?:string;brushDefaults?:Partial<BrushSettings>;silkSettings?:Partial<BrushSettings&SilkBlendControls>;onSaveAs?:(name:string)=>void}){
 if(!canBrushBlend(s))return <p className="hint">This brush is already a blender. Its own settings are in Paint.</p>;
 const familyDefaults=blendDefaultsFor(s),defaults=brushBlendSettingsFor({...s,...brushDefaults}),mode:BlendMode=isBlendMode(s.bbMode)?s.bbMode:familyDefaults.bbMode,style=blendStyleFor(s);
 const active=blendPresets.find(p=>Object.entries(p.values).every(([k,v])=>((s as Record<string,unknown>)[k]??(familyDefaults as Record<string,unknown>)[k])===v))?.id;
 const reset=()=>patch({...defaults,bbEnabled:true});
 const copyFromSilk=()=>patch({bbEnabled:true,bbMode:isBlendMode(silkSettings?.silkMode)?silkSettings.silkMode:familyDefaults.bbMode,bbAmount:silkSettings?.silkStrength??defaults.bbAmount,bbPickup:silkSettings?.silkPickup??defaults.bbPickup,bbWetness:silkSettings?.silkWetness??defaults.bbWetness,bbTextureKeep:silkSettings?.silkTexture??defaults.bbTextureKeep,bbSmoothing:silkSettings?.stabilization??defaults.bbSmoothing,bbEdgeDarkness:silkSettings?.edgeDarkness??0});
 const saveAs=()=>{const name=window.prompt('Name this brush in My brushes',s.brushKind?`${s.brushKind} blend`: 'Custom blend brush')?.trim();if(name)onSaveAs?.(name.slice(0,60));};
 return <div className="brush-blend-panel" role="group" aria-label="Blend settings">
  <BrushBlendToggle settings={s} patch={patch} shortcut={shortcut}/>
  {!s.bbEnabled?<p className="hint">Switch to Blend to adjust this brush’s blending. Its family look stays <strong>{blendStyleNames[style]}</strong>.</p>:<>
   <BlendPreview settings={s} defaults={familyDefaults} style={style}/>
   <label className="studio-select">Blend mode<select aria-label="Blend mode" value={mode} onChange={e=>patch({bbMode:e.target.value as BlendMode})}>{blendModes.map(m=><option key={m} value={m}>{m[0].toUpperCase()+m.slice(1)}</option>)}</select></label>
   <p className="hint brush-blend-style" aria-label="Brush family style">Brush character: <strong>{blendStyleNames[style]}</strong> — {styleHints[style]}.</p>
   <p className="hint">Blend mode uses this brush’s nib and grain to mix existing canvas colours. {shortcut?`Press ${shortcut.toUpperCase()} to switch Paint / Blend.`:''}</p>
   <div className="silk-presets" role="group" aria-label="Blend presets">{blendPresets.map(p=><button key={p.id} type="button" className={active===p.id?'active':''} aria-pressed={active===p.id} onClick={()=>patch({...p.values,bbEnabled:true})}>{p.name}</button>)}</div>
   <fieldset className="brush-blend-controls">
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
     <label className="studio-select">Sample<select aria-label="Blend sample" value={isBlendSample(s.bbSample)?s.bbSample:'layer'} onChange={e=>patch({bbSample:e.target.value as 'layer'|'all'})}><option value="layer">Current layer</option><option value="all">All layers</option></select></label>
     <label className="check-row"><span>Clean brush after each stroke</span><input aria-label="Clean brush after each stroke" type="checkbox" checked={s.bbClean??defaults.bbClean} onChange={e=>patch({bbClean:e.target.checked})}/></label>
     <label className="check-row"><span>Pen pressure changes blend</span><input aria-label="Pressure changes blend" type="checkbox" checked={s.bbPressure??defaults.bbPressure} onChange={e=>patch({bbPressure:e.target.checked})}/></label>
     <label className="check-row"><span>Protect transparency</span><input aria-label="Protect transparency" type="checkbox" checked={s.bbProtectAlpha??defaults.bbProtectAlpha} onChange={e=>patch({bbProtectAlpha:e.target.checked})}/></label>
    </fieldset>
   </details>
   <div className="silk-actions brush-blend-actions"><button type="button" onClick={copyFromSilk}>Copy settings from Silk Blend</button><button type="button" onClick={saveAs}>Save as My Brush</button><button type="button" aria-label="Reset Blend settings" onClick={reset}>Reset to brush default</button></div>
  </>}
 </div>;
});
