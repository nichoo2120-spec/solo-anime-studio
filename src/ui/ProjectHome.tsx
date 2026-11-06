import {useRef,useState} from 'react';
import {readPreference,writePreference} from './preferences';
import {uid,type Project} from '../core/model';

type Episode={id:string;name:string;scenes:string[]};
type Production={id:string;name:string;episodes:Episode[]};
type Record={id:string;project:Project;savedAt:string};

export function ProjectHome({records,open,create,importBackup}:{
 records:Record[];
 open:(project:Project)=>void;
 create:(name:string,width:number,height:number)=>Promise<string|undefined>;
 importBackup:()=>void;
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
 const project=projects.find(item=>item.id===projectId);
 const episode=project?.episodes.find(item=>item.id===episodeId);
 const label=episode?'Scene':project?'Episode':'Project';
 const scenePaths=new Map(projects.flatMap(item=>item.episodes.flatMap(entry=>entry.scenes.map(id=>[id,item.name+' / '+entry.name] as const))));
 const ready=!!name.trim()&&(!!project||!!episodeName.trim()&&!!sceneName.trim());
 const save=(next:Production[])=>{writePreference('production-library',next);setProjects(next);};
 async function add(){
  const title=name.trim();
  if(!ready||busy)return;
  const [width,height]=size.split('x').map(Number);
  if(!project){
   setBusy(true);
   try{
    const id=await create(sceneName.trim(),width,height);
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
    const id=await create(title,width,height);
    if(!id)return;
    save(projects.map(item=>item.id===project.id?{...item,episodes:item.episodes.map(entry=>entry.id===episode.id?{...entry,scenes:[...entry.scenes,id]}:entry)}:item));
   }finally{setBusy(false);}
  }
  setName('');
 }
 const scenes=(list:Record[])=>list.length?list.map(({id,project,savedAt})=><button className="startup-row" key={id} type="button" disabled={busy} onClick={()=>open(project)}><strong>{project.name}</strong><span>{scenePaths.get(id)??'Standalone scene'}</span><span>{new Date(savedAt).toLocaleDateString()}</span></button>):<p className="startup-empty">Saved scenes will appear here.</p>;
 return <div className="project-home">
  <header className="startup-bar"><strong><span aria-hidden="true">◩</span> Solo Anime Studio</strong><small>WORKSPACE</small></header>
  <div className="startup-content">
   <small>HOME</small>
   <h1 id="dialog-title">{episode?.name??project?.name??'Project workspace'}</h1>
   <p>Open a recent scene or set up a new project.</p>
   <div className="startup-actions">
    {project?<button disabled={busy} onClick={()=>{selectProject('');selectEpisode('');setName('');}}>All projects</button>:<button className="accent-button" onClick={()=>nameInput.current?.focus()}>＋ New Project</button>}
    {episode&&<button disabled={busy} onClick={()=>{selectEpisode('');setName('');}}>{project?.name}</button>}
    <button disabled={busy} onClick={importBackup}>Open Backup…</button>
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
     {!project&&projects.length>0&&<section className="startup-panel startup-library"><h2>Projects</h2>{projects.map(item=><button className="startup-folder" key={item.id} disabled={busy} onClick={()=>{selectProject(item.id);setName('');}}>{item.name} ›</button>)}</section>}
    </div>
    <section className="startup-panel">
     <h2>{project?'New '+label:'New project setup'}</h2>
     <form className="startup-form" onSubmit={event=>{event.preventDefault();void add();}}>
      <fieldset disabled={busy}>
       <label className="form-label">{label} name<input ref={nameInput} value={name} onChange={event=>setName(event.target.value)} required maxLength={100}/></label>
       {!project&&<>
        <label className="form-label">Episode name<input value={episodeName} onChange={event=>setEpisodeName(event.target.value)} required maxLength={100}/></label>
        <label className="form-label">Scene name<input value={sceneName} onChange={event=>setSceneName(event.target.value)} required maxLength={100}/></label>
       </>}
       {(!project||episode)&&<label className="form-label">Canvas size<select value={size} onChange={event=>setSize(event.target.value)}><option value="1920x1080">1920 × 1080 · Full HD</option><option value="1280x720">1280 × 720 · HD</option><option value="1080x1080">1080 × 1080 · Square</option><option value="2048x2048">2048 × 2048 · Square</option></select></label>}
       <button className="accent-button" disabled={!ready||busy} type="submit">{project&&!episode?'Create Episode':'Create Scene'}</button>
      </fieldset>
     </form>
    </section>
   </div>
  </div>
 </div>;
}
