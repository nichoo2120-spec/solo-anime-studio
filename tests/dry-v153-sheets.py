from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'test-output/v153'
def font(size,bold=False):
 for path in [Path('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold'if bold else'')+'.ttf'),Path('C:/Windows/Fonts/'+('arialbd.ttf'if bold else'arial.ttf'))]:
  if path.exists():return ImageFont.truetype(str(path),size)
 return ImageFont.load_default()
FONT=font(16)
BOLD=font(20,True)
def cell(sheet,path,box):
 im=Image.open(path).convert('RGBA');bounds=im.getbbox()
 if not bounds:return
 im=im.crop((max(0,bounds[0]-6),max(0,bounds[1]-8),min(im.width,bounds[2]+6),min(im.height,bounds[3]+8)))
 im.thumbnail((box[2]-12,box[3]-12),Image.Resampling.LANCZOS)
 bg=Image.new('RGB',im.size,'white');bg.paste(im,mask=im.getchannel('A'))
 sheet.paste(bg,(box[0]+6,box[1]+(box[3]-im.height)//2))
def row(sheet,y,title,files,labels=None):
 d=ImageDraw.Draw(sheet);d.text((8,y+5),title,fill='#121212',font=BOLD)
 for c,path in enumerate(files):
  d.rectangle((c*425,y+35,c*425+422,y+205),fill='white');cell(sheet,path,(c*425,y+35,422,170))
  if labels:d.text((c*425+8,y+207),labels[c],fill='#444444',font=FONT)
# Reference is a supplied photograph; output rows below are real LayerRenderer pixels.
ref=Image.open(ROOT/'tests/reference/dry-reference-v153.png').convert('RGB').crop((0,0,1700,200))
sheet=Image.new('RGB',(1700,1770),'#efefef');sheet.paste(ref,(0,0))
for j,(tag,preset,label)in enumerate([('before','dry-ink-bristle','v0.5.152 Dry Ink'),('after','dry-ink-bristle','v0.5.153 Dry Ink'),('before','dry-paint','v0.5.152 Dry Paint'),('after','dry-paint','v0.5.153 Dry Paint')]):
 row(sheet,210+j*225,label,[OUT/tag/f'{preset}_{i}_130_{shape}_{speed}.png'for i,shape,speed in [(0,'straight','slow'),(1,'straight','fast'),(0,'sine','slow'),(1,'sine','fast')]],['Straight / slow, seed 00','Straight / fast, seed 01','Curve / slow, seed 00','Curve / fast, seed 01'])
row(sheet,1110,'v0.5.153 pressure response, size 130',[OUT/'exercises'/f'exercise-{p}-130-{pressure}-slow.png'for p,pressure in [('dry-ink-bristle','light'),('dry-ink-bristle','heavy'),('dry-paint','light'),('dry-paint','heavy')]],['Ink / light pressure','Ink / heavy pressure','Paint / light pressure','Paint / heavy pressure'])
row(sheet,1335,'v0.5.153 small brushes',[OUT/'after'/f'{p}_0_{size}_straight_slow.png'for p,size in [('dry-ink-bristle',38),('dry-ink-bristle',70),('dry-paint',38),('dry-paint',70)]],['Ink / 38 px','Ink / 70 px','Paint / 38 px','Paint / 70 px'])
d=ImageDraw.Draw(sheet);d.text((10,1580),'Actual rendered strokes. Same paths and IDs before/after. Reference is a visual target, not a generated brush asset.',fill='#333333',font=FONT)
d.text((10,1610),'The model remains procedural; remaining differences are documented in UPDATE_v0.5.153.md.',fill='#333333',font=FONT)
sheet.crop((0,0,1700,1650)).save(OUT/'Dry_Brush_v152_vs_v153.png')
allids=Image.new('RGB',(1700,10*175+65),'#efefef');d=ImageDraw.Draw(allids);d.text((10,8),'v0.5.153 — ten independent stroke IDs, size 130, slow speed',fill='black',font=BOLD)
for i in range(10):
 y=45+i*175;d.text((5,y),'ID '+str(i).zfill(2),fill='black',font=FONT)
 for c,(p,shape)in enumerate([('dry-ink-bristle','straight'),('dry-paint','straight'),('dry-ink-bristle','sine'),('dry-paint','sine')]):
  d.rectangle((c*425,y+25,c*425+422,y+172),fill='white');cell(allids,OUT/'after'/f'{p}_{i}_130_{shape}_slow.png',(c*425,y+25,422,147))
allids.save(OUT/'ten-stroke-identities.png')
stress=Image.new('RGB',(1700,4*240+45),'#efefef')
for j,(name,title)in enumerate([('filled-overlaps','Broad areas and overlapping passes'),('maximum','Maximum brush size (600 px)'),('hook','Hook lift'),('circle','Circular path')]):
 d=ImageDraw.Draw(stress);y=40+j*240;d.text((10,y),title,fill='black',font=BOLD)
 for c,p in enumerate(['dry-ink-bristle','dry-paint']):
  d.rectangle((c*850,y+30,c*850+844,y+235),fill='white');cell(stress,OUT/'exercises'/f'{p}-{name}.png',(c*850,y+30,844,205))
stress.save(OUT/'areas-curves-maximum.png')
print('Created before/after, ten-identity and pressure/area/maximum comparison sheets.')
