from pathlib import Path
from playwright.sync_api import sync_playwright
src=(Path(__file__).resolve().parent.parent/'offline/src/engine/nativeBrushMix.js').read_text().replace('export function applyNativeBrushMix','function applyNativeBrushMix')+'\nwindow.applyNativeBrushMix=applyNativeBrushMix;'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page()
 page.add_script_tag(content=src)
 out=page.evaluate('''() => {
 const newCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const sample=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
 const makeBase=()=>{let c=newCanvas(240,110),x=c.getContext('2d');x.fillStyle='#ee2222';x.fillRect(0,0,120,110);x.fillStyle='#2222ee';x.fillRect(120,0,120,110);return c;};
 const makeMask=(dry)=>{const c=newCanvas(240,110),x=c.getContext('2d');x.fillStyle='#fff';for(let y=28;y<82;y++){if(!dry||y%6<2)x.fillRect(80,y,80,1);}return c;};
 function test(dry,strength,selected='#00ff00') {let b=makeBase(),m=makeMask(dry);const s={kind:'stroke',tool:'brush',nativeMixVersion:1,nativeMixAmount:strength,nativeMixRadius:.8,color:selected,size:90,opacity:1};const before=sample(b,119,42);let start=performance.now();for(let i=0;i<1;i++)applyNativeBrushMix(b.getContext('2d'),m,s,0,0,{x:80,y:28,width:80,height:54});const ms=performance.now()-start;return {before,after:sample(b,119,42),other:sample(b,119,44),edge:sample(b,20,42),alpha:sample(b,119,42)[3],time10ms:Math.round(ms*100)/100};}
 const wet=test(false,1),dry=test(true,1),zero=test(false,0),weak=test(false,.25);return {wet,dry,zero,weak};
}''')
 print(out)
 wet,dry,zero,weak=out['wet'],out['dry'],out['zero'],out['weak']
 assert wet['after']!=wet['before'],'wet mixing changed no colour'
 assert wet['edge']==[238,34,34,255], 'outside mask changed'
 assert dry['other']==dry['before'], 'dry gap not retained'
 assert zero['after']==zero['before'], 'zero mixes'
 assert wet['after'][3]==255,'alpha changed'
 assert wet['after'][1]<100, 'selected green introduced'
 assert sum(abs(a-b) for a,b in zip(weak['after'],weak['before']))<sum(abs(a-b) for a,b in zip(wet['after'],wet['before'])),'strength not monotone'
 print('PASS: colour mixing, dry texture gaps, 0 strength, source colour independence, alpha, intensity progression')
 b.close()
