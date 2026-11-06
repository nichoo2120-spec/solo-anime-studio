import {useState} from 'react';
import {readPreference,writePreference} from './preferences';
import {uid,type Project} from '../core/model';

type Episode={id:string;name:string;scenes:string[]};
type Production={id:string;name:string;episodes:Episode[]};
type Record={id:string;project:Project;savedAt:string};

export function ProjectHome({records,open,create,importBackup}:{
 records:Record[];
 open:(project:Project)=>void;
 create:(name:string)=>Promise<string|undefined>;
 importBackup:()=>void;
}){
 const [projects,setProjects]=useState(()=>readPreference<Production[]>('production-library',[]));
 const [projectId,selectProject]=useState('');
 const [episodeId,selectEpisode]=useState('');
 const [name,setName]=useState('');
 const [busy,setBusy]=useState(false);
 const project=projects.find(item=>item.id===projectId);
 const episode=project?.episodes.find(item=>item.id===episodeId);
 const label=episode?'Scene':project?'Episode':'Project';
 const assigned=new Set(projects.flatMap(item=>item.episodes.flatMap(item=>item.scenes)));
 const save=(next:Production[])=>{writePreference('production-library',next);setProjects(next);};
 async function add(){
  const title=name.trim();
  if(!title||busy)return;
  if(!project){
   const id=uid();
   save([...projects,{id,name:title,episodes:[]}]);
   selectProject(id);
  }else if(!episode){
   const id=uid();
   save(projects.map(item=>item.id===project.id?{...item,episodes:[...item.episodes,{id,name:title,scenes:[]}]}:item));
   selectEpisode(id);
  }else{
   setBusy(true);
   try{
    const id=await create(title);
    if(!id)return;
    save(projects.map(item=>item.id===project.id?{...item,episodes:item.episodes.map(entry=>entry.id===episode.id?{...entry,scenes:[...entry.scenes,id]}:entry)}:item));
   }finally{setBusy(false);}
  }
  setName('');
 }
 const scenes=(list:Record[])=>list.map(({id,project,savedAt})=><button key={id} type="button" onClick={()=>open(project)}><span><strong>{project.name}</strong><small>{new Date(savedAt).toLocaleString()}</small></span></button>);
 return <div className="project-home">
  <span className="eyebrow">SOLO ANIME STUDIO</span>
  <h2 id="dialog-title">{episode?.name??project?.name??'Projects'}</h2>
  {project&&<div className="modal-actions"><button onClick={()=>{selectProject('');selectEpisode('');setName('');}}>All projects</button>{episode&&<button onClick={()=>{selectEpisode('');setName('');}}>{project.name}</button>}</div>}
  <div className="project-list">
   {episode?scenes(records.filter(item=>episode.scenes.includes(item.id))):project?
    project.episodes.map(item=><button key={item.id} onClick={()=>{selectEpisode(item.id);setName('');}}>{item.name}</button>):
    projects.map(item=><button key={item.id} onClick={()=>{selectProject(item.id);setName('');}}>{item.name}</button>)}
  </div>
  <form onSubmit={event=>{event.preventDefault();void add();}}>
   <label className="form-label">{label} name<input value={name} onChange={event=>setName(event.target.value)} required maxLength={100}/></label>
   <div className="modal-actions"><button className="accent-button" disabled={busy} type="submit">New {label}</button></div>
  </form>
  {!project&&<>
   <h3>Recent Projects</h3>
   <div className="project-list">{records.length?scenes(records):<p className="hint">Saved scenes will appear here.</p>}</div>
   {records.some(item=>!assigned.has(item.id))&&<p className="hint">Earlier drawings are available in Recent Projects.</p>}
   <div className="modal-actions"><button onClick={importBackup}>Import backup…</button></div>
  </>}
 </div>;
}
