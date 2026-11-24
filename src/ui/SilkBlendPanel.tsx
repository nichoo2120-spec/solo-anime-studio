import {memo} from 'react';
import {ExactRange} from './ExactRange';
import {silkModes,silkPresets,isSilkMode,type SilkMode} from '../core/silkBlend';
import type {BrushSettings} from '../engine/StudioEngine';
/** v0.5.238 Silk Blend controls, shown in the brush panel when Silk Blend is active. */
export const SilkBlendPanel=memo(function SilkBlendPanel({settings:s,patch,reset}:{settings:BrushSettings;patch:(p:Partial<BrushSettings>)=>void;reset:()=>void}){
 const mode:SilkMode=isSilkMode(s.silkMode)?s.silkMode:'soft',info=silkModes.find(m=>m.id===mode)!;
 const pct=(v:number|undefined,fallback:number)=>Math.round((v??fallback)*100);
 const active=silkPresets.find(p=>Object.entries(p.values).every(([k,v])=>(s as Record<string,unknown>)[k]===v))?.id;
 return <div className="silk-panel" role="group" aria-label="Silk Blend settings">
  <div className="silk-title"><span className="silk-badge" aria-hidden="true">✦</span><strong>SILK BLEND</strong><span>blends colours on this layer</span></div>
  <label className="studio-select">Mode<select aria-label="Silk Blend mode" value={mode} onChange={e=>patch({silkMode:e.target.value as SilkMode})}>{silkModes.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
  <p className="hint silk-hint">{info.hint}</p>
  <div className="silk-presets" role="group" aria-label="Silk Blend presets">{silkPresets.map(p=><button key={p.id} type="button" className={active===p.id?'active':''} aria-pressed={active===p.id} onClick={()=>patch({...p.values})}>{p.name}</button>)}</div>
  <ExactRange live name="Blend Strength" value={pct(s.silkStrength,.55)} unit="%" set={v=>patch({silkStrength:v/100})}/>
  <ExactRange live name="Colour Pickup" value={pct(s.silkPickup,.7)} unit="%" set={v=>patch({silkPickup:v/100})}/>
  <ExactRange live name="Wetness" value={pct(s.silkWetness,.35)} unit="%" set={v=>patch({silkWetness:v/100})}/>
  <ExactRange live name="Smoothing" value={Math.round(s.stabilization*100)} unit="%" set={v=>patch({stabilization:v/100})}/>
  <ExactRange live name="Spacing" min={2} max={50} value={pct(s.tipSpacing,.08)} unit="%" set={v=>patch({tipSpacing:v/100})}/>
  <ExactRange live name="Texture" value={pct(s.silkTexture,0)} unit="%" set={v=>patch({silkTexture:v/100})}/>
  <div className="silk-actions"><button type="button" aria-label="Reset Silk Blend" onClick={reset}>Reset</button></div>
  <p className="hint">Pen pressure changes size and blend strength. Silk Blend only picks up colour from the selected layer and never adds your brush colour.</p>
 </div>;
});
