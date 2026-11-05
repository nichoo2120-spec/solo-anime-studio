import {useState} from 'react';
import type {Project} from '../core/model';
import {shotFrame} from '../core/shotFrame';
import type {ExportOptions} from '../engine/renderer';

export function PngExport({project,cameraFrame,onExport}:{project:Project;cameraFrame:number;onExport:(o:ExportOptions)=>void}){
 const shot=shotFrame(project),cameraAvailable=!!project.shotFrame&&!!project.camera?.enabled;
 const [transparent,setTransparent]=useState(false);
 const [scope,setScope]=useState('visible');
 const [width,setWidth]=useState(shot.width),[height,setHeight]=useState(shot.height);
 const [references,setReferences]=useState('project');
 const [throughCamera,setThroughCamera]=useState(cameraAvailable);
 const valid=Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=8192&&height<=8192&&width*height<=16777216;
 function reset(){
  setWidth(shot.width);setHeight(shot.height);setTransparent(false);
  setScope('visible');setReferences('project');setThroughCamera(cameraAvailable);
 }
 function download(){
  onExport({
   transparent,width,height,
   layerId:scope==='current'?project.activeLayerId:undefined,
   includeReferences:references==='project'?undefined:references==='all',
   cameraFrame:cameraAvailable&&throughCamera?cameraFrame:undefined
  });
 }
 return <>
  <span className="eyebrow">PNG EXPORT</span><h2 id="dialog-title">Export your drawing.</h2>
  <div className="export-settings">
   <label>Background<select aria-label="PNG background" value={transparent?'transparent':'opaque'} onChange={e=>setTransparent(e.target.value==='transparent')}>
    <option value="opaque">Opaque white · default</option><option value="transparent">Transparent</option>
   </select></label>
   <label>Layers<select aria-label="PNG layers" value={scope} onChange={e=>setScope(e.target.value)}>
    <option value="visible">All visible layers</option><option value="current">Current layer only</option>
   </select></label>
   <div className="export-dimensions">
    <label>Width<input aria-label="PNG width" type="number" min="1" max="8192" value={width} onChange={e=>setWidth(+e.target.value)}/></label>
    <label>Height<input aria-label="PNG height" type="number" min="1" max="8192" value={height} onChange={e=>setHeight(+e.target.value)}/></label>
   </div>
   <label>Reference images<select aria-label="Include reference images" value={references} onChange={e=>setReferences(e.target.value)}>
    <option value="project">Use per-layer export settings · default</option><option value="none">Exclude all reference images</option>
    <option value="all">Include visible reference images</option>
   </select></label>
   {cameraAvailable&&<label className="onion-check">
    <input type="checkbox" checked={throughCamera} onChange={e=>setThroughCamera(e.target.checked)}/> Render through scene camera
   </label>}
   <p className="hint">{project.shotFrame?'Exports use the shot frame at the selected resolution. Outside artwork stays in the project.':'The default is the original white, full-resolution visible-artwork export. Reference layers enabled individually for normal exports also remain included.'} Custom output is limited to 16 megapixels.</p>
  </div>
  <div className="modal-actions">
   <button onClick={reset}>Reset export defaults</button>
   <button className="accent-button" disabled={!valid} onClick={download}>Download PNG</button>
  </div>
 </>;
}
