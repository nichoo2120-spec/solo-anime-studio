import type {Project} from './model';
import type {View} from './geometry';
type StoredView={view:View;width:number;height:number};
/** View preferences are local workspace state, never document edits/history. */
export class ViewPreferences {
 private pending=new Map<string,StoredView>();private timer?:ReturnType<typeof setTimeout>;
 remember(project:Project,view:View){this.pending.set(project.id,{view:{...view},width:project.width,height:project.height});if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),200);}
 read(project:Project):View|null{
  try{const record=this.pending.get(project.id)??JSON.parse(localStorage.getItem('solo:view:'+project.id)??'null');if(!record||record.width!==project.width||record.height!==project.height)return null;const v=record.view;if(!v||!['x','y','zoom','rotation'].every(k=>Number.isFinite(v[k]))||v.zoom<.001||v.zoom>8||Math.abs(v.x)>1e7||Math.abs(v.y)>1e7)return null;return {...v};}catch{return null;}
 }
 flush(){if(this.timer)clearTimeout(this.timer);this.timer=undefined;for(const [id,record] of this.pending){try{localStorage.setItem('solo:view:'+id,JSON.stringify(record));}catch{/* Optional view storage cannot invalidate saved artwork. */}}this.pending.clear();}
}

/** Active-layer focus and viewport preferences are not artwork changes. */
export function documentDirty(current:Project,saved:Project|undefined){return !saved||current.id!==saved.id||current.layers!==saved.layers||current.name!==saved.name||current.width!==saved.width||current.height!==saved.height||current.settings.guides!==saved.settings.guides||current.animation!==saved.animation||current.substitutionShelf!==saved.substitutionShelf||current.cycleShelf!==saved.cycleShelf||current.audio!==saved.audio||current.motionPlanning!==saved.motionPlanning||current.camera!==saved.camera||current.shotFrame!==saved.shotFrame;}

