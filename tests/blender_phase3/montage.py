import sys;from PIL import Image,ImageDraw
d=sys.argv[1];o=sys.argv[2];version=__import__('pathlib').Path(d).name
P=[('rb_mid',f'{version} Blender size 70, red->blue (stroke y=150, x180->720)'),('rb_s130',f'{version} Blender size 130'),('w_patch',f'{version} Blender size 70 dragging a red patch on white')]
ims=[Image.open(f'{d}/{n}__out.png').convert('RGB') for n,_ in P];W,H=ims[0].size
m=Image.new('RGB',(W,(H+24)*3),'white');g=ImageDraw.Draw(m)
for i,(im,(n,t)) in enumerate(zip(ims,P)):
    y=i*(H+24);g.text((6,y+6),t,fill='black');m.paste(im,(0,y+24));g.line([(430,y+24),(430,y+30)],fill='black');g.line([(720,y+24),(720,y+30)],fill='black')
m.save(o)
