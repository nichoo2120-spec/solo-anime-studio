import type {Options} from './TransformTool';
import {MODES} from './modes';
import type {Mode} from './modes/types';
import {StudioFreeformIcon,StudioMoveIcon,StudioScaleIcon,StudioRotateObjectIcon,StudioPerspectiveIcon,StudioSkewIcon,StudioDistortIcon} from '../../ui/StudioToolIcons';
import {Check,X,FlipHorizontal,Grip,Grid3X3,Crosshair,FlipVertical,Target} from 'lucide-react';
import {useRef,type ComponentType,type PointerEvent as ReactPointerEvent} from 'react';
const icons:Record<Mode,ComponentType<{size?:number}>>={free:StudioFreeformIcon,move:StudioMoveIcon,scale:StudioScaleIcon,rotate:StudioRotateObjectIcon,perspective:StudioPerspectiveIcon,skew:StudioSkewIcon,distort:StudioDistortIcon,mesh:Grid3X3,flip:FlipHorizontal,pivot:Crosshair};
export type FlipExtras={showPivot:boolean;snapSelection:boolean;snapGrid:boolean;previewOutline:boolean;flipCanvas:boolean;keepTiming:boolean;keepPosition:boolean};
export function TransformOptionsBar({docked=false,mode,values,busy,onMode,onSet,onCommit,onCancel,onFlip,onPivotPreset,onPivotCoordinate,pivot,onCustomPivot,flipExtras,onFlipExtra,onReverseFrames,selectedFrameCount,flipTarget,onFlipTarget,selectedLayerCount,onAddMeshDivision,pinPlacement,onPinPlacement,onRemoveMeshPin}: {docked?:boolean;mode:Mode;values:Options;busy:boolean;onMode:(v:Mode)=>void;onSet:(name:keyof Options,val:number|boolean|Options['interpolation']|Options['skewAxis']|Options['meshPinBehavior']|Options['meshScope']|Options['meshMode'])=>void;onCommit:()=>void;onCancel:()=>void;onFlip:(axis:'h'|'v')=>void;onPivotPreset:(x:number,y:number)=>void;onPivotCoordinate:(axis:'x'|'y',v:number)=>void;pivot:{x:number;y:number};onCustomPivot:()=>void;flipExtras:{showPivot:boolean;snapSelection:boolean;snapGrid:boolean;previewOutline:boolean;flipCanvas:boolean;keepTiming:boolean;keepPosition:boolean};onFlipExtra:(key:keyof FlipExtras,value:boolean)=>void;onReverseFrames:()=>void;selectedFrameCount:number;flipTarget:'selection'|'layer'|'selected'|'visible';onFlipTarget:(target:'selection'|'layer'|'selected'|'visible')=>void;selectedLayerCount:number;onAddMeshDivision:(axis:'row'|'column',at:number)=>void;pinPlacement:boolean;onPinPlacement:(value:boolean)=>void;onRemoveMeshPin:()=>void}){
 const panelRef=useRef<HTMLDivElement|null>(null);
 const dragRef=useRef<{id:number;clientX:number;clientY:number;left:number;top:number}|null>(null);
 const moveFrame=useRef<number|null>(null);
 const beginDrag=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.button!==0)return;
  const panel=panelRef.current;if(!panel)return;
  const r=panel.getBoundingClientRect();
  // Convert the initial centered position to viewport-fixed coordinates exactly once.
  panel.style.position='fixed';panel.style.left=`${r.left}px`;panel.style.top=`${r.top}px`;panel.style.transform='none';
  dragRef.current={id:e.pointerId,clientX:e.clientX,clientY:e.clientY,left:r.left,top:r.top};
  e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
 };
 const moveDrag=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const d=dragRef.current,panel=panelRef.current;
  if(!d||d.id!==e.pointerId||!panel)return;
  const width=panel.offsetWidth,height=panel.offsetHeight;
  const left=Math.max(8,Math.min(window.innerWidth-width-8,d.left+e.clientX-d.clientX));
  const top=Math.max(8,Math.min(window.innerHeight-height-8,d.top+e.clientY-d.clientY));
  if(moveFrame.current!==null)cancelAnimationFrame(moveFrame.current);
  moveFrame.current=requestAnimationFrame(()=>{panel.style.left=`${left}px`;panel.style.top=`${top}px`;moveFrame.current=null;});
 };
 const endDrag=(e:ReactPointerEvent<HTMLDivElement>)=>{if(dragRef.current?.id===e.pointerId)dragRef.current=null;};
 return <div ref={panelRef} className={'full-transform-panel'+(docked?' transform-panel-docked':'')} role="toolbar" aria-label="Transform modes and editable options">
  {!docked&&<div className="full-transform-dragbar" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} title="Reposition Transform Workspace"><Grip size={14}/><span className="transform-drag-title">TRANSFORM <em> / {mode.toUpperCase()}</em></span><span className="transform-drag-status">FLOATING WORKSPACE</span></div>}
  <div className="full-transform-modes" aria-label="Transform modes">{MODES.map(([id,label,key])=>{const Icon=icons[id];return <button key={id} type="button" aria-pressed={mode===id} className={mode===id?'active':''} title={`${label} · ${key}`} onClick={()=>onMode(id)}><Icon size={18}/><span>{label}</span><kbd>{key}</kbd></button>;})}</div>
  <div className="full-transform-fields">{(['x','y','w','h','angle','skew'] as const).map(name=><label key={name}>{name.toUpperCase()}<input type="number" step={name==='angle'||name==='skew'?'1':'0.1'} value={values[name]} aria-label={'Transform '+name.toUpperCase()} onChange={e=>onSet(name,Number(e.target.value))}/></label>)}
   <label className="transform-lock"><input type="checkbox" checked={values.lock} onChange={e=>onSet('lock',e.target.checked)}/> Lock ratio</label>
   <label>Quality<select title="Interpolation method" value={values.interpolation} onChange={e=>onSet('interpolation',e.target.value as Options['interpolation'])}><option value="nearest">Nearest</option><option value="bilinear">Bilinear</option><option value="bicubic">Bicubic</option></select></label>
   {['perspective','skew','distort'].includes(mode)&&<><label className="transform-lock" title="Show projected 2D grid while adjusting perspective"><input type="checkbox" checked={values.perspectiveGrid} onChange={e=>onSet('perspectiveGrid',e.target.checked)}/> Show grid</label>{mode==='perspective'&&<label title="Snap corner movement angle (degrees)">Angle snap<select value={values.perspectiveSnap} onChange={e=>onSet('perspectiveSnap',Number(e.target.value))}>{[0,15,30,45].map(n=><option key={n} value={n}>{n===0?'Off':n+'°'}</option>)}</select></label>}</>}
   {mode==='skew'&&<><label>Skew mode<select title="Skew axis" value={values.skewAxis} onChange={e=>onSet('skewAxis',e.target.value as Options['skewAxis'])}><option value="free">Free</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label><label>Angle snap<select value={values.skewSnap} onChange={e=>onSet('skewSnap',Number(e.target.value))}>{[0,5,15].map(n=><option key={n} value={n}>{n===0?'Off':n+'°'}</option>)}</select></label></>}
   {mode==='mesh'&&<div className="mesh-tool-controls" aria-label="Mesh warp controls">
    <div className="mesh-tool-row"><strong>MESH GRID</strong>
      <label>Rows<select value={values.meshRows} onChange={e=>onSet('meshRows',Number(e.target.value))}>{[2,3,4,5,6,7,8,9,10,11,12].map(n=><option value={n} key={n}>{n}</option>)}</select></label>
      <label>Columns<select value={values.meshCols} onChange={e=>onSet('meshCols',Number(e.target.value))}>{[2,3,4,5,6,7,8,9,10,11,12].map(n=><option value={n} key={n}>{n}</option>)}</select></label>
      <label>Type<select value={values.meshMode} onChange={e=>onSet('meshMode',e.target.value as Options['meshMode'])}><option value="uniform">01 · Layer Warp Mesh</option><option value="triangle">02 · Dense Warp Grid</option><option value="adaptive">03 · Contour / Shape Mesh</option></select></label><span className="flip-tool-hint" title="Mesh uses the current layer bounds">Scope: Whole current layer bounds</span>
      <label className="transform-lock"><input type="checkbox" checked={values.meshShowGrid} onChange={e=>onSet('meshShowGrid',e.target.checked)}/> Show mesh grid</label>
      <label className="transform-lock"><input type="checkbox" checked={values.meshShowPoints} onChange={e=>onSet('meshShowPoints',e.target.checked)}/> Show points</label>
    </div>
    <div className="mesh-tool-row"><strong>MESH CONTROL POINTS</strong>
      <button type="button" aria-pressed={pinPlacement} className={pinPlacement?'active':''} title="Place multiple free pins. Click again to stop adding." onClick={()=>onPinPlacement(!pinPlacement)}>{pinPlacement?'Finish Adding Pins':'+ Free Pins'}</button><button type="button" onClick={onRemoveMeshPin} title="Remove the most recently inserted independent warp pin">− Last Pin</button>
      <button type="button" title="Insert a row through the centre of the existing deformation" onClick={()=>onAddMeshDivision('row',.5)}>+ Row</button>
      <button type="button" title="Insert a column through the centre of the existing deformation" onClick={()=>onAddMeshDivision('column',.5)}>+ Column</button>
      <span className="flip-tool-hint">Up to 12 divisions each way · deformation retained</span>
    </div>
    <div className="mesh-tool-row"><strong>DEFORMATION</strong>
      <label>Point falloff <input type="range" min="0" max="100" step="5" value={values.meshFalloff} aria-label="Mesh point influence" onChange={e=>onSet('meshFalloff',Number(e.target.value))}/>{values.meshFalloff}%</label>
      <label>Free Pin Influence <input type="range" min="5" max="100" step="5" value={values.meshPinRadius} aria-label="Free pin influence radius" onChange={e=>onSet('meshPinRadius',Number(e.target.value))}/>{values.meshPinRadius}%</label>
      <label>Pin interaction <select aria-label="Free pin interaction" value={values.meshPinBehavior} onChange={e=>onSet('meshPinBehavior',e.target.value as 'local'|'neighbor')}><option value="local">Local only (other pins fixed)</option><option value="neighbor">Move nearby pins</option></select></label>
      <label>Point size <input type="range" min="50" max="180" step="10" value={values.meshPointSize} aria-label="Mesh point size" onChange={e=>onSet('meshPointSize',Number(e.target.value))}/>{values.meshPointSize}%</label>
      <label className="transform-lock"><input type="checkbox" checked={values.meshSmooth} onChange={e=>onSet('meshSmooth',e.target.checked)}/> Smooth interpolation</label>
      <label className="transform-lock"><input type="checkbox" checked={values.meshLockCorners} onChange={e=>onSet('meshLockCorners',e.target.checked)}/> Lock corners</label>
      <label className="transform-lock" title="Hold every outer mesh point in place while moving interior points"><input type="checkbox" checked={values.meshLockBorder} onChange={e=>onSet('meshLockBorder',e.target.checked)}/> Lock border</label>
    </div>
    <div className="mesh-tool-hint">01 Layer Warp Mesh: 3×3 broad grid. 02 Dense Warp Grid: 8×8 grid, add/remove divisions as needed. 03 Contour / Shape Mesh: a reduced-point silhouette-guided envelope (not an anatomical or full polygon outline detector). Free Pin adds a movable local deformation handle · Alt + click inside the mesh to insert a control intersection · Drag points to sculpt the surface.</div>
   </div>}
   {mode==='flip'&&<div className="flip-tool-controls" aria-label="Flip tool advanced controls">
    <div className="flip-tool-row"><strong>FLIP DIRECTION</strong><button type="button" onClick={()=>onFlip('h')}><FlipHorizontal size={16}/> Horizontal preview <kbd>H</kbd></button><button type="button" onClick={()=>onFlip('v')}><FlipVertical size={16}/> Vertical preview <kbd>SHIFT+H</kbd></button><span className="flip-tool-hint">Preview on canvas · Commit to apply · Escape to cancel</span></div>
    <div className="flip-tool-row"><strong>FLIP PIVOT</strong><div className="flip-pivot-grid" aria-label="Nine pivot presets">{[0,.5,1].flatMap((y,yi)=>[0,.5,1].map((x,xi)=><button type="button" key={`${yi}-${xi}`} title={`${['Top','Middle','Bottom'][yi]} ${['Left','Center','Right'][xi]}`} aria-label={`${['Top','Middle','Bottom'][yi]} ${['Left','Center','Right'][xi]} pivot`} onClick={()=>onPivotPreset(x,y)}><span className="flip-pivot-dot"/></button>))}</div><button type="button" onClick={onCustomPivot}><Target size={15}/> Drag custom pivot</button><label>Pivot X <input type="number" value={Math.round(pivot.x)} onChange={e=>onPivotCoordinate('x',Number(e.target.value))}/></label><label>Y <input type="number" value={Math.round(pivot.y)} onChange={e=>onPivotCoordinate('y',Number(e.target.value))}/></label></div>
    <div className="flip-tool-row"><strong>APPLY TO</strong><label>Artwork scope <select value={flipTarget} onChange={e=>onFlipTarget(e.target.value as typeof flipTarget)}><option value="selection">Selection / selected strokes</option><option value="layer">Current layer</option><option value="selected">Selected layers ({selectedLayerCount||1})</option><option value="visible">All visible unlocked layers</option></select></label><span className="flip-tool-hint">Keep Position uses each target's own bounds for editable line art; locked/reference layers are never modified.</span></div>
    <div className="flip-tool-row"><strong>FLIP OPTIONS</strong>
      {([['showPivot','Show pivot'],['snapSelection','Snap to selection'],['snapGrid','Snap to grid'],['previewOutline','Show preview outline'],['flipCanvas','Temporary mirrored canvas view'],['keepTiming','Keep animation timing'],['keepPosition','Keep position (ignore offset pivot)']] as const).map(([key,label])=><label className="transform-lock" key={key}><input type="checkbox" checked={flipExtras[key]} onChange={e=>onFlipExtra(key,e.target.checked)}/>{label}</label>)}
    </div>
    <div className="flip-tool-row"><strong>ANIMATION RANGE</strong><span className="flip-tool-hint">{selectedFrameCount>1?`${selectedFrameCount} selected cels`: 'Select multiple timeline cels to apply across frames'}</span><button type="button" disabled={selectedFrameCount<2} onClick={onReverseFrames}>Reverse selected frame drawings</button></div>
   </div>}

   <button className="full-transform-commit" disabled={busy} title="Commit transform · Enter" onClick={onCommit}><Check size={15}/> Commit <kbd>ENTER</kbd></button>
   <button disabled={busy} title="Cancel and restore · Escape" onClick={onCancel}><X size={14}/> Cancel <kbd>ESC</kbd></button>
  </div>
  {!docked&&<small><Grip size={12}/> {mode==='skew'?'SKEW: Top/bottom diamonds shear along the top edge · side diamonds shear along the side edge · corners combine both axes · drag inside to move · drag pivot to reposition · Enter applies / Esc cancels':mode==='distort'?'DISTORT: Drag corners freely · drag edge midpoints to reshape whole edge · drag inside to move · drag pivot to reposition · Enter applies / Esc cancels':mode==='flip'?'FLIP: Select horizontal or vertical to preview the reflected artwork · use any of nine pivot presets or set a custom pivot · Enter applies / Esc cancels':mode==='mesh'?'MESH WARP: Control mesh auto-detects the visible character and builds the mesh around it. Use Warp mesh for a regular box grid, or Whole current layer for broad deforms · drag cyan points directly on the drawing · Enter applies / Esc cancels':mode==='perspective'?'PERSPECTIVE: Drag corner to adjust depth · side diamond to skew · center or inside to move · Shift+corner for symmetric keystone · Enter applies / Esc cancels':'Drag inside to move · corners to scale · outside rotate · Ctrl+side skew · Ctrl+corner distort · Ctrl+Shift+corner perspective · Shift snaps rotation · Alt scales from centre'}</small>}
 </div>;
}
