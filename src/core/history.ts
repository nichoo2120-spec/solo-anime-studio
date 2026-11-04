import type {Project} from './model';
import {syncActiveFrame} from '../animation/timeline';
export type HistoryEntry={id:number;label:string;project:Project};
function describeChange(a:Project,b:Project){
 if(a.layers.length<b.layers.length)return 'Add / duplicate layer';if(a.layers.length>b.layers.length)return 'Delete layer';
 if(a.layers.some((l,i)=>b.layers[i].id!==l.id))return 'Reorder layers';if(a.name!==b.name)return 'Rename project';
 for(let i=0;i<b.layers.length;i++){const before=a.layers[i],after=b.layers[i];if(before.operations!==after.operations){if(after.operations.length>before.operations.length){const op=after.operations.at(-1)!;return op.kind==='stroke'?(op.tool==='eraser'?'Erase stroke':'Draw stroke'):op.kind==='fill'?'Fill region':'Transform artwork';}return 'Edit artwork';}if(before.name!==after.name)return 'Rename layer';if(before.locked!==after.locked)return after.locked?'Lock layer':'Unlock layer';if(before.visible!==after.visible)return after.visible?'Show layer':'Hide layer';if(before.opacity!==after.opacity)return 'Layer opacity';if(before.blend!==after.blend)return 'Layer blend mode';if(before.exportReference!==after.exportReference)return 'Reference export settings';}
 return 'Document settings';
}
/** Bounded per-document history. All entries are immutable project snapshots;
 * expanding history preserves Undo/Redo without copying raster pixels eagerly. */
export class DocumentStore {
 static readonly MAX_UNDO=160;
 private entries:HistoryEntry[];private index=0;private serial=0;private listeners=new Set<()=>void>();revision=0;
 constructor(private project:Project){this.entries=[{id:this.serial++,label:'Initial document',project}];}
 getSnapshot=()=>this.project;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private emit(){this.revision++;this.listeners.forEach(l=>l());}
 commit(next:Project,label=describeChange(this.project,next)){
  if(next===this.project)return;next=syncActiveFrame(next);this.entries=this.entries.slice(0,this.index+1);this.entries.push({id:this.serial++,label,project:next});if(this.entries.length>DocumentStore.MAX_UNDO+1)this.entries.shift();this.index=this.entries.length-1;this.project=next;this.emit();
 }
 selectFrame(next:Project){if(next===this.project)return;this.project=next;this.entries[this.index]={...this.entries[this.index],project:next};this.emit();}
 select(id:string){if(this.project.activeLayerId===id||!this.project.layers.some(l=>l.id===id))return;this.project={...this.project,activeLayerId:id};this.entries[this.index]={...this.entries[this.index],project:this.project};this.emit();}
 undo(){this.goTo(this.index-1);}redo(){this.goTo(this.index+1);}
 goTo(index:number){if(index<0||index>=this.entries.length||index===this.index)return;this.index=index;this.project=this.entries[index].project;this.emit();}
 replace(p:Project){this.project=p;this.entries=[{id:this.serial++,label:'Opened document',project:p}];this.index=0;this.emit();}
 getHistory(){return this.entries.map((entry,index)=>({id:entry.id,label:entry.label,index,current:index===this.index,future:index>this.index}));}
 get currentIndex(){return this.index;}get canUndo(){return this.index>0;}get canRedo(){return this.index<this.entries.length-1;}
}
