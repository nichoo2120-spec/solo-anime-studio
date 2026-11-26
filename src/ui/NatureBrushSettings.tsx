import {natureFlags,natureNumbers,type NatureSettings} from '../core/natureBrush';
import {ExactRange} from './ExactRange';

const percent=new Set(['scatter','sizeJitter','density','spacing','opacityJitter','grain']);
export function NatureBrushSettings({settings,change}:{settings:NatureSettings;change:(settings:NatureSettings)=>void}){
 return <div className="nature-brush-settings">
  {natureNumbers.filter(([id])=>id!=='seed').map(([id,label,min,max])=>{
   const scale=percent.has(id)?100:1;
   const unit=id==='rotation'?'°':id==='scale'?'×':scale===100||['hue','saturation','brightness'].includes(id)?'%':undefined;
   return <ExactRange key={id} live name={label} min={min*scale} max={max*scale} step={id==='scale'?.05:1} unit={unit} value={scale===100?Math.round(settings[id]*100):settings[id]} set={value=>change({...settings,[id]:value/scale})}/>;
  })}
  {natureFlags.map(([id,label])=><label key={id} className="onion-check"><input type="checkbox" checked={settings[id]} onChange={e=>change({...settings,[id]:e.target.checked})}/>{label}</label>)}
  <label className="studio-select">Second color<input type="color" aria-label="Second color" value={settings.second} onChange={e=>change({...settings,second:e.target.value})}/></label>
  <div className="nature-seed">
   <label className="studio-select">Seed<input aria-label="Seed" type="number" min={0} max={4294967295} step={1} value={settings.seed} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))change({...settings,seed:e.target.valueAsNumber});}}/></label>
   <button type="button" onClick={()=>change({...settings,seed:crypto.getRandomValues(new Uint32Array(1))[0]})}>New random</button>
  </div>
 </div>;
}
