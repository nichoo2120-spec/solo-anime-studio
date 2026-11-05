import {useState} from 'react';
import type {Project} from '../core/model';
import {shotFrame} from '../core/shotFrame';
import {sequencePlan,type SequenceExportOptions} from '../animation/sequenceExport';
export function SequenceExport({project,fps,busy,onExport}:{project:Project;fps:number;busy:boolean;onExport:(o:SequenceExportOptions)=>void}){
 const [transparent,setTransparent]=useState(true),[uniqueCels,setUniqueCels]=useState(false),[references,setReferences]=useState(false),hasCamera=!!project.camera?.enabled&&!!project.camera.keys.length,[throughCamera,setThroughCamera]=useState(true);
 const [scale,setScale]=useState('original'),[selection,setSelection]=useState('visible');
 const shot=shotFrame(project),factor=scale==='half'?.5:1,width=Math.round(shot.width*factor),height=Math.round(shot.height*factor);
 const count=sequencePlan(project,uniqueCels).length;
 return <><span className="eyebrow">ANIMATION OUTPUT</span><h2 id="dialog-title">Export PNG sequence.</h2>
 <p className="modal-intro">A numbered transparent PNG for every animation exposure, including repeated holds. Downloaded as one ZIP with a timing manifest.</p>
 <div className="export-settings">
  <label>Export timing<select aria-label="Sequence timing" value={uniqueCels?'unique':'all'} onChange={e=>setUniqueCels(e.target.value==='unique')}><option value="all">Every exposure (including held frames)</option><option value="unique">Unique drawing cels only</option></select></label>
  <label>Background<select aria-label="Sequence background" value={transparent?'transparent':'white'} onChange={e=>setTransparent(e.target.value==='transparent')}><option value="transparent">Transparent PNG</option><option value="white">Opaque white</option></select></label>
  <label>Resolution<select aria-label="Sequence resolution" value={scale} onChange={e=>setScale(e.target.value)}><option value="original">Original · {shot.width} × {shot.height}</option><option value="half">Half · {Math.round(shot.width/2)} × {Math.round(shot.height/2)}</option></select></label>
  <label>Layers<select aria-label="Sequence layers" value={selection} onChange={e=>setSelection(e.target.value)}><option value="visible">All visible layers</option><option value="current">Active layer only</option></select></label>
  {hasCamera&&<label className="onion-check"><input type="checkbox" aria-label="Export through scene camera" checked={throughCamera&&!uniqueCels} disabled={uniqueCels} onChange={e=>setThroughCamera(e.target.checked)}/> Render through scene camera ({project.camera!.keys.length} keys){uniqueCels?' — needs every exposure':''}</label>}
  <label className="onion-check"><input type="checkbox" checked={references} onChange={e=>setReferences(e.target.checked)}/> Include visible reference images</label>
  <p className="hint">{count} exported PNGs at {fps} fps · {width} × {height}. Light-table guides and onion skins never appear in exported images. For large shots, try half resolution or unique cels to reduce ZIP size.</p>
 </div>
 <div className="modal-actions"><button className="accent-button" disabled={busy} onClick={()=>onExport({transparent,width,height,uniqueCels,fps,layerId:selection==='current'?project.activeLayerId:undefined,includeReferences:references,throughCamera:hasCamera&&throughCamera&&!uniqueCels})}>Download sequence ZIP</button></div>
 </>;
}
