import {useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Project,Stroke} from '../core/model';
import type {WidthPoint} from '../core/widthPoints';
import type {StudioEngine} from '../engine/StudioEngine';
import {strokeGeometry,flattenCubic} from '../engine/strokeGeometry';
import {drawModernStroke} from '../engine/brushRaster';
import {ExactRange} from './ExactRange';
const W=720,H=320,defaults:WidthPoint[]=[{at:0,scale:1},{at:1,scale:1}];
function pathData(stroke:Stroke){
 const g=strokeGeometry(stroke),raw=g.cubics.length?g.cubics.flatMap((c,i)=>flattenCubic(c,.12).slice(i?1:0)):g.points,arc=[0];
 for(let i=1;i<raw.length;i++)arc.push(arc[i-1]+Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y));
 const m=stroke.transform??[1,0,0,1,0,0],points=raw.map(p=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]}));
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}const pad=stroke.size*2+8,left=minX-pad,top=minY-pad,width=Math.max(1,maxX-left+pad),height=Math.max(1,maxY-top+pad),fit=Math.min((W-56)/width,(H-56)/height),ox=(W-width*fit)/2-left*fit,oy=(H-height*fit)/2-top*fit,total=arc.at(-1)??0;
 const screen=points.map(p=>({x:p.x*fit+ox,y:p.y*fit+oy}));
 const screenArc=[0];for(let i=1;i<screen.length;i++)screenArc.push(screenArc[i-1]+Math.hypot(screen[i].x-screen[i-1].x,screen[i].y-screen[i-1].y));const screenTotal=screenArc.at(-1)??0;
 const previewAt=(t:number)=>{if(!total||!screenTotal)return t;const distance=t*total;let i=1;while(i<arc.length-1&&arc[i]<distance)i++;const span=arc[i]-arc[i-1],u=span?(distance-arc[i-1])/span:0;return (screenArc[i-1]+u*(screenArc[i]-screenArc[i-1]))/screenTotal;};
 const at=(t:number)=>{const distance=t*total;let i=1;while(i<arc.length-1&&arc[i]<distance)i++;const a=screen[Math.max(0,i-1)]??{x:W/2,y:H/2},b=screen[Math.min(i,screen.length-1)]??a,span=(arc[i]??0)-(arc[i-1]??0),u=span?(distance-arc[i-1])/span:0,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;return {x:a.x+dx*u,y:a.y+dy*u,nx:-dy/len,ny:dx/len};};
 const map=(p:{x:number;y:number;p:number})=>({...p,x:(m[0]*p.x+m[2]*p.y+m[4])*fit+ox,y:(m[1]*p.x+m[3]*p.y+m[5])*fit+oy});
 const previewGeometry={...g,points:g.points.map(map),cubics:g.cubics.map(c=>({a:map(c.a),b:map(c.b),c1:map(c.c1),c2:map(c.c2)}))};
 return {screen,arc,total,fit,ox,oy,m,at,previewAt,previewGeometry,handleUnit:Math.max(15,stroke.size*.5*fit*Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2])))};
}
export function StrokeWidthEditor({engine,project,selectedCount}:{engine:StudioEngine|null;project:Project;selectedCount:number}){
 const [target,setTarget]=useState<Stroke>(),[points,setPoints]=useState<WidthPoint[]>(defaults),[selected,setSelected]=useState(0),canvas=useRef<HTMLCanvasElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),drag=useRef<{index:number;pointer:number}|undefined>(undefined);
 const candidate=engine?.selectedWidthStroke(),data=useMemo(()=>target?pathData(target):undefined,[target]);
 const close=()=>{setTarget(undefined);drag.current=undefined;trigger.current?.focus();};
 useEffect(()=>{if(target&&engine?.selectedWidthStroke()!==target)setTarget(undefined);},[engine,project,selectedCount,target]);
 useEffect(()=>{if(target)panel.current?.querySelector<HTMLButtonElement>('button')?.focus();},[target]);
 useEffect(()=>{if(!target||!data||!canvas.current)return;const ctx=canvas.current.getContext('2d')!;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=target.opacity;drawModernStroke(ctx,{...target,transform:undefined,size:target.size*data.fit*Math.sqrt(Math.abs(data.m[0]*data.m[3]-data.m[1]*data.m[2])),widthPointVersion:1,widthPoints:points.map(p=>({...p,at:data.previewAt(p.at)}))},'final',data.previewGeometry);ctx.restore();},[target,data,points]);
 const coordinate=(e:PointerEvent<SVGSVGElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};};
 const add=(e:PointerEvent<SVGSVGElement>)=>{if(!data||points.length>=32||e.button!==0)return;const p=coordinate(e);let best=14,t=-1;for(let i=1;i<data.screen.length;i++){const a=data.screen[i-1],b=data.screen[i],dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,u=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0,dist=Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);if(dist<best&&data.total){best=dist;t=(data.arc[i-1]+u*(data.arc[i]-data.arc[i-1]))/data.total;}}if(t<=.002||t>=.998||points.some(q=>Math.abs(q.at-t)<.003))return;const next=[...points,{at:t,scale:1}].sort((a,b)=>a.at-b.at);setPoints(next);setSelected(next.findIndex(q=>q.at===t));};
 const patch=(change:Partial<WidthPoint>)=>setPoints(old=>old.map((p,i)=>i===selected?{...p,...change}:p));
 return <><button ref={trigger} type="button" className="stroke-width-open" disabled={!candidate} onClick={()=>{if(!candidate)return;setTarget(candidate);setPoints(candidate.widthPoints?.map(p=>({...p}))??defaults.map(p=>({...p})));setSelected(0);}}>Advanced · Thick/thin points</button>{!candidate&&<p className="hint">Select exactly one unlocked Ink stroke to edit thickness. Photos, dot strokes, paint strokes, erasers and perspective-warped strokes are not supported here.</p>}
 {target&&data&&createPortal(<aside ref={panel} className="brush-settings-panel brush-studio stroke-width-editor" role="region" aria-label="Advanced stroke width editor" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}}}>
 <header className="brush-settings-header"><div><h2>Thick/thin points</h2><span>Advanced · Selected stroke</span></div><button type="button" aria-label="Close stroke width editor" onClick={close}>×</button></header>
 <div className="stroke-width-content"><p className="hint">Click near the preview line to add a point. Drag its outer handle to thicken or thin that part. The centreline stays fixed. Changes reach the drawing only when you Apply.</p>
 <div className="stroke-width-preview"><canvas ref={canvas} width={W} height={H} aria-label="Selected stroke width preview"/><svg viewBox={`0 0 ${W} ${H}`} aria-label="Width point handles" onPointerDown={add} onPointerMove={e=>{const active=drag.current;if(!active||active.pointer!==e.pointerId)return;const p=coordinate(e),q=data.at(points[active.index].at),scale=Math.max(.05,Math.min(2,((p.x-q.x)*q.nx+(p.y-q.y)*q.ny)/data.handleUnit));setPoints(old=>old.map((v,i)=>i===active.index?{...v,scale}:v));}} onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}} onLostPointerCapture={()=>{drag.current=undefined;}}>
 {points.map((p,i)=>{const q=data.at(p.at),x=q.x+q.nx*data.handleUnit*p.scale,y=q.y+q.ny*data.handleUnit*p.scale;return <g key={i} className={selected===i?'selected':''}><line x1={q.x} y1={q.y} x2={x} y2={y}/><circle className="width-anchor" cx={q.x} cy={q.y} r={5} onPointerDown={e=>{e.stopPropagation();setSelected(i);}}/><circle role="button" tabIndex={0} aria-label={'Width point '+(i+1)} className="width-handle" cx={x} cy={y} r={8} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i);}}} onPointerDown={e=>{e.stopPropagation();setSelected(i);drag.current={index:i,pointer:e.pointerId};e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);}}/></g>;})}
 </svg></div>
 <p className="hint">Point {selected+1} of {points.length} · 100% keeps the original thickness at that position.</p>
 <ExactRange name="Point thickness" min={5} max={200} value={Math.round(points[selected].scale*100)} unit="%" set={v=>patch({scale:v/100})}/>
 {selected>0&&selected<points.length-1&&<><ExactRange name="Point position" min={Math.ceil((points[selected-1].at+.002)*1000)/10} max={Math.floor((points[selected+1].at-.002)*1000)/10} step={.1} value={points[selected].at*100} unit="%" set={v=>patch({at:v/100})}/><button type="button" onClick={()=>{setPoints(old=>old.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1));}}>Delete selected point</button></>}
 <button type="button" onClick={()=>{setPoints(defaults.map(p=>({...p})));setSelected(0);}}>Reset width points</button><p className="hint">Each change affects only this line. End taper, pen pressure and any texture remain part of its original brush.</p>
 </div><footer className="brush-settings-footer"><button type="button" disabled={!target.widthPointVersion} onClick={()=>{if(engine?.applyStrokeWidthPoints(target,undefined))close();}}>Remove applied width points</button><div><button type="button" onClick={close}>Cancel</button><button type="button" className="primary" onClick={()=>{if(engine?.applyStrokeWidthPoints(target,points))close();}}>Apply thickness</button></div></footer>
 </aside>,document.body)}</>;
}

