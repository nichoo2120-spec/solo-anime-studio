import type {Project} from './model';
import {applyAutosaveDelta,type AutosaveDelta} from './autosaveDelta';
import {ProjectRepository} from './persistence';

const repository=new ProjectRepository();
let base:{requestId:number;project:Project}|undefined;
type SaveRequest={requestId:number;project:Project}|{requestId:number;baseId:number;delta?:AutosaveDelta};

self.onmessage=async({data}:MessageEvent<SaveRequest>)=>{
 const {requestId}=data;
 try{
  let project:Project;
  if('project' in data)project=data.project;
  else{
   if(!base||base.requestId!==data.baseId)throw Error('Autosave worker needs a complete snapshot');
   project=applyAutosaveDelta(base.project,data.delta) as Project;
  }
  base={requestId,project};
  const record=await repository.save(project,'autosave');
  self.postMessage({requestId,savedAt:record.savedAt});
 }catch(error){self.postMessage({requestId,error:String(error)});}
};
