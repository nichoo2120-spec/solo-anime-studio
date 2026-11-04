"""Compose actual engine renders; never substitute painted/generated artwork."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont,ImageChops
ROOT=Path('test-output/dry-blend');NEW=ROOT/'v147'
def font(n):
 for name in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','DejaVuSans.ttf','arial.ttf']:
  try:return ImageFont.truetype(name,n)
  except OSError:pass
 try:return ImageFont.load_default(size=n)
 except TypeError:return ImageFont.load_default()
F=font(23);SM=font(17);TITLE=font(31)
old=json.loads((ROOT/'manifest.json').read_text())['cases'];new=json.loads((NEW/'manifest.json').read_text())['cases']
def find(rows,preset,shape,speed='slow',pressure='none',size=130):return next(r for r in rows if r['preset']==preset and r['shape']==shape and r['speed']==speed and r['pressure']==pressure and r['size']==size)
def flatten(im,bg='white'):
 a=Image.new('RGB',im.size,bg);a.paste(im,mask=im.getchannel('A')) if im.mode=='RGBA'else a.paste(im.convert('RGB'));return a
def fit(canvas,path,box,bg='white',crop=False):
 im=flatten(Image.open(path),bg)
 if crop:
  d=ImageChops.difference(im,Image.new('RGB',im.size,bg));b=d.point(lambda x:255 if x>12 else 0).getbbox()
  if b:im=im.crop(b)
 x,y,w,h=box;im.thumbnail((w-18,h-14),Image.Resampling.LANCZOS);canvas.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2))
recipes=[('straight','slow','none'),('straight','fast','none'),('sine','slow','none'),('sine','slow','bell')]
labels=['Straight / slow','Straight / fast','Sine / slow','Bell pressure']
canvas=Image.new('RGB',(2000,1155),'#eef1f4');d=ImageDraw.Draw(canvas);d.rectangle((0,0,2000,83),fill='#182b3b');d.text((24,21),'DRY BRISTLE — ACTUAL RENDER COMPARISON',font=TITLE,fill='white');d.text((260,98),'Reference: four original marks. Application rows: the same saved fixture paths at size 130.',font=SM,fill='#354753')
for col,name in enumerate(labels):d.text((260+col*430,128),name,font=F,fill='#182b3b')
rowlabels=[('REFERENCE','Provided image'),('v0.5.146','Dry Brush'),('v0.5.146','Textured Paint'),('v0.5.147','Dry Ink Bristle'),('v0.5.147','Dry Paint')]
for row,(version,name)in enumerate(rowlabels):
 y=170+row*184;d.text((24,y+56),version,font=SM,fill='#627581');d.text((24,y+85),name,font=F,fill='#142c3f')
 for col,(shape,speed,pressure)in enumerate(recipes):
  x=250+col*430;d.rectangle((x,y,x+420,y+172),fill='white')
  if row==0:path=ROOT/f'reference/aligned-{col+1}.png'
  else:
   rows,base,preset=(old,ROOT,'dry'if row==1 else 'color-texture')if row<3 else(new,NEW,'dry-ink-bristle'if row==3 else'dry-paint');r=find(rows,preset,shape,speed,pressure);path=base/r['raw']
  fit(canvas,path,(x,y,420,172),crop=True)
d.text((24,1111),'Real engine pixels. Reference orientation/scale normalized for viewing. Cells fitted proportionally. Blender unchanged; Phase 3 not started.',font=SM,fill='#354753');canvas.save(ROOT/'compare_vs_reference.png')
for preset in ['dry-ink-bristle','dry-paint']:
 rows=[r for r in new if r['preset']==preset and r['size']==130];c=Image.new('RGB',(1480,140+len(rows)*158),'#eef1f4');d=ImageDraw.Draw(c);d.text((22,20),preset.upper()+' — SIZE / PRESSURE / MOTION',font=TITLE,fill='#182b3b')
 for col,size in enumerate([38,70,130]):d.text((250+col*400,82),f'{size} px',font=F,fill='#182b3b')
 for i,r in enumerate(rows):
  y=126+i*158;d.text((18,y+36),r['shape']+' / '+r['speed'],font=SM,fill='#182b3b');d.text((18,y+63),r['pressure']+' pressure',font=SM,fill='#354753')
  for j,size in enumerate([38,70,130]):
   p=find(new,preset,r['shape'],r['speed'],r['pressure'],size);x=240+j*405;d.rectangle((x,y,x+395,y+145),fill='white');fit(c,NEW/p['raw'],(x,y,395,145))
 c.save(ROOT/(preset+'-cases.png'))
c=Image.new('RGB',(1480,810),'#eef1f4');d=ImageDraw.Draw(c);d.text((22,18),'ACTUAL TRANSPARENCY — WHITE / TAN / BLUE',font=TITLE,fill='#182b3b')
for i,(preset,shape,pressure)in enumerate([('dry-ink-bristle','straight','none'),('dry-ink-bristle','sine','bell'),('dry-paint','straight','none'),('dry-paint','sine','bell')]):
 y=82+i*176;d.text((18,y+30),preset.replace('dry-',''),font=SM,fill='#182b3b');d.text((18,y+56),shape+' / '+pressure,font=SM,fill='#354753');r=find(new,preset,shape,'slow',pressure)
 for j,bg in enumerate(['white','tan','blue']):fit(c,NEW/r['raw'].replace('-raw.png','-'+bg+'.png'),(240+j*405,y,395,164))
c.save(ROOT/'v147-backgrounds.png');print('Wrote comparison, two case sheets and background sheet from real PNGs.')
