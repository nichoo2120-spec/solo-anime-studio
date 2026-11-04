import {ProjectRepository} from './persistence';
const repository=new ProjectRepository();
self.onmessage=async(event:MessageEvent)=>{const {requestId,project}=event.data;try{const record=await repository.save(project,'autosave');self.postMessage({requestId,savedAt:record.savedAt});}catch(error){self.postMessage({requestId,error:String(error)});}};
