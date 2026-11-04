"""Compose only actual engine PNGs. No synthetic painted marks or AI artwork."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops
import json
R=Path('test-output/dry-blend');O=R/'v148';O.mkdir(exist_ok=True)
def font(n):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
F=font(20);S=font(16);T=font(28)
def flat(path):
 im=Image.open(path).convert('RGBA');bg=Image.new('RGB',im.size,'white');bg.paste(im,mask=im.getchannel('A'));return bg
def fit(c,path,box,crop=True,bg='white'):
 im=flat(path)
 if crop:
  b=ImageChops.difference(im,Image.new('RGB',im.size,'white')).point(lambda x:255 if x>12 else 0).getbbox()
  if b:im=im.crop((max(0,b[0]-8),max(0,b[1]-8),min(im.width,b[2]+8),min(im.height,b[3]+8)))
 x,y,w,h=box;im.thumbnail((w-12,h-12),Image.Resampling.LANCZOS);c.paste(im,(x+(w-im.width)//2,y+(h-im.height)//2))
recipes=[('straight','slow'),('straight','fast'),('sine','slow'),('sine','fast')]
c=Image.new('RGB',(2000,1165),'#edf1f4');d=ImageDraw.Draw(c);d.rectangle((0,0,2000,80),fill='#172e40');d.text((22,22),'DRY BRUSH — REFERENCE / v0.5.147 / v0.5.148',font=T,fill='white')
for j,(shape,speed)in enumerate(recipes):d.text((275+j*425,96),shape.title()+' / '+speed,font=F,fill='#172e40')
rows=[('Reference','Original ink samples',None,None),('v0.5.147','Dry Ink Bristle','before','dry-ink-bristle'),('v0.5.147','Dry Paint','before','dry-paint'),('v0.5.148','Dry Ink Brush','after','dry-ink-bristle'),('v0.5.148','Dry Paint Brush','after','dry-paint')]
for i,(v,name,tag,preset)in enumerate(rows):
 y=135+i*194;d.text((20,y+55),v,font=F,fill='#172e40');d.text((20,y+86),name,font=S,fill='#344e5e')
 for j,(shape,speed)in enumerate(recipes):
  x=265+j*425;d.rectangle((x,y,x+415,y+182),fill='white');path=R/f'reference/aligned-{j+1}.png' if tag is None else O/tag/f'{preset}_0_130_{shape}_{speed}.png';fit(c,path,(x,y,415,182))
d.text((20,1120),'Actual engine renders, size 130, same ID/path/size; each version uses its preset defaults. Reference cells are different original marks; viewing scale is normalized.',font=S,fill='#344e5e');c.save(O/'v148-reference-comparison.png')
manifest=json.loads((O/'manifest.json').read_text())['cases']
for preset in ['dry-ink-bristle','dry-paint']:
 rows=[r for r in manifest if r['preset']==preset and r['size']==130];c=Image.new('RGB',(1480,140+len(rows)*158),'#edf1f4');d=ImageDraw.Draw(c);d.text((20,20),preset.upper()+' — PRESSURE / MOTION / SIZE',font=T,fill='#172e40')
 for col,size in enumerate([38,70,130]):d.text((260+col*400,82),f'{size} px',font=F,fill='#172e40')
 for i,r in enumerate(rows):
  y=126+i*158;d.text((18,y+36),r['shape']+' / '+r['speed'],font=S,fill='#172e40');d.text((18,y+63),r['pressure']+' pressure',font=S,fill='#344e5e')
  for j,size in enumerate([38,70,130]):
   q=next(q for q in manifest if q['preset']==preset and q['shape']==r['shape']and q['speed']==r['speed']and q['pressure']==r['pressure']and q['size']==size);x=245+j*405;d.rectangle((x,y,x+395,y+145),fill='white');fit(c,O/q['raw'],(x,y,395,145),crop=False)
 c.save(O/(preset+'-motion-sizes.png'))
# Every identity, rather than selecting the best-looking seed.
c=Image.new('RGB',(1800,1750),'#edf1f4');d=ImageDraw.Draw(c);d.text((20,18),'TEN IDENTITIES — STRAIGHT SLOW / SINE FAST, SIZE 130',font=T,fill='#172e40')
for i in range(10):
 y=76+i*165;d.text((14,y+55),f'{i:02}',font=F,fill='#172e40')
 for j,(preset,shape,speed)in enumerate([('dry-ink-bristle','straight','slow'),('dry-ink-bristle','sine','fast'),('dry-paint','straight','slow'),('dry-paint','sine','fast')]):
  x=65+j*430;d.rectangle((x,y,x+420,y+155),fill='white');fit(c,O/'after'/f'{preset}_{i}_130_{shape}_{speed}.png',(x,y,420,155))
c.save(O/'v148-ten-identities.png');print('Reference comparison, two motion/pressure/size sheets and all-ten-ID sheet created from actual engine PNGs.')
