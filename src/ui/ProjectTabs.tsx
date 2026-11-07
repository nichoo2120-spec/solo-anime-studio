import {memo,useEffect,useRef} from 'react';
import {FolderOpen,Plus,Folder,X} from 'lucide-react';

export type ProjectTabLabel={id:string;name:string;dirty:boolean};
export const ProjectTabs=memo(function ProjectTabs({tabs,activeId,disabled,onSelect,onClose,onNew,onOpen,onHome}:{
 tabs:ProjectTabLabel[];activeId:string|null;disabled:boolean;
 onSelect:(id:string)=>void;onClose:(id:string)=>void;onNew:()=>void;onOpen:()=>void;onHome:()=>void;
}){
 const buttons=useRef(new Map<string,HTMLButtonElement>());
 useEffect(()=>{if(activeId)buttons.current.get(activeId)?.scrollIntoView({block:'nearest',inline:'nearest'});},[activeId]);
 return <div className="project-tabs-row">
  <button className="project-tabs-action" aria-label="Project Home" title="Project Home" disabled={disabled} onClick={onHome}><Folder size={14}/></button>
  <div className="project-tabs-list" role="tablist" aria-label="Open projects">
   {tabs.map((tab,index)=><div className={'document-tab project-tab'+(tab.id===activeId?' active':'')} key={tab.id}>
    <button ref={element=>{if(element)buttons.current.set(tab.id,element);else buttons.current.delete(tab.id);}} role="tab" aria-selected={tab.id===activeId} aria-label={tab.name+(tab.dirty?' (unsaved changes)':'')} tabIndex={tab.id===activeId?0:-1} disabled={disabled} title={tab.name+(tab.dirty?' · Unsaved changes':'')} onClick={()=>onSelect(tab.id)} onKeyDown={event=>{
     if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
     event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
     onSelect(tabs[next].id);buttons.current.get(tabs[next].id)?.focus();
    }}><span className={'project-tab-dot'+(tab.dirty?' dirty':'')} aria-hidden="true"/><span className="project-tab-name">{tab.name}</span></button>
    <button className="project-tab-close" aria-label={'Close project '+tab.name} title="Close project · Ctrl+W" disabled={disabled} onClick={()=>onClose(tab.id)}><X size={12}/></button>
   </div>)}
  </div>
  <button className="project-tabs-action" aria-label="New project tab" title="New project" disabled={disabled} onClick={onNew}><Plus size={15}/></button>
  <button className="project-tabs-action" aria-label="Open another project" title="Open another project" disabled={disabled} onClick={onOpen}><FolderOpen size={14}/></button>
 </div>;
});

export function CloseProjectDialog({name,busy,error,onSave,onDiscard,onCancel}:{name:string;busy:boolean;error:string;onSave:()=>void;onDiscard:()=>void;onCancel:()=>void}){
 const previousFocus=useRef(document.activeElement);
 useEffect(()=>()=>{if(previousFocus.current instanceof HTMLElement&&previousFocus.current.isConnected)previousFocus.current.focus();},[]);
 return <div className="modal-backdrop project-close-backdrop"><div className="modal small" role="dialog" aria-modal="true" aria-labelledby="close-project-title" onKeyDown={event=>{
  if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();onCancel();}
  if(event.key==='Tab'){
   const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];if(!buttons.length)return;
   const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 }}>
  <h2 id="close-project-title">Save changes before closing?</h2>
  <p className="modal-intro">“{name}” has unsaved changes.</p>
  <p className="hint">Save keeps this scene on your device. Don’t Save closes this tab and keeps the last successful save.</p>
  {error&&<p role="alert" className="project-close-error">{error}</p>}
  <div className="modal-actions"><button autoFocus disabled={busy} onClick={onCancel}>Cancel</button><button disabled={busy} onClick={onDiscard}>Don’t Save</button><button className="accent-button" disabled={busy} onClick={onSave}>{busy?'Saving…':'Save'}</button></div>
 </div></div>;
}


