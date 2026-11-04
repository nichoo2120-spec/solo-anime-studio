from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1];out=root/'test-output/dry-blend';metrics=json.loads((out/'metrics.json').read_text());font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(n):return ImageFont.truetype(font_path,n)
def canvas(h,title):
 c=Image.new('RGB',(1840,h),'#f4f5f3');d=ImageDraw.Draw(c);d.text((24,18),title,font=font(27),fill='#183b49');return c,d
def panel(c,d,name,x,y,label):
 d.text((x+10,y),label,font=font(18),fill='#183b49');c.paste(Image.open(out/name).convert('RGB'),(x,y+30))
selections=[('straight_slow_none_130','Straight — slow'),('straight_fast_none_130','Straight — fast'),('sine_slow_none_130','Sine'),('sine_slow_bell_130','Bell pressure'),('straight_slow_light_130','Light pressure'),('straight_slow_heavy_130','Heavy pressure'),('zigzag_slow_none_130','Zigzag'),('short_slow_none_130','Short — 80 px'),('long_slow_none_130','Long — 780 px; right clipping recorded')]
c,d=canvas(80+len(selections)*300,'v0.5.146 actual baseline — Classic Dry / Textured bristle')
for row,(name,label)in enumerate(selections):
 for col,preset in enumerate(['dry','color-texture']):panel(c,d,'white/'+preset+'_'+name+'.png',20+col*910,65+row*300,label+' · '+preset)
c.save(out/'dry_cases.png')
c,d=canvas(980,'Actual black strokes on white, tan and blue paper')
for row,background in enumerate(['white','tan','blue']):
 for col,preset in enumerate(['dry','color-texture']):panel(c,d,background+'/'+preset+'_sine_slow_none_130.png',20+col*910,65+row*300,background+' · '+preset)
c.save(out/'background_cases.png')
c,d=canvas(80+4*310,'Blender baseline — original paint / after drag; source color is not retained far enough')
for row,name in enumerate(['slow','light','curve','right-to-left']):
 m=next(v for v in metrics['blender']if v['name']=='blender_'+name)['metrics'];panel(c,d,'blender/'+name+'-before.png',20,65+row*310,name+' · before');panel(c,d,'blender/'+name+'.png',930,65+row*310,f"after · smear {m['smearLength']} px · carried color at +40: {m['carriedShare']['40']:.1%}")
c.save(out/'blender_cases.png')
c,d=canvas(1050,'Phase 1 — measured baseline only; brush behavior unchanged')
panel(c,d,'white/dry_straight_slow_none_130.png',20,65,'Classic Dry Brush — actual v0.5.146')
panel(c,d,'white/color-texture_straight_slow_none_130.png',930,65,'Textured Paint / Flat bristle — actual v0.5.146')
panel(c,d,'white/dry_sine_slow_bell_130.png',20,380,'Classic Dry Brush — bell pressure')
panel(c,d,'white/color-texture_sine_slow_bell_130.png',930,380,'Textured Paint — bell pressure')
panel(c,d,'blender/slow-before.png',20,695,'Blender — before')
panel(c,d,'blender/slow.png',930,695,'Blender — after; 100 px smear, 23% carried color at +40 px')
d.text((24,1008),'Reference/prototype files were not supplied. No reference-match or repair claim.',font=font(18),fill='#4c5a61');c.save(out/'Phase1_Dry_Blend_Baseline.png')
print('Four actual-render comparison sheets written')
