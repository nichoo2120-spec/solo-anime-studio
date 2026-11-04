import type {StudioEngine} from '../engine/StudioEngine';
export function MirrorControls({engine}:{engine:StudioEngine|null}){
 const s=engine?.mirrorDrawing,pivot=s?.pivot??{x:s?.center??.5,y:s?.center??.5};
 const change=(work:(e:StudioEngine)=>void)=>{if(!engine)return;work(engine);engine.request();engine.onMirrorChange();};
 return <>
  <button type="button" title="Mirror Drawing — symmetrical pair, one undo step" aria-pressed={s?.enabled??false} onClick={()=>change(e=>{e.mirrorDrawing.enabled=!e.mirrorDrawing.enabled;e.pickMirrorPivot=false;})}>{s?.enabled?'Mirror ON':'Mirror OFF'}</button>
  <select aria-label="Mirror drawing axis" value={s?.axis??'vertical'} onChange={event=>change(e=>{e.mirrorDrawing.axis=event.target.value as 'vertical'|'horizontal';})}><option value="vertical">Mirror vertical</option><option value="horizontal">Mirror horizontal</option></select>
  <label className="mirror-mini-setting"><input aria-label="Show mirror line" type="checkbox" checked={s?.showLine??true} onChange={event=>change(e=>{e.mirrorDrawing.showLine=event.target.checked;})}/>Line</label>
  <button type="button" aria-label="Place mirror pivot" aria-pressed={engine?.pickMirrorPivot??false} disabled={s?.lockCenter??false} title="Click to place the symmetry pivot; drag its crosshair to move it" onClick={()=>change(e=>{e.mirrorDrawing.enabled=true;e.mirrorDrawing.showLine=true;e.pickMirrorPivot=!e.pickMirrorPivot;})}>{engine?.pickMirrorPivot?'Click canvas…':'Place pivot'}</button>
  <details className="mirror-options"><summary>Pivot options</summary><div>
   <label className="mirror-mini-setting"><input aria-label="Lock mirror pivot" type="checkbox" checked={s?.lockCenter??false} onChange={event=>change(e=>{e.mirrorDrawing.lockCenter=event.target.checked;e.pickMirrorPivot=false;})}/>Lock pivot</label>
   {(['x','y'] as const).map(axis=><label key={axis} className="mirror-mini-setting">{axis.toUpperCase()} <input aria-label={'Mirror pivot '+axis.toUpperCase()} type="number" min="0" max="100" step=".1" disabled={s?.lockCenter??false} value={Math.round(pivot[axis]*1000)/10} onChange={event=>change(e=>{const value=Number(event.target.value);if(Number.isFinite(value))e.mirrorDrawing.pivot={...pivot,[axis]:Math.max(0,Math.min(1,value/100))};})}/>%</label>)}
   <button type="button" disabled={s?.lockCenter??false} onClick={()=>engine?.centerMirrorPivot()}>Center pivot</button>
   <small>Drag the canvas crosshair, or choose Place pivot. Lock it to draw through its center.</small>
  </div></details>
 </>;
}
