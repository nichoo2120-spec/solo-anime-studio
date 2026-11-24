import {memo,useEffect,useRef,useState} from 'react';
import {ExactRange} from './ExactRange';
import {dualModes,shapeDefaults,brushStampTip,canShapeBrush,isDualMode,type DualMode} from '../core/brushShape';
import {brushStrokeMetadata} from '../core/paintTips';
import {CUSTOM_NAME_MAX,type BrushLibrary,type BrushPreset} from '../core/brushes';
import {drawStampStroke} from '../engine/stampBrush';
import {strokeGeometry} from '../engine/strokeGeometry';
import type {BrushSettings} from '../engine/StudioEngine';
import type {Stroke} from '../core/model';
type Patch=(p:Partial<BrushSettings>)=>void;
const pct=(v:number|undefined,fallback:number)=>Math.round((v??fallback)*100);

/** Live preview: one large stamp on the left and a short stroke on the right. */
export const StampPreview=memo(function StampPreview({settings,label,force}:{settings:BrushSettings;label:string;force:'shape'|'dual'}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);
  const s={...settings,tsEnabled:force==='shape'?true:settings.tsEnabled,dbEnabled:force==='dual'?true:settings.dbEnabled};
  const meta=brushStrokeMetadata(s) as Partial<Stroke>;if(meta.stampVersion!==1)return;
  const make=(points:{x:number;y:number;p:number}[],size:number,id:string)=>({...meta,id,kind:'stroke',tool:'brush',color:'#e6eef2',size,opacity:1,pressure:true,response:1,minSize:.35,points,tipSpacing:s.tipSpacing,flow:Math.max(.35,s.flow??1)}) as Stroke;
  const one=make([{x:46,y:46,p:1}],64,'preview-tip');drawStampStroke(ctx,one,strokeGeometry(one));
  const pts=Array.from({length:40},(_,i)=>{const t=i/39;return {x:104+t*196,y:46+22*Math.sin(t*Math.PI*2),p:.35+.65*Math.sin(t*Math.PI)};});
  const line=make(pts,22,'preview-line');drawStampStroke(ctx,line,strokeGeometry(line));
 },[settings,force]);
 return <canvas ref={ref} className="stamp-preview" width={320} height={92} role="img" aria-label={label}/>;
});

/** v0.5.241 Tip shape: stretch and squeeze the brush tip (Photoshop Brush Tip Shape). */
export const TipShapePanel=memo(function TipShapePanel({settings:s,patch}:{settings:BrushSettings;patch:Patch}){
 if(!canShapeBrush(s))return <p className="hint">This brush is a blender and keeps its own tip.</p>;
 const d=shapeDefaults,on=!!s.tsEnabled;
 return <div className="brush-shape-panel" role="group" aria-label="Tip shape settings">
  <label className="check-row"><span>Custom tip shape</span><input aria-label="Custom tip shape" type="checkbox" checked={on} onChange={e=>patch({tsEnabled:e.target.checked})}/></label>
  <StampPreview settings={s} force="shape" label="Live tip preview"/>
  <fieldset className="brush-blend-controls" disabled={!on}>
   <ExactRange live name="Tip roundness (shape)" min={5} max={100} value={pct(s.tsRoundness,d.tsRoundness)} unit="%" set={v=>patch({tsRoundness:v/100})}/>
   <ExactRange live name="Tip angle (shape)" min={-180} max={180} value={Math.round(s.tsAngle??0)} unit="°" set={v=>patch({tsAngle:v})}/>
   <ExactRange live name="Scale X" min={10} max={300} value={pct(s.tsScaleX,1)} unit="%" set={v=>patch({tsScaleX:v/100})}/>
   <ExactRange live name="Scale Y" min={10} max={300} value={pct(s.tsScaleY,1)} unit="%" set={v=>patch({tsScaleY:v/100})}/>
   <label className="check-row"><span>Flip X</span><input aria-label="Flip X" type="checkbox" checked={!!s.tsFlipX} onChange={e=>patch({tsFlipX:e.target.checked})}/></label>
   <label className="check-row"><span>Flip Y</span><input aria-label="Flip Y" type="checkbox" checked={!!s.tsFlipY} onChange={e=>patch({tsFlipY:e.target.checked})}/></label>
   <label className="check-row"><span>Angle follows stroke direction</span><input aria-label="Angle follows stroke direction" type="checkbox" checked={!!s.tsFollow} onChange={e=>patch({tsFollow:e.target.checked})}/></label>
   <label className="check-row"><span>Pen tilt turns and stretches the tip</span><input aria-label="Pen tilt controls tip" type="checkbox" checked={!!s.tsTilt} onChange={e=>patch({tsTilt:e.target.checked})}/></label>
  </fieldset>
  <div className="silk-actions"><button type="button" aria-label="Reset tip shape" onClick={()=>patch({tsRoundness:1,tsAngle:0,tsScaleX:1,tsScaleY:1,tsFlipX:false,tsFlipY:false,tsFollow:false,tsTilt:false})}>Reset shape</button></div>
  <p className="hint">Roundness squeezes the tip, Scale X and Scale Y stretch it, Angle turns it and Flip mirrors it. Angle follows direction turns the tip with your line; Pen tilt uses your pen's tilt (pen only).</p>
  <p className="hint">With a custom tip shape the brush's tip and texture are stamped along the line, like Photoshop. Special effects of some brushes (wet watercolour edges, ink line smoothing) are replaced by the stamp while this is on.</p>
 </div>;
});

/** v0.5.241 Dual Brush: merge a second brush's tip and texture into this one. */
export const DualBrushPanel=memo(function DualBrushPanel({settings:s,patch,library,onSaveAs}:{settings:BrushSettings;patch:Patch;library:BrushLibrary;onSaveAs:(name:string)=>void}){
 const [name,setName]=useState('');
 if(!canShapeBrush(s))return <p className="hint">This brush is a blender and keeps its own tip.</p>;
 const d=shapeDefaults,on=!!s.dbEnabled,choices=library.presets.filter(p=>p.category!=='Eraser'&&canShapeBrush(p.settings));
 const pick=(p:BrushPreset|undefined)=>{if(!p)return;const t=brushStampTip(p.settings);patch({dbBrushId:p.id,dbBrushName:p.name.slice(0,60),dbTip:t.tip,dbHardness:t.hardness,dbTexture:t.texture,dbEnabled:true});};
 const mode:DualMode=isDualMode(s.dbMode)?s.dbMode:'multiply';
 return <div className="brush-shape-panel" role="group" aria-label="Dual brush settings">
  <label className="check-row"><span>Dual brush (merge two brushes)</span><input aria-label="Use dual brush" type="checkbox" checked={on} onChange={e=>{if(e.target.checked&&!s.dbTip)pick(choices.find(p=>p.settings.brushTip==='chalk')??choices[0]);else patch({dbEnabled:e.target.checked});}}/></label>
  <StampPreview settings={s} force="dual" label="Dual brush preview"/>
  <fieldset className="brush-blend-controls" disabled={!on}>
   <label className="studio-select">Second brush<select aria-label="Second brush" value={s.dbBrushId&&choices.some(p=>p.id===s.dbBrushId)?s.dbBrushId:''} onChange={e=>pick(choices.find(p=>p.id===e.target.value))}><option value="" disabled>{s.dbBrushName??'Choose a brush'}</option>{choices.map(p=><option key={p.id} value={p.id}>{p.custom?'★ ':''}{p.name}</option>)}</select></label>
   <label className="studio-select">Mode<select aria-label="Dual brush mode" value={mode} onChange={e=>patch({dbMode:e.target.value as DualMode})}>{dualModes.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
   <p className="hint silk-hint">{dualModes.find(m=>m.id===mode)!.hint}</p>
   <ExactRange live name="Second tip size" min={10} max={300} value={pct(s.dbScale,d.dbScale)} unit="%" set={v=>patch({dbScale:v/100})}/>
   <ExactRange live name="Second tip spacing" min={2} max={200} value={pct(s.dbSpacing,d.dbSpacing)} unit="%" set={v=>patch({dbSpacing:v/100})}/>
   <ExactRange live name="Scatter" min={0} max={200} value={pct(s.dbScatter,d.dbScatter)} unit="%" set={v=>patch({dbScatter:v/100})}/>
   <ExactRange live name="Second tip count" min={1} max={5} value={Math.round(s.dbCount??1)} unit="" set={v=>patch({dbCount:v})}/>
   <ExactRange live name="Merge amount" value={pct(s.dbAmount,1)} unit="%" set={v=>patch({dbAmount:v/100})}/>
   <div className="custom-brush-create"><input aria-label="New merged brush name" maxLength={CUSTOM_NAME_MAX} placeholder="Short name" value={name} onChange={e=>setName(e.target.value)}/><button type="button" disabled={!name.trim()} onClick={()=>{onSaveAs(name);setName('');}}>Save as new brush</button></div>
  </fieldset>
  <p className="hint">Dual brush stamps the second brush's tip and texture along the same line and merges it into this brush with the chosen mode. Size, Spacing and Scatter control the second tip. Save as new brush keeps the merged result as one of your brushes.</p>
 </div>;
});

/** v0.5.241 Create Your Own Brush: make, rename, duplicate and delete custom brushes. */
export const MyBrushesPanel=memo(function MyBrushesPanel({library,current,onCreate,onScratch,onRename,onDuplicate,onDelete,onChoose,focusKey}:{library:BrushLibrary;current:BrushPreset;onCreate:(name:string)=>void;onScratch:(name:string)=>void;onRename:(id:string,name:string)=>void;onDuplicate:(id:string)=>void;onDelete:(id:string)=>void;onChoose:(id:string)=>void;focusKey?:number}){
 const [name,setName]=useState(''),[editing,setEditing]=useState<string>(),[editName,setEditName]=useState(''),[confirm,setConfirm]=useState<string>();
 const input=useRef<HTMLInputElement>(null);useEffect(()=>{if(focusKey)input.current?.focus();},[focusKey]);
 const mine=library.presets.filter(p=>p.custom&&(current.category==='Eraser'?p.category==='Eraser':p.category!=='Eraser'));
 return <div className="my-brushes-panel" role="group" aria-label="My brushes">
  <div className="custom-brush-create"><input ref={input} aria-label="Custom brush name" maxLength={CUSTOM_NAME_MAX} placeholder="Short name, e.g. Soft hair" value={name} onChange={e=>setName(e.target.value)}/></div>
  <div className="custom-brush-actions"><button type="button" disabled={!name.trim()} onClick={()=>{onCreate(name);setName('');}}>Create from current</button><button type="button" disabled={!name.trim()||current.category==='Eraser'} onClick={()=>{onScratch(name);setName('');}}>New from scratch</button></div>
  <p className="hint">Create from current saves this brush with all its settings (Blend, Tip shape, Dual brush…) under a short name. New from scratch starts from a plain round brush. Your brushes appear in the brush pickers marked ★, are saved with the app, and travel with saved projects and backups.</p>
  <ul className="custom-brush-list" aria-label="Custom brushes">
   {!mine.length&&<li className="hint">No custom brushes yet.</li>}
   {mine.map(p=><li key={p.id} className={p.id===current.id?'active':''}>
    {editing===p.id?<><input aria-label={'Rename '+p.name} maxLength={CUSTOM_NAME_MAX} value={editName} autoFocus onChange={e=>setEditName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&editName.trim()){onRename(p.id,editName);setEditing(undefined);}}}/><button type="button" disabled={!editName.trim()} onClick={()=>{onRename(p.id,editName);setEditing(undefined);}}>Save</button><button type="button" onClick={()=>setEditing(undefined)}>Cancel</button></>
    :<><button type="button" className="custom-brush-name" aria-pressed={p.id===current.id} title={'Use '+p.name} onClick={()=>onChoose(p.id)}>★ {p.name}</button><span className="custom-brush-kind">{p.category}</span>
     <button type="button" aria-label={'Rename '+p.name} onClick={()=>{setEditing(p.id);setEditName(p.name);setConfirm(undefined);}}>Rename</button>
     <button type="button" aria-label={'Duplicate '+p.name} onClick={()=>onDuplicate(p.id)}>Duplicate</button>
     <button type="button" aria-label={'Delete '+p.name} className={confirm===p.id?'danger':''} onClick={()=>{if(confirm===p.id){onDelete(p.id);setConfirm(undefined);}else setConfirm(p.id);}}>{confirm===p.id?'Confirm':'Delete'}</button></>}
   </li>)}
  </ul>
  <p className="hint">Stock brushes can't be renamed or deleted. Use Create from current to make your own copy.</p>
 </div>;
});
