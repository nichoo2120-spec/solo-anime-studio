"""Isolated Chromium canvas verification of the new v2 Mix output versus saved v1.
Does not claim to be a complete Studio/Wacom end-to-end test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
source=(Path(__file__).resolve().parent.parent/'offline/src/engine/nativeBrushMix.js').read_text().replace('export function applyNativeBrushMix','function applyNativeBrushMix')+'\nwindow.applyNativeBrushMix=applyNativeBrushMix;'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page()
 page.add_script_tag(content=source)
 result=page.evaluate('''() => {
  const canvas=(w=256,h=128)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const pix=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
  function scene(v,kind='full',strength=.85){
    const base=canvas(),bc=base.getContext('2d');
    bc.fillStyle='#e02020';bc.fillRect(0,0,128,128);
    bc.fillStyle='#2020e0';bc.fillRect(128,0,128,128);
    const mask=canvas(),mc=mask.getContext('2d');mc.fillStyle='#fff';
    if(kind==='dry')for(let y=38;y<90;y++){if(y%8<3)mc.fillRect(90,y,76,1);}
    else mc.fillRect(90,38,76,52);
    const before=pix(base,112,46),outside=pix(base,24,46);
    const s={nativeMixVersion:v,kind:'stroke',tool:'brush',color:'#00ff00',size:90,nativeMixAmount:strength,nativeMixRadius:.7,opacity:1};
    applyNativeBrushMix(bc,mask,s,0,0,{x:90,y:38,width:76,height:52});
    return {before,after:pix(base,112,46),edge:pix(base,122,46),hit:pix(base,112,42),gap:pix(base,112,44),outside:pix(base,24,46),outsideBefore:outside};
  }
  const old=scene(1),fresh=scene(2),dry=scene(2,'dry'),zero=scene(2,'full',0);
  return {old,fresh,dry,zero};
 }''')
 print(result)
 assert result['fresh']['after']!=result['fresh']['before'], 'v2 did not blend at a dry-side test pixel'
 assert result['fresh']['outside']==result['fresh']['outsideBefore'], 'v2 changed outside mask'
 assert result['dry']['gap']==result['dry']['before'], 'dry gaps changed'
 assert result['dry']['hit']!=result['dry']['before'], 'dry bristles did not blend where the mask was painted'
 assert result['zero']['after']==result['zero']['before'], 'zero Mix strength changed pixels'
 assert result['fresh']['after'][1]<100,'selected colour was added unexpectedly'
 assert result['old']['after'][3]==result['fresh']['after'][3]==255, 'alpha coverage changed'
 assert abs(result['fresh']['after'][0]-result['fresh']['before'][0])>abs(result['old']['after'][0]-result['old']['before'][0])*3,'v2 should visibly mix more than v1'
 print('PASS v173: visible pigment mixing, dry gap preservation, zero strength, no colour injection, old v1 untouched')
 browser.close()
