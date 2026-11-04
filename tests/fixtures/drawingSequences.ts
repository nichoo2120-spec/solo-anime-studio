import type {Point} from '../../src/core/model';
const p=(x:number,y:number):Point=>({x,y,p:1});
const circle=(n:number)=>Array.from({length:n},(_,i)=>p(300+100*Math.cos(i/(n-1)*Math.PI*2),260+100*Math.sin(i/(n-1)*Math.PI*2)));
export const sequences={
 circle13:circle(13),circle30:circle(30),
 fastS:[p(100,220),p(140,150),p(180,120),p(220,150),p(260,220),p(300,290),p(340,320),p(380,290),p(420,220)],
 hair5:[p(110,260),p(145,160),p(210,120),p(275,160),p(305,275)],
 v3:[p(100,120),p(170,260),p(240,120)],
 z4:[p(100,120),p(260,120),p(100,280),p(260,280)],
 star:Array.from({length:11},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/5,r=i%2?38:100;return p(300+r*Math.cos(angle),260+r*Math.sin(angle));}),
 concave:[p(100,100),p(300,100),p(300,300),p(230,300),p(230,170),p(170,170),p(170,300),p(100,300),p(100,100)],
 hatches:Array.from({length:8},(_,i)=>[p(100+i*15,180),p(100+i*15+.7,181.3)]),
};
export const levels=[0,25,50,75,100] as const;
export const noisyLine=Array.from({length:121},(_,i)=>p(100+i*4,220+(i===0||i===120?0:(i%2?5:-5))));
const makeNoisy=(shape:(t:number)=>{x:number;y:number},amplitude:number)=>{
 const reference=Array.from({length:121},(_,i)=>({...shape(i/120),p:1}));
 const points=reference.map((p,i)=>({...p,y:p.y+(i===0||i===120?0:amplitude*(i%2?1:-1))}));return {reference,points};
};
export const noisyContours={
 s:makeNoisy(t=>({x:100+480*t,y:220+90*Math.sin(t*Math.PI*2)}),5),
 hair:makeNoisy(t=>({x:100+400*t,y:300-170*Math.sin(t*Math.PI)}),4),
 jaw:makeNoisy(t=>({x:100+480*t,y:150+140*Math.sin(t*Math.PI*.8)}),5),
 shoulder:makeNoisy(t=>({x:100+480*t,y:280-100*Math.sin(t*Math.PI*.6)}),5),
};
/** Logical recording clock: independent of browser event construction/RAF. */
export const recording=(points:Point[],step=4)=>points.map((point,index)=>({...point,timeStamp:1000+index*step,pointerId:7,pointerType:'mouse' as const}));
