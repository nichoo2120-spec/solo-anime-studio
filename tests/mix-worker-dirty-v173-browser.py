"""Isolated Chromium worker-behavior simulation using v171's actual worker update
and native mixing functions with a deterministic stand-in stroke rasterizer.
Not a complete Studio/Wacom latency benchmark.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
mix=(root/'offline/src/engine/nativeBrushMix.js').read_text().replace('export function applyNativeBrushMix','function applyNativeBrushMix')
baseline=bool(os.environ.get('SAS_BASELINE_WORKER'))
worker=(Path(os.environ['SAS_BASELINE_WORKER']) if baseline else root/'offline/src/engine/liveBlend.worker.js').read_text()
worker='\n'.join(x for x in worker.splitlines() if not x.startswith('import '))
worker=worker.replace("Object.defineProperty(globalThis, 'document', { value: { createElement: (tag) => { if (tag !== 'canvas')\n            throw Error('Unsupported worker element'); return new OffscreenCanvas(1, 1); } } });",'')
worker=worker.replace('const worker = self;',"const worker = { postMessage(data) { globalThis.__replies.push(data); } }; globalThis.__worker=worker;")
prefix="""
globalThis.__replies=[];
class FakeOffscreenCanvas {constructor(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}}
const OffscreenCanvas=FakeOffscreenCanvas;
function resetWetSmudgeCaches(){}
function resetGentleBlend(){}
function strokeGeometry(s){return s.points;}
function finalGeometry(s){return s.points;}
function strokeRasterBounds(s,w,h){let x0=Math.min(...s.points.map(p=>p.x))-8,x1=Math.max(...s.points.map(p=>p.x))+8;return {x:Math.max(0,Math.floor(x0)),y:70,width:Math.min(w,Math.ceil(x1))-Math.max(0,Math.floor(x0)),height:26};}
class LiveStrokeRaster{
 lastRegion;lastX=0;
 reset(){this.lastX=0;this.lastRegion=undefined;}
 paint(ctx,s){
  const pts=s.points;
  const start=this.lastX===0?0:Math.max(0,pts.length-2);this.lastX=pts.length;
  const first=pts[start].x,last=pts.at(-1).x;
  const x=Math.max(0,Math.floor(first-8)),right=Math.min(ctx.canvas.width,Math.ceil(last+8));
  ctx.fillStyle='#fff';ctx.fillRect(x,70,right-x,26);
  this.lastRegion={x,y:70,width:right-x,height:26};
 }
}
function applyGentleBlend(){}
function compositePaintStroke(){}
"""
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 page.add_script_tag(content=mix+'\n'+prefix+'\n'+worker)
 res=page.evaluate('''async()=>{
  const c=(w,h)=>{const a=document.createElement('canvas');a.width=w;a.height=h;return a};
  const base=c(360,180),bc=base.getContext('2d');
  bc.fillStyle='#ee2222';bc.fillRect(0,0,180,180);
  bc.fillStyle='#2222ee';bc.fillRect(180,0,180,180);
  const host=c(360,180),hc=host.getContext('2d');hc.drawImage(base,0,0);
  const bit=await createImageBitmap(base);
  await __worker.onmessage({data:{kind:'begin',token:10,width:360,height:180,base:bit}});
  let totalPixels=0,totalBytes=0,all=[];
  for(let i=0;i<44;i++){
   const points=Array.from({length:i+2},(_,j)=>({x:45+j*4,y:82,p:1}));
   const stroke={id:'v171',kind:'stroke',tool:'brush',nativeMixVersion:2,nativeMixAmount:.8,nativeMixRadius:1,color:'#00ff00',size:48,opacity:1,points};
   const final=i===43;
   await __worker.onmessage({data:{kind:'update',token:10,serial:i+1,stroke,final}});
   let reply=__replies.pop();if(reply.error)throw new Error(reply.error);
   totalPixels+=reply.region.width*reply.region.height;
   totalBytes+=reply.region.width*reply.region.height*4;
   const r=reply.region;hc.clearRect(r.x,r.y,r.width,r.height);hc.drawImage(reply.bitmap,r.x,r.y);reply.bitmap.close();
   all.push({x:r.x,w:r.width});
  }
  const values=[...hc.getImageData(180,80,1,1).data];
  const result=hc.getImageData(0,0,360,180).data,original=bc.getImageData(0,0,360,180).data;
  let changed=0,hash=2166136261;
  for(let k=0;k<result.length;k+=4){if(result[k]!==original[k]||result[k+1]!==original[k+1]||result[k+2]!==original[k+2])changed++;}
  for(const pixel of result)hash=Math.imul(hash^pixel,16777619)>>>0;
  return {frames:all,totalPixels,totalBytes,finalColor:values,changed,hash,firstWidth:all[0].w,midWidth:all[20].w,lastWidth:all.at(-1).w};
 }''')
 print({key:res[key] for key in ['totalPixels','totalBytes','finalColor','changed','hash','firstWidth','midWidth','lastWidth']})
 if not baseline: assert res['totalPixels'] < 160000, 'Still transmitting large cumulative areas'
 assert res['finalColor'][1]<100,'selected green color entered native mix'
 assert res['changed']>0,'native mix changed no colour'
 if not baseline: assert res['midWidth'] < res['lastWidth']*.4,'midstroke dirty region grew with entire stroke'
 print(('BASELINE v170' if baseline else 'PASS v173')+': isolated dirty cropping + final correction + native colour mixing in Chromium')
 b.close()
