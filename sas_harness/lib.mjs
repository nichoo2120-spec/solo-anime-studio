import {chromium} from '/workspace/sas_work/node_modules/playwright-core/index.mjs';
export const PORT={v152:6152,v153:6153,v154:6154,v156:6156,v158:6158,dev:6160,v160:6160,v161:6161};
export const INIT=()=>{
 window.__S={gid:0,gidPx:0,commits:0,moves:0,lat:[],frames:[],raf:[],lt:[],handler:[],canv:[]};
 const S=window.__S;
 window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),inject(){return 1},onCommitFiberRoot(){S.commits++},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},checkDCE(){}};
 const gi=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h,...r){S.gid++;S.gidPx+=w*h;return gi.call(this,x,y,w,h,...r)};
 if(window.OffscreenCanvasRenderingContext2D){const g2=OffscreenCanvasRenderingContext2D.prototype.getImageData;OffscreenCanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h,...r){S.gid++;S.gidPx+=w*h;return g2.call(this,x,y,w,h,...r)};}
 const ce=Document.prototype.createElement;Document.prototype.createElement=function(t,...r){const e=ce.call(this,t,...r);if(String(t).toLowerCase()==='canvas')S.canv.push(new WeakRef(e));return e};
 const rq=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>rq(t=>{const a=performance.now();try{cb(t)}finally{if(S.on)S.raf.push(performance.now()-a)}});
 let pend=null,t0=0;
 window.addEventListener('pointermove',e=>{if(!S.on)return;S.moves++;t0=performance.now();if(pend===null)pend=e.timeStamp;S.coal=(S.coal||0)+(e.getCoalescedEvents?e.getCoalescedEvents().length:1)},true);
 window.addEventListener('pointermove',e=>{if(S.on)S.handler.push(performance.now()-t0)},false);
 let last=0;const loop=t=>{if(S.on){if(last)S.frames.push(t-last);if(pend!==null){S.lat.push(performance.now()-pend);pend=null}}last=S.on?t:0;rq(loop)};rq(loop);
 try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(S.on)S.lt.push(e.duration)}).observe({type:'longtask'})}catch{}
};
export async function open(ver,dpr,{w=2048,h=1152,throttle=1}={}){
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu','--enable-precise-memory-info']});
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,acceptDownloads:true});
 await ctx.addInitScript(INIT);const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
 await pg.goto(`http://127.0.0.1:${PORT[ver]}/`);await pg.waitForTimeout(2500);
 const cdp=await ctx.newCDPSession(pg);if(throttle>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 return {b,pg,cdp,errs};
}
export const sel=(pg,l,v)=>pg.getByLabel(l,{exact:true}).selectOption(v);
export async function field(pg,n,v){const i=pg.getByLabel(n+' exact value',{exact:true});await i.fill(String(v));await i.press('Enter');}
// high-rate pen stroke via CDP, 200 Hz schedule, not awaiting each event (lets Chrome coalesce)
export async function penStroke(pg,cdp,box,{n=300,hz=200,pts}={}){
 const P=i=>{const t=i/n;return pts?pts(t):[box.x+box.width*(.15+.7*t),box.y+box.height*(.5+.18*Math.sin(t*Math.PI*4))]};
 const ev=(type,i,extra={})=>{const [x,y]=P(i);return cdp.send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'pen',force:.4+.5*Math.sin(Math.PI*i/n),...extra}).catch(()=>{})};
 await ev('mouseMoved',0,{buttons:0});await ev('mousePressed',0);
 await pg.evaluate(()=>{const S=window.__S;Object.assign(S,{gid:0,gidPx:0,commits:0,moves:0,coal:0,lat:[],frames:[],raf:[],lt:[],handler:[]});S.on=true;S.heap0=performance.memory?.usedJSHeapSize});
 const t0=Date.now();const all=[];
 for(let i=1;i<=n;i++){const due=t0+i*1000/hz;const wait=due-Date.now();if(wait>1)await new Promise(r=>setTimeout(r,wait));all.push(ev('mouseMoved',i));}
 await Promise.all(all);const sendMs=Date.now()-t0;
 const up0=Date.now();await ev('mouseReleased',n);
 await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const upMs=Date.now()-up0;
 await pg.waitForTimeout(300);
 const r=await pg.evaluate(()=>{const S=window.__S;S.on=false;const st=a=>{if(!a.length)return {};const s=[...a].sort((x,y)=>x-y);const q=p=>+s[Math.min(s.length-1,Math.floor(s.length*p))].toFixed(1);return {n:a.length,p50:q(.5),p95:q(.95),max:+s.at(-1).toFixed(1),mean:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2)}};
  return {frames:st(S.frames),over50:S.frames.filter(x=>x>50).length,lat:st(S.lat),handler:st(S.handler),raf:st(S.raf),longtasks:S.lt.length,ltMax:+Math.max(0,...S.lt).toFixed(0),ltSum:+S.lt.reduce((a,b)=>a+b,0).toFixed(0),moves:S.moves,coalesced:S.coal,commits:S.commits,gid:S.gid,gidMpx:+(S.gidPx/1e6).toFixed(2),heapMB:+((performance.memory?.usedJSHeapSize||0)/1e6).toFixed(1),heapDeltaMB:+(((performance.memory?.usedJSHeapSize||0)-S.heap0)/1e6).toFixed(1)}});
 r.sendMs=sendMs;r.upMs=upMs;return r;
}
export async function canvases(pg){return pg.evaluate(()=>{const live=[...document.querySelectorAll('canvas')];const all=window.__S.canv.map(w=>w.deref()).filter(Boolean);const mp=a=>+(a.reduce((s,c)=>s+c.width*c.height,0)/1e6).toFixed(1);const big=live.map(c=>[c.getAttribute('aria-label')||c.className||'canvas',c.width,c.height]).filter(x=>x[1]*x[2]>1e5);return {domCount:live.length,domMpx:mp(live),allCount:all.length,allMpx:mp(all),big,dpr:devicePixelRatio}});}
