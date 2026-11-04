/** Phase 2B: one shot-local audio clip, saved with the editable project.
 * Peaks are computed only at import time, never in the pen/render loop.
 */
export const MAX_AUDIO_BYTES=50*1024*1024;
export const MAX_AUDIO_SECONDS=20*60;
export const AUDIO_PEAK_COUNT=512;
export type SceneAudio={version:1;name:string;mime:string;data:string;duration:number;peaks:number[];assetId?:string};
export const acceptedAudioMime=(type:string)=>/^(audio\/(mpeg|mp3|wav|wave|x-wav|ogg|mp4|x-m4a|aac|webm))$/i.test(type);
export function validateSceneAudio(value:unknown):value is SceneAudio {
 const a=value as Partial<SceneAudio>|undefined;
 return !!a&&a.version===1&&typeof a.name==='string'&&a.name.length>0&&a.name.length<=180&&
 typeof a.mime==='string'&&acceptedAudioMime(a.mime)&&typeof a.data==='string'&&
 a.data.startsWith(`data:${a.mime};base64,`)&&a.data.length<=Math.ceil(MAX_AUDIO_BYTES*4/3)+120&&
 /^data:audio\/[\w+-]+;base64,[a-zA-Z0-9+/=]+$/.test(a.data)&&
 (a.assetId===undefined||(typeof a.assetId==='string'&&a.assetId.length>0&&a.assetId.length<=250))&&
 typeof a.duration==='number'&&Number.isFinite(a.duration)&&a.duration>0&&a.duration<=MAX_AUDIO_SECONDS&&
 Array.isArray(a.peaks)&&a.peaks.length===AUDIO_PEAK_COUNT&&a.peaks.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
}
/** Bounded read-only waveform; ~262,000 samples examined, regardless of clip length. */
export function audioPeaks(buffer:AudioBuffer):number[]{
 const length=buffer.length,count=AUDIO_PEAK_COUNT,channels=Math.min(2,buffer.numberOfChannels);
 if(!length||!channels)return Array(count).fill(0);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));
 const result:number[]=[];
 for(let i=0;i<count;i++){
  const from=Math.floor(i*length/count),to=Math.min(length,Math.floor((i+1)*length/count));
  const step=Math.max(1,Math.ceil((to-from)/512));let max=0;
  for(let pos=from;pos<to;pos+=step)for(let c=0;c<channels;c++)max=Math.max(max,Math.abs(data[c][pos]||0));
  result.push(Math.min(1,max));
 }
 return result;
}
export function secondsAtExposure(exposure:number,fps:number){return Math.max(0,(Math.max(1,Math.floor(exposure))-1)/Math.max(1,fps));}
export function exposureAtSeconds(seconds:number,fps:number,totalExposures:number){return Math.max(1,Math.min(Math.max(1,totalExposures),Math.floor(Math.max(0,seconds)*Math.max(1,fps))+1));}
export async function importSceneAudio(file:File):Promise<SceneAudio>{
 if(!acceptedAudioMime(file.type))throw Error('Use MP3, WAV, OGG, M4A, AAC or WebM audio supported by Chrome.');
 if(file.size===0||file.size>MAX_AUDIO_BYTES)throw Error('Audio files must be 50 MB or smaller. For long audio, MP3 is recommended.');
 const buffer=await file.arrayBuffer();
 const AudioContextClass=window.AudioContext;
 if(!AudioContextClass)throw Error('This browser does not support audio decoding.');
 const context=new AudioContextClass();
 let decoded:AudioBuffer;
 try{decoded=await context.decodeAudioData(buffer.slice(0));}catch{throw Error('Chrome could not decode this audio file. Try MP3 or WAV.');}
 finally{void context.close();}
 if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>MAX_AUDIO_SECONDS)throw Error('Audio must be 20 minutes or shorter. Split longer recordings into scenes.');
 const peaks=audioPeaks(decoded);
 // Base64 is portable in .solo.json; import is an explicit action, not a drawing-time operation.
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Could not read audio.'));reader.onerror=()=>reject(Error('Could not read audio.'));reader.readAsDataURL(file);});
 const audio:SceneAudio={version:1,name:file.name.slice(0,180),mime:file.type,data,duration:decoded.duration,peaks,assetId:crypto.randomUUID()};
 if(!validateSceneAudio(audio))throw Error('Imported audio metadata was invalid.');
 return audio;
}
