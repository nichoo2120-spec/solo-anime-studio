import {BrushSettingInput,BrushSettingSelect} from './BrushQuickSettings';
import {bitmapBlendModes,bitmapMaxTips,bitmapSelections,type BitmapBlendMode,type BitmapTipSelection} from '../core/bitmapBrush';
import {importInWorker} from '../core/brushImport/client';
import {useRef,useState} from 'react';
import {natureFlags,natureNumbers,type NatureSettings} from '../core/natureBrush';
import {ExactRange} from './ExactRange';

const percent=new Set(['scatter','sizeJitter','density','spacing','opacityJitter','grain']);
export function NatureBrushSettings({settings,change}:{settings:NatureSettings;change:(settings:NatureSettings)=>void}){
 const [alpha,setAlpha]=useState<'auto'|'luminance'|'alpha'>('auto');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const settingsRef=useRef(settings);settingsRef.current=settings;
 const bitmap=settings.bitmap;
 async function images(files:File[],grain:boolean){
  setBusy(true);setNotice('');
  try{
   const assets=await Promise.all(files.slice(0,grain?1:bitmapMaxTips).map(file=>importInWorker(file,grain?'luminance':alpha,()=>{})));
   const tips=assets.flatMap(a=>a[0]?.tips??[]);
   if(!tips.length)return;
   const current=settingsRef.current,settingsBitmap=current.bitmap??{version:1 as const,roundnessJitter:0,countJitter:0,bothAxes:true,textureMode:'multiply' as const,tips};
   change({...current,grain:grain&&current.grain===0?.5:current.grain,bitmap:grain?{...settingsBitmap,grain:tips[0]}:{...settingsBitmap,tips}});
  }catch(error){setNotice(error instanceof Error?error.message:'The image could not be loaded.');}
  finally{setBusy(false);}
 }
 return <div className="nature-brush-settings">
  <label className="studio-select">Image mask<BrushSettingSelect aria-label="Image mask" value={alpha} onChange={e=>setAlpha(e.target.value as typeof alpha)}><option value="auto">Auto</option><option value="luminance">Dark paint</option><option value="alpha">Use alpha</option></BrushSettingSelect></label>
  <label className="texture-import-button">Tip images<input type="file" aria-label="Tip images" multiple accept=".png,.jpg,.jpeg" disabled={busy} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void images(files,false);}}/></label>
  {notice&&<p role="alert">{notice}</p>}
  {bitmap&&<>
   <p className="hint">{bitmap.tips.length} bitmap {bitmap.tips.length===1?'tip':'tips'}</p>
   <button type="button" onClick={()=>change({...settings,bitmap:undefined})}>Use procedural tip</button>
   <label className="studio-select">Tip selection<BrushSettingSelect aria-label="Tip selection" value={bitmap.selection??'random'} onChange={e=>change({...settings,bitmap:{...bitmap,selection:e.target.value as BitmapTipSelection}})}>{bitmapSelections.map(value=><option key={value}>{value}</option>)}</BrushSettingSelect></label>
   <ExactRange name="Roundness jitter" min={0} max={100} unit="%" value={Math.round(bitmap.roundnessJitter*100)} set={value=>change({...settings,bitmap:{...bitmap,roundnessJitter:value/100}})}/>
   <ExactRange name="Count jitter" min={0} max={100} unit="%" value={Math.round(bitmap.countJitter*100)} set={value=>change({...settings,bitmap:{...bitmap,countJitter:value/100}})}/>
   <label className="onion-check"><BrushSettingInput type="checkbox" aria-label="Scatter on both axes" checked={bitmap.bothAxes} onChange={e=>change({...settings,bitmap:{...bitmap,bothAxes:e.target.checked}})}/>Scatter on both axes</label>
   <label className="texture-import-button">Grain image<input type="file" aria-label="Grain image" accept=".png,.jpg,.jpeg" disabled={busy} onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value='';if(files.length)void images(files,true);}}/></label>
   {bitmap.grain&&<button type="button" onClick={()=>change({...settings,bitmap:{...bitmap,grain:undefined}})}>Remove grain image</button>}
   <label className="studio-select">Texture blend mode<BrushSettingSelect aria-label="Texture blend mode" value={bitmap.textureMode} onChange={e=>change({...settings,bitmap:{...bitmap,textureMode:e.target.value as BitmapBlendMode}})}>{bitmapBlendModes.map(value=><option key={value}>{value}</option>)}</BrushSettingSelect></label>
  </>}
  {natureNumbers.filter(([id])=>id!=='seed').map(([id,label,min,max])=>{
   const scale=percent.has(id)?100:1;
   const unit=id==='rotation'?'°':id==='scale'?'×':scale===100||['hue','saturation','brightness'].includes(id)?'%':undefined;
   return <ExactRange key={id} live name={label} min={min*scale} max={max*scale} step={id==='scale'?.05:1} unit={unit} value={scale===100?Math.round(settings[id]*100):settings[id]} set={value=>change({...settings,[id]:value/scale})}/>;
  })}
  {natureFlags.map(([id,label])=><label key={id} className="onion-check"><BrushSettingInput type="checkbox" aria-label={label} checked={settings[id]} onChange={e=>change({...settings,[id]:e.target.checked})}/>{label}</label>)}
  <label className="studio-select">Second color<BrushSettingInput type="color" aria-label="Second color" value={settings.second} onChange={e=>change({...settings,second:e.target.value})}/></label>
  <div className="nature-seed">
   <label className="studio-select">Seed<BrushSettingInput aria-label="Seed" type="number" min={0} max={4294967295} step={1} value={settings.seed} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))change({...settings,seed:e.target.valueAsNumber});}}/></label>
   <button type="button" onClick={()=>change({...settings,seed:crypto.getRandomValues(new Uint32Array(1))[0]})}>New random</button>
  </div>
 </div>;
}
