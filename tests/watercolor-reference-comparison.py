from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path.cwd()
ref=Image.open(root/'WATERCOLOR_REFERENCE.png').convert('RGB')
render=Image.open(root/'WATERCOLOR_FIVE_BRUSHES.png').convert('RGB')
out=Image.new('RGB',(2200,1550),'white');draw=ImageDraw.Draw(out)
def font(size,bold=False):
    name='DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+name,size)
    except OSError:return ImageFont.load_default(size=size)
draw.text((25,20),'Your reference',font=font(31,True),fill='#193948')
draw.text((1140,20),'Actual application renderer',font=font(31,True),fill='#193948')
bounds=[(60,265),(320,550),(590,835),(920,1160),(1220,1440)]
names=['Smooth Watercolor','Rough Watercolor','Soft Wet Watercolor','Flat Watercolor','Gradient Watercolor']
for i,((y0,y1),name) in enumerate(zip(bounds,names)):
    top=90+i*285;draw.text((25,top),str(i+1)+'. '+name,font=font(24),fill='#193948')
    a=ref.crop((25,y0,ref.width-30,y1));b=render.crop((25,170+i*320,1080,345+i*320))
    for image,x in [(a,20),(b,1120)]:
        image.thumbnail((1060,230));out.paste(image,(x+(1060-image.width)//2,top+40+(230-image.height)//2))
out.save(root/'WATERCOLOR_REFERENCE_COMPARISON.png')
