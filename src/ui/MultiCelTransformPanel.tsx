import {memo,useState} from 'react';
import type {BatchTransformValues} from '../animation/batchTransform';

/** Compact, explicit batch action: never preview/rebuild every cel while a pen draws. */
export const MultiCelTransformPanel=memo(function MultiCelTransformPanel({frameCount,layerCount,activeLayerName,disabled,onApply}:{
 frameCount:number;layerCount:number;activeLayerName:string;disabled:boolean;onApply:(values:BatchTransformValues)=>void;
}){
 const [dx,setDx]=useState(0),[dy,setDy]=useState(0),[scale,setScale]=useState(100),[angle,setAngle]=useState(0);
 const ready=frameCount>=2&&!disabled&&Number.isFinite(dx)&&Number.isFinite(dy)&&Number.isFinite(scale)&&scale>=10&&scale<=300&&Math.abs(dx)<=4096&&Math.abs(dy)<=4096&&(dx!==0||dy!==0||scale!==100||angle!==0);
 return <div className="motion-planning" role="region" aria-label="Multi-Cel Transform">
  <strong className="motion-title">MULTI-CEL TRANSFORM</strong>
  <p className="hint">Move or resize drawings on several animation frames at once. No need to repeat the same correction on each cel.</p>
  <div className="motion-easy-steps">
   <div><b>1. Select frames</b><span>Shift-click first and last frame in the Timeline (Option-click to pick separate frames).</span></div>
   <div><b>2. Select layers</b><span>Uses <b>{layerCount?`${layerCount} selected layer${layerCount===1?'':'s'}`:activeLayerName}</b>. To affect another layer, select it in the layer list.</span></div>
   <div><b>3. Set and apply</b><div className="motion-coordinate-row">
    <label>Move X (px)<input aria-label="Batch move X" type="number" min="-4096" max="4096" value={dx} onChange={e=>setDx(Number(e.target.value))}/></label>
    <label>Move Y (px)<input aria-label="Batch move Y" type="number" min="-4096" max="4096" value={dy} onChange={e=>setDy(Number(e.target.value))}/></label>
   </div><label className="motion-label">Rotate each drawing (°)<input aria-label="Batch rotate degrees" type="number" min="-180" max="180" value={angle} onChange={e=>setAngle(Number(e.target.value))}/></label><label className="motion-label">Scale each drawing (%)<input aria-label="Batch scale percent" type="number" min="10" max="300" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label></div>
  </div>
  <small className="motion-caption">{frameCount} selected frames · {layerCount||1} layer{(layerCount||1)===1?'':'s'} · One Undo step. Scale is around each drawing's center.</small>
  <button className="full-width accent-button" disabled={!ready} onClick={()=>onApply({dx,dy,scale:scale/100,angle})}>Apply to selected cels</button>
  <button className="full-width" onClick={()=>{setDx(0);setDy(0);setScale(100);setAngle(0);}}>Reset values</button>
  <small className="motion-caption">Only editable strokes on independent, unlocked cels move. Held/linked frames, raster fills and existing Motion Path bindings are protected. No work runs during drawing.</small>
 </div>;
});
