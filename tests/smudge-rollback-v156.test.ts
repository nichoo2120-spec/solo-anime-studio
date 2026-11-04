import {afterEach,describe,expect,it,vi} from 'vitest';
import {SmudgeRollback} from '../src/engine/SmudgeRollback';
class Canvas{
 private w=0;private h=0;pixels=new Uint8Array(0);readonly ctx=new Context(this);
 set width(n:number){this.w=n;this.pixels=new Uint8Array(this.w*this.h);}get width(){return this.w;}
 set height(n:number){this.h=n;this.pixels=new Uint8Array(this.w*this.h);}get height(){return this.h;}
 getContext(){return this.ctx;}
}
class Context{
 globalAlpha=1;globalCompositeOperation='source-over';constructor(readonly canvas:Canvas){}
 save(){}restore(){}resetTransform(){}
 clearRect(x:number,y:number,w:number,h:number){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.canvas.pixels[j*this.canvas.width+i]=0;}
 drawImage(source:Canvas,...a:number[]){const [sx,sy,w,h,dx,dy]=a.length===2?[0,0,source.width,source.height,...a]:a;for(let j=0;j<h;j++)for(let i=0;i<w;i++)this.canvas.pixels[(dy+j)*this.canvas.width+dx+i]=source.pixels[(sy+j)*source.width+sx+i];}
 getImageData(x:number,y:number,width:number,height:number){const data=new Uint8Array(width*height);for(let j=0;j<height;j++)for(let i=0;i<width;i++)data[j*width+i]=this.canvas.pixels[(y+j)*this.canvas.width+x+i];return{width,height,data};}
 putImageData(image:{width:number;height:number;data:Uint8Array},x:number,y:number){for(let j=0;j<image.height;j++)for(let i=0;i<image.width;i++)this.canvas.pixels[(y+j)*this.canvas.width+x+i]=image.data[j*image.width+i];}
}
const setup=()=>{const created:Canvas[]=[];vi.stubGlobal('document',{createElement:()=>{const c=new Canvas();created.push(c);return c;}});const source=new Canvas();source.width=8;source.height=4;source.pixels.fill(1);return{source,created,html:source as unknown as HTMLCanvasElement,ctx:source.ctx as unknown as CanvasRenderingContext2D};};
afterEach(()=>vi.unstubAllGlobals());
describe('smudge update rollback',()=>{
 it('reverses intersecting contact patches in order and restores the matching reservoir',()=>{
  const {source,html,ctx}=setup(),r=new SmudgeRollback<{load:number}>();
  r.remember(html,0,{load:1},{x:1,y:0,width:4,height:3});source.pixels[2]=20;const atFour=source.pixels.slice();
  r.remember(html,4,{load:2},{x:2,y:0,width:4,height:3});source.pixels[2]=40;source.pixels[4]=40;
  r.remember(html,8,{load:3},{x:3,y:0,width:4,height:3});source.pixels[4]=80;
  expect(r.restore(ctx,5)).toEqual({count:4,state:{load:2}});expect(source.pixels).toEqual(atFour);expect(r.status().entries).toBe(1);
  expect(r.restore(ctx,0)).toEqual({count:0,state:{load:1}});expect([...source.pixels]).toEqual(Array(32).fill(1));expect(r.status()).toEqual({entries:0,bytes:0});
 });
 it('evicts bounded patches without claiming a missing older checkpoint',()=>{
  const {html,ctx,created}=setup(),r=new SmudgeRollback<number>(16,2);
  r.remember(html,0,10,{x:0,y:0,width:2,height:2});r.remember(html,4,20,{x:2,y:0,width:2,height:2});
  expect(r.status()).toEqual({entries:1,bytes:16});expect(created).toHaveLength(0);expect(r.restore(ctx,3)).toBeUndefined();expect(r.restore(ctx,4)?.state).toBe(20);
 });
 it('discards the chain when an oversized update would otherwise leave a gap',()=>{
  const {html,ctx}=setup(),r=new SmudgeRollback<number>(16);r.remember(html,0,1,{x:0,y:0,width:2,height:2});r.remember(html,4,2,{x:0,y:0,width:8,height:4});expect(r.status()).toEqual({entries:0,bytes:0});expect(r.restore(ctx,0)).toBeUndefined();
 });
 it('bounds nonpainting checkpoints and releases all retained canvases',()=>{
  const {html,created}=setup(),r=new SmudgeRollback<number>(1024,2);r.remember(html,0,1,{x:0,y:0,width:2,height:2});r.remember(html,1,2);r.remember(html,2,3);expect(r.status()).toEqual({entries:2,bytes:0});expect(created).toHaveLength(0);r.clear();expect(r.status()).toEqual({entries:0,bytes:0});
 });
});
