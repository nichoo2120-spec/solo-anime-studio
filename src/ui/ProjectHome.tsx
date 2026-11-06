import {useRef,useState,type DragEvent} from 'react';
import {readPreference,writePreference} from './preferences';
import {uid,type Project} from '../core/model';
import {buildInfo} from '../core/buildInfo';

type Episode={id:string;name:string;scenes:string[]};
type Production={id:string;name:string;episodes:Episode[]};
type Record={id:string;project:Project;savedAt:string};

const sceneDragType='application/x-solo-scene';
const photoFile=(files:FileList)=>Array.from(files).find(file=>['image/png','image/jpeg','image/webp'].includes(file.type));
export function ProjectHome({records,open,create,importBackup,activeId,deleteScenes,combine,placePhoto}:{
 records:Record[];
 open:(project:Project)=>void;
 create:(name:string,width:number,height:number,photo?:File)=>Promise<string|undefined>;
 importBackup:()=>void;
 activeId:string;
 deleteScenes:(ids:string[])=>Promise<boolean|undefined>;
 combine:(destination:Project,source:Project)=>Promise<string|undefined>;
 placePhoto:(project:Project,file:File)=>Promise<void>;
}){
 const [projects,setProjects]=useState(()=>readPreference<Production[]>('production-library',[]));
 const [projectId,selectProject]=useState('');
 const [episodeId,selectEpisode]=useState('');
 const [name,setName]=useState('');
 const [episodeName,setEpisodeName]=useState('');
 const [sceneName,setSceneName]=useState('');
 const [size,setSize]=useState('1920x1080');
 const nameInput=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false);
 const [selecting,setSelecting]=useState(false);
 const [selected,setSelected]=useState<string[]>([]);
 const [photo,setPhoto]=useState<File>();
 const [checkingUpdate,setCheckingUpdate]=useState(false);
 const [updateStatus,setUpdateStatus]=useState('');
 const desktop=(window as Window&{soloDesktop?:{version?:string;checkForUpdates?:()=>Promise<string>}}).soloDesktop;
 async function checkForUpdates(){
  if(checkingUpdate||!desktop?.checkForUpdates)return;
  setCheckingUpdate(true);
  setUpdateStatus('');
  try{setUpdateStatus(await desktop.checkForUpdates());}
  catch{setUpdateStatus('Could not check for updates. Try again in a moment.');}
  finally{setCheckingUpdate(false);}
 }
 const project=projects.find(item=>item.id===projectId);
 const episode=project?.episodes.find(item=>item.id===episodeId);
 const label=episode?'Scene':project?'Episode':'Project';
 const scenePaths=new Map(projects.flatMap(item=>item.episodes.flatMap(entry=>entry.scenes.map(id=>[id,item.name+' / '+entry.name] as const))));
 const ready=!!name.trim()&&(!!project||!!episodeName.trim()&&!!sceneName.trim());
 const save=(next:Production[])=>{writePreference('production-library',next);setProjects(next);};
 const available=records.filter(record=>record.id!==activeId&&(!episode||episode.scenes.includes(record.id)));
 function toggle(id:string){
  setSelected(items=>items.includes(id)?items.filter(item=>item!==id):[...items,id]);
 }
 function sceneIds(item:Production){return item.episodes.flatMap(entry=>entry.scenes).filter(id=>records.some(record=>record.id===id));}
 function toggleProject(item:Production){
  const ids=sceneIds(item).filter(id=>id!==activeId);
  setSelected(current=>ids.every(id=>current.includes(id))?current.filter(id=>!ids.includes(id)):[...new Set([...current,...ids])]);
 }
 function allowDrop(event:DragEvent){
  if(busy||selecting)return;
  if(Array.from(event.dataTransfer.types).some(type=>type==='Files'||type===sceneDragType)){
   event.preventDefault();
   event.dataTransfer.dropEffect='copy';
  }
 }
 async function dropOnScene(event:DragEvent,destination:Project){
  event.preventDefault();
  event.stopPropagation();
  if(busy||selecting)return;
  const image=photoFile(event.dataTransfer.files);
  const source=records.find(item=>item.id===event.dataTransfer.getData(sceneDragType))?.project;
  if(!image&&(!source||source.id===destination.id))return;
  setBusy(true);
  try{
   if(image){await placePhoto(destination,image);return;}
   if(!source)return;
   const id=await combine(destination,source);
   if(id)save(projects.map(item=>({...item,episodes:item.episodes.map(entry=>entry.scenes.includes(destination.id)?{...entry,scenes:[...entry.scenes,id]}:entry)})));
  }finally{setBusy(false);}
 }
 async function removeSelected(){
  if(!selected.length||busy)return;
  setBusy(true);
  try{
   if(await deleteScenes(selected)){
    const removed=new Set(selected);
    save(projects.flatMap(item=>{
     const hadScenes=item.episodes.some(entry=>entry.scenes.length);
     const episodes=item.episodes.map(entry=>({...entry,scenes:entry.scenes.filter(id=>!removed.has(id))}));
     return hadScenes&&!episodes.some(entry=>entry.scenes.length)?[]:[{...item,episodes}];
    }));
    setSelected([]);
    setSelecting(false);
   }
  }finally{setBusy(false);}
 }
 async function add(){
  const title=name.trim();
  if(!ready||busy)return;
  const [width,height]=size.split('x').map(Number);
  if(!project){
   setBusy(true);
   try{
    const id=await create(sceneName.trim(),width,height,photo);
    if(!id)return;
    save([...projects,{id:uid(),name:title,episodes:[{id:uid(),name:episodeName.trim(),scenes:[id]}]}]);
   }finally{setBusy(false);}
  }else if(!episode){
   const id=uid();
   save(projects.map(item=>item.id===project.id?{...item,episodes:[...item.episodes,{id,name:title,scenes:[]}]}:item));
   selectEpisode(id);
  }else{
   setBusy(true);
   try{
    const id=await create(title,width,height,photo);
    if(!id)return;
    save(projects.map(item=>item.id===project.id?{...item,episodes:item.episodes.map(entry=>entry.id===episode.id?{...entry,scenes:[...entry.scenes,id]}:entry)}:item));
   }finally{setBusy(false);}
  }
  setName('');
 }
 const scenes=(list:Record[])=>list.length?list.map(({id,project,savedAt})=><button className="startup-row" key={id} type="button" disabled={busy||selecting&&id===activeId} aria-pressed={selecting?selected.includes(id):undefined} draggable={!busy&&!selecting} onDragStart={event=>{event.dataTransfer.setData(sceneDragType,id);event.dataTransfer.effectAllowed='copy';}} onDragOver={allowDrop} onDrop={event=>void dropOnScene(event,project)} onClick={()=>selecting?toggle(id):open(project)}><strong>{selecting?(selected.includes(id)?'☑ ':'☐ '):''}{project.name}</strong><span>{scenePaths.get(id)??'Standalone scene'}</span><span>{new Date(savedAt).toLocaleDateString()}</span></button>):<p className="startup-empty">Saved scenes will appear here.</p>;
 return <div className="project-home">
  <header className="startup-bar"><strong><span aria-hidden="true">◩</span> Solo Anime Studio</strong><small>WORKSPACE</small></header>
  {desktop?.checkForUpdates&&<div className="startup-update">
   <button type="button" disabled={checkingUpdate} onClick={()=>void checkForUpdates()}>v{desktop.version??buildInfo.version} · {checkingUpdate?'Checking…':'Check for updates'}</button>
   <span role="status">{updateStatus}</span>
  </div>}
  <div className="startup-content">
   <small>HOME</small>
   <h1 id="dialog-title">{episode?.name??project?.name??'Project workspace'}</h1>
   <p>Open a recent scene or set up a new project.</p>
   <div className="startup-actions">
    {project?<button disabled={busy} onClick={()=>{selectProject('');selectEpisode('');setName('');}}>All projects</button>:<button className="accent-button" onClick={()=>nameInput.current?.focus()}>＋ New Project</button>}
    {episode&&<button disabled={busy} onClick={()=>{selectEpisode('');setName('');}}>{project?.name}</button>}
    <button disabled={busy} onClick={importBackup}>Open Backup…</button>
    {(!project||episode)&&<button disabled={busy} onClick={()=>{setSelecting(!selecting);setSelected([]);}}>{selecting?'Cancel selection':episode?'Select Scenes':'Select Projects'}</button>}
    {selecting&&(!project||episode)&&<>
     <button disabled={busy||!available.length} onClick={()=>setSelected(available.map(record=>record.id))}>Select All</button>
     <button disabled={busy||!selected.length} onClick={()=>void removeSelected()}>Delete Selected ({selected.length})</button>
    </>}
   </div>
   <div className="startup-grid">
    <div>
     <section className="startup-panel">
      <h2>{project&&!episode?'Episodes':'Recent scenes'}</h2>
      {project&&!episode?project.episodes.map(item=><button className="startup-folder" key={item.id} disabled={busy} onClick={()=>{selectEpisode(item.id);setName('');}}>{item.name} ›</button>):<>
       <div className="startup-row startup-columns"><span>SCENE</span><span>PROJECT / EPISODE</span><span>LAST SAVED</span></div>
       {scenes(episode?records.filter(item=>episode.scenes.includes(item.id)):records)}
      </>}
     </section>
     {!project&&projects.length>0&&<section className="startup-panel startup-library"><h2>Projects</h2>{projects.map(item=>{
      const ids=sceneIds(item),only=ids.length===1?records.find(record=>record.id===ids[0]):undefined;
      const removable=ids.filter(id=>id!==activeId);
      const checked=!!removable.length&&removable.every(id=>selected.includes(id));
      return <button className="startup-folder" key={item.id} disabled={busy||selecting&&!removable.length} aria-pressed={selecting?checked:undefined} draggable={!!only&&!busy&&!selecting} onDragStart={event=>{if(only){event.dataTransfer.setData(sceneDragType,only.id);event.dataTransfer.effectAllowed='copy';}}} onDragOver={only?allowDrop:undefined} onDrop={only?event=>void dropOnScene(event,only.project):undefined} onClick={()=>{if(selecting){toggleProject(item);return;}selectProject(item.id);setName('');}}>{selecting?(checked?'☑ ':'☐ '):''}{item.name}{selecting?'':' ›'}</button>;
     })}</section>}
    </div>
    <section className="startup-panel">
     <h2>{project?'New '+label:'New project setup'}</h2>
     <form className="startup-form" onDragOver={event=>{if((!project||episode)&&Array.from(event.dataTransfer.types).includes('Files'))allowDrop(event);}} onDrop={event=>{if(busy||selecting||project&&!episode)return;const image=photoFile(event.dataTransfer.files);if(image){event.preventDefault();setPhoto(image);}}} onSubmit={event=>{event.preventDefault();void add();}}>
      <fieldset disabled={busy}>
       <label className="form-label">{label} name<input ref={nameInput} value={name} onChange={event=>setName(event.target.value)} required maxLength={100}/></label>
       {!project&&<>
        <label className="form-label">Episode name<input value={episodeName} onChange={event=>setEpisodeName(event.target.value)} required maxLength={100}/></label>
        <label className="form-label">Scene name<input value={sceneName} onChange={event=>setSceneName(event.target.value)} required maxLength={100}/></label>
       </>}
       {(!project||episode)&&<label className="form-label">Canvas size<select value={size} onChange={event=>setSize(event.target.value)}><option value="1920x1080">1920 × 1080 · Full HD</option><option value="1280x720">1280 × 720 · HD</option><option value="1080x1080">1080 × 1080 · Square</option><option value="2048x2048">2048 × 2048 · Square</option><option value="720x1920">720 × 1920 · Tall portrait</option><option value="1080x1920">1080 × 1920 · Full HD portrait</option><option value="720x1280">720 × 1280 · HD portrait</option></select></label>}
       {(!project||episode)&&<label className="form-label">Optional photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>setPhoto(event.target.files?.[0])}/>{photo&&<span>{photo.name}</span>}</label>}
       <button className="accent-button" disabled={!ready||busy} type="submit">{project&&!episode?'Create Episode':'Create Scene'}</button>
      </fieldset>
     </form>
    </section>
   </div>
  </div>
 </div>;
}
