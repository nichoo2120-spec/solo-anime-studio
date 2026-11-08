import {memo,useEffect,useRef} from 'react';
import type {BrushPreset} from '../core/brushes';
import {brushStrokeMetadata,paintTips} from '../core/paintTips';
import {isColoringTip,defaultColorNib,colorNibs} from '../core/coloring';
import {coloringPreview} from '../engine/coloringPreview';
const TipCard=memo(function TipCard({preset,active,onChoose}:{preset:BrushPreset;active:boolean;onChoose:(id:string)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),s=preset.settings;
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const c=canvas.current!,ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);ctx.save();coloringPreview(ctx,{...s,...brushStrokeMetadata(s),id:'tip-dot',kind:'stroke',tool:'brush',size:Math.min(19,s.size),color:'#dce5e9',pressure:false,points:[{x:17,y:24,p:1}]});coloringPreview(ctx,{...s,...brushStrokeMetadata(s),id:'tip-preview',kind:'stroke',tool:'brush',size:Math.min(19,s.size),color:'#dce5e9',points:Array.from({length:32},(_,i)=>({x:46+i/31*81,y:24+8*Math.sin(i/31*Math.PI*2),p:.25+.75*Math.sin(i/31*Math.PI)}))});ctx.globalCompositeOperation='destination-in';ctx.globalAlpha=s.opacity;ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.restore();});return()=>cancelAnimationFrame(frame);},[s]);
 const tip=isColoringTip(s.brushTip)?colorNibs.find(n=>n.id===(s.colorNib??defaultColorNib(s.brushTip)))?.name??'Nib':s.brushTip==='round'?(s.brushKind==='airbrush'?'Soft round':'Original tip'):paintTips.find(t=>t.id===s.brushTip)?.name??'Original tip';
 return <button type="button" className={'paint-tip-card'+(active?' selected':'')} title={preset.name+' · '+tip} aria-label={'Use '+preset.name} aria-pressed={active} onClick={()=>onChoose(preset.id)}><canvas ref={canvas} width="140" height="48" aria-label={preset.name+' stroke preview'}/><span>{preset.name}</span><small>{tip}</small></button>;
});
export const PaintBrushPicker=memo(function PaintBrushPicker({presets,selected,family,onChoose,category='Paint'}:{presets:BrushPreset[];selected:string;family?:BrushPreset['family'];category?:BrushPreset['category'];onChoose:(id:string)=>void}){
 return <div className="paint-tip-picker" role="group" aria-label={category==='Paint'?'Paint brush tips':'Brush tip presets'}>{presets.filter(p=>p.category===category&&(!family||p.family===family)).map(p=><TipCard key={p.id} preset={p} active={p.id===selected} onChoose={onChoose}/>)}</div>;
});

