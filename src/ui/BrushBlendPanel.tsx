import {memo} from 'react';
import {ExactRange} from './ExactRange';
import {blendDefaults,blendPresets,canBrushBlend,isBlendSample,blendStyleFor,blendStyleNames,type BrushBlendSettings,type BlendStyle} from '../core/brushBlend';
const styleHints:Record<BlendStyle,string>={water:'soft wet bleed, transparent pigment mixing and a cloudy, grainy wash',dry:'rough, broken, scratchy drag with bristle gaps',pencil:'a gentle graphite smudge with paper grain',ink:'a crisp wet-ink smear that drags colour a long way',air:'a very soft, wide airbrush blur',oil:'thick, buttery drag with soft bristle streaks',marker:'an even, transparent marker bleed',texture:'blending through a canvas grain',soft:'smooth, soft blending'};
import type {BrushSettings} from '../engine/StudioEngine';
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
/** v0.5.240 Blend settings (Photoshop Mixer Brush / CSP colour mixing style). */
export const BrushBlendSettingsPanel=memo(function BrushBlendSettingsPanel({settings:s,patch,shortcut}:{settings:BrushSettings;patch:Patch;shortcut?:string}){
 if(!canBrushBlend(s))return <p className="hint">This brush is already a blender. Its own settings are in Paint.</p>;
 const d=blendDefaults,active=blendPresets.find(p=>Object.entries(p.values).every(([k,v])=>((s as Record<string,unknown>)[k]??(d as Record<string,unknown>)[k])===v))?.id;
 const reset=()=>{const values:Partial<BrushBlendSettings>={...d};patch(values);};
 return <div className="brush-blend-panel" role="group" aria-label="Blend settings">
  <BrushBlendToggle settings={s} patch={patch} shortcut={shortcut}/>
  <p className="hint brush-blend-style" aria-label="Blend style">Blends like <strong>{blendStyleNames[blendStyleFor(s)]}</strong>: {styleHints[blendStyleFor(s)]}.</p>
  <p className="hint">Blend mode adds no colour. The brush blends the colours already on the canvas using its own tip, texture, grain, pressure and spacing.{shortcut?` Press ${shortcut.toUpperCase()} to switch Paint / Blend.`:''}</p>
  <div className="silk-presets" role="group" aria-label="Blend presets">{blendPresets.map(p=><button key={p.id} type="button" className={active===p.id?'active':''} aria-pressed={active===p.id} onClick={()=>patch({...p.values,bbEnabled:true})}>{p.name}</button>)}</div>
  <fieldset className="brush-blend-controls" disabled={!s.bbEnabled}>
   <ExactRange live name="Blend Amount" value={pct(s.bbAmount,d.bbAmount)} unit="%" set={v=>patch({bbAmount:v/100})}/>
   <ExactRange live name="Colour Pickup" value={pct(s.bbPickup,d.bbPickup)} unit="%" set={v=>patch({bbPickup:v/100})}/>
   <ExactRange live name="Wetness" value={pct(s.bbWetness,d.bbWetness)} unit="%" set={v=>patch({bbWetness:v/100})}/>
   <ExactRange live name="Mix" value={pct(s.bbMix,d.bbMix)} unit="%" set={v=>patch({bbMix:v/100})}/>
   <ExactRange live name="Blend Flow" value={pct(s.bbFlow,d.bbFlow)} unit="%" set={v=>patch({bbFlow:v/100})}/>
   <ExactRange live name="Stretch" value={pct(s.bbStretch,d.bbStretch)} unit="%" set={v=>patch({bbStretch:v/100})}/>
   <ExactRange live name="Paint Load" value={pct(s.bbPaintLoad,d.bbPaintLoad)} unit="%" set={v=>patch({bbPaintLoad:v/100})}/>
   <label className="studio-select">Sample<select aria-label="Blend sample" value={isBlendSample(s.bbSample)?s.bbSample:'layer'} onChange={e=>patch({bbSample:e.target.value as 'layer'|'all'})}><option value="layer">Current layer</option><option value="all">All layers</option></select></label>
   <label className="check-row"><span>Clean brush after each stroke</span><input aria-label="Clean brush after each stroke" type="checkbox" checked={s.bbClean??d.bbClean} onChange={e=>patch({bbClean:e.target.checked})}/></label>
   <label className="check-row"><span>Pen pressure changes blend</span><input aria-label="Pressure changes blend" type="checkbox" checked={s.bbPressure??d.bbPressure} onChange={e=>patch({bbPressure:e.target.checked})}/></label>
   <label className="check-row"><span>Protect transparency</span><input aria-label="Protect transparency" type="checkbox" checked={s.bbProtectAlpha??d.bbProtectAlpha} onChange={e=>patch({bbProtectAlpha:e.target.checked})}/></label>
  </fieldset>
  <div className="silk-actions"><button type="button" aria-label="Reset Blend settings" onClick={reset}>Reset blend</button></div>
  <p className="hint">Blend Amount: how much the blend replaces the original. Colour Pickup: how fast the brush picks up colour. Wetness: how softly picked colours bleed. Mix: canvas colour versus colour carried in the brush. Flow: how fast the blend builds up. Stretch: how far colour is dragged before the brush runs dry. Paint Load: adds some of your brush colour (0% = pure blending).</p>
  <p className="hint">Sample: blend only this layer, or pick up colours from all visible layers (the result is still painted on this layer). Clean brush: off keeps the colour the last stroke ended with.</p>
 </div>;
});
