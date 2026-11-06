import {memo,useRef,type PointerEvent} from 'react';
import {Music2,Volume2,VolumeX,X,Upload} from 'lucide-react';
import type {SceneAudio} from '../animation/audio';
import {secondsAtExposure} from '../animation/audio';
const WaveformPeaks=memo(function WaveformPeaks({peaks}:{peaks:number[]}){return <svg viewBox="0 0 512 44" preserveAspectRatio="none" aria-hidden="true">{peaks.map((peak,i)=><line key={i} x1={i+.5} x2={i+.5} y1={22-Math.max(1,peak*20)} y2={22+Math.max(1,peak*20)}/>)}</svg>;});
/** Audio waveform is derived from fixed import-time peaks; never traverses strokes. */
export const AudioTrack=memo(function AudioTrack({audio,expanded,shortcut,muted,busy,exposure,fps,total,onToggle,onImport,onRemove,onMute,onSeek}:{
 audio?:SceneAudio;expanded:boolean;shortcut:string;muted:boolean;busy:boolean;exposure:number;fps:number;total:number;
 onToggle:()=>void;onImport:(file:File)=>void;onRemove:()=>void;onMute:(muted:boolean)=>void;onSeek:(seconds:number)=>void;
}){
 const picker=useRef<HTMLInputElement>(null),wave=useRef<HTMLDivElement>(null),drag=useRef(false);
 function seek(e:PointerEvent<HTMLDivElement>){if(!audio||!wave.current)return;const rect=wave.current.getBoundingClientRect();if(!rect.width)return;const fraction=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));onSeek(fraction*audio.duration);}
 const position=audio?Math.min(100,secondsAtExposure(exposure,fps)/audio.duration*100):0;
 return <div className="audio-track" aria-label="Animation audio track">
  <div className="audio-track-header">
   <button type="button" className="audio-track-toggle" onClick={onToggle} title={'Audio · '+shortcut.toUpperCase()} aria-expanded={expanded}><Music2 size={13}/> AUDIO</button>
   {audio&&<span className="audio-track-filename" title={audio.name}>{audio.name}</span>}
   <button type="button" disabled={busy} onClick={()=>picker.current?.click()}><Upload size={12}/>{audio?'Replace':'Import'}</button>
   {audio&&<><button type="button" title={muted?'Unmute audio':'Mute audio'} aria-label={muted?'Unmute audio':'Mute audio'} onClick={()=>onMute(!muted)}>{muted?<VolumeX size={14}/>:<Volume2 size={14}/>}</button><button type="button" disabled={busy} aria-label="Remove scene audio" title="Remove audio (Undo available)" onClick={onRemove}><X size={14}/></button></>}
   <input ref={picker} hidden type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/aac,audio/webm,.mp3,.wav,.ogg,.m4a" aria-label="Choose animation audio file" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)onImport(file);}}/>
  </div>
  {expanded&&<div className="audio-track-body">
   {audio?<><div ref={wave} className="audio-waveform" role="slider" tabIndex={0} aria-label="Audio time scrubber" aria-valuemin={0} aria-valuemax={Math.round(audio.duration*100)/100} aria-valuenow={Math.min(audio.duration,secondsAtExposure(exposure,fps))} title="Click or drag to seek audio and animation frames" onPointerDown={e=>{if(e.button!==0)return;drag.current=true;e.currentTarget.setPointerCapture(e.pointerId);seek(e);}} onPointerMove={e=>{if(drag.current)seek(e);}} onPointerUp={e=>{if(!drag.current)return;seek(e);drag.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=false;}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();onSeek(Math.max(0,Math.min(audio.duration,secondsAtExposure(exposure,fps)+(e.key==='ArrowRight'?1:-1)/fps)));}}}>
    <WaveformPeaks peaks={audio.peaks}/>
    <span className="audio-playhead" style={{left:position+'%'}}/>
   </div><small>{secondsAtExposure(exposure,fps).toFixed(2)}s / {audio.duration.toFixed(2)}s · animation {total} frames at {fps} FPS · waveform follows frame selection</small></>:<span className="audio-empty">Import a short voice line, music cue or sound effect. MP3/WAV recommended; up to 50 MB / 20 min. Audio plays with the animation.</span>}
  </div>}
 </div>;
});
