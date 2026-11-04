import {activeLayer,editLayer,type Layer} from '../core/model';
import type {DocumentStore} from '../core/history';
import {intersectsPolygon} from './strokeGeometry';
import type {Point} from '../core/model';
export class SmoothingController {
 previewLayer?:Layer;private revision=0;onChange:(active:boolean)=>void=()=>{};
 constructor(private store:DocumentStore,private request:()=>void,private notify:(message:string)=>void){}
 preview(amount:number,scope:'last'|'selection',polygon:Point[]=[]){
  const doc=this.store.getSnapshot(),layer=activeLayer(doc);if(layer.locked||!layer.visible||layer.kind==='vector'){this.notify('Select a visible, unlocked raster drawing layer.');return;}
  let lastTransform=-1;layer.operations.forEach((op,i)=>{if(op.kind==='transform')lastTransform=i;});
  let ids=layer.operations.filter((op,i)=>op.kind==='stroke'&&op.tool==='brush'&&i>lastTransform&&(scope==='last'||polygon.length>=3&&intersectsPolygon(op.points,polygon))).map(op=>op.id);if(scope==='last')ids=ids.slice(-1);
  if(!ids.length){this.notify('No eligible strokes selected. Undo a prior raster transform before smoothing its source strokes.');return;}
  this.revision=this.store.revision;this.previewLayer={...layer,operations:layer.operations.map(op=>op.kind==='stroke'&&ids.includes(op.id)?{...op,engineVersion:op.engineVersion===10?10:op.engineVersion===9?9:op.engineVersion===8?8:op.engineVersion===7?7:6,stabilization:(op.engineVersion===4||op.engineVersion===5||op.engineVersion===6||op.engineVersion===7||op.engineVersion===8||op.engineVersion===9||op.engineVersion===10)?op.stabilization:0,smoothness:amount}:op)};this.onChange(true);this.request();
 }
 apply(){const layer=this.previewLayer;if(!layer)return;const valid=this.revision===this.store.revision;this.previewLayer=undefined;this.onChange(false);if(valid)this.store.commit(editLayer(this.store.getSnapshot(),layer.id,{operations:layer.operations}),'Smooth strokes');this.request();}
 cancel(){if(this.previewLayer){this.previewLayer=undefined;this.onChange(false);this.request();}}
 documentChanged(){if(this.previewLayer&&this.revision!==this.store.revision)this.cancel();}
}
