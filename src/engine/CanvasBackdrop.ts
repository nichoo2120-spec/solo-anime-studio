import type {View} from '../core/geometry';

/** Page decoration is independent of drawing operations. Reuse it until the
 * camera, document size or display pixels change, rather than rasterizing the
 * large blurred page shadow on every pointer frame. */
export class CanvasBackdrop{
 private canvas?:HTMLCanvasElement;private key?:number[];
 clear(){if(this.canvas)this.canvas.width=this.canvas.height=0;this.canvas=undefined;this.key=undefined;}
 paint(ctx:CanvasRenderingContext2D,width:number,height:number,dpr:number,view:View,documentWidth:number,documentHeight:number){
  const key=[ctx.canvas.width,ctx.canvas.height,width,height,dpr,view.x,view.y,view.rotation,view.zoom,documentWidth,documentHeight];
  if(!this.key||key.some((n,i)=>n!==this.key![i])){
   const canvas=this.canvas??=document.createElement('canvas');if(canvas.width!==ctx.canvas.width)canvas.width=ctx.canvas.width;if(canvas.height!==ctx.canvas.height)canvas.height=ctx.canvas.height;
   const bg=canvas.getContext('2d')!;bg.setTransform(dpr,0,0,dpr,0,0);bg.clearRect(0,0,width,height);bg.fillStyle='#20272c';bg.fillRect(0,0,width,height);
   bg.save();bg.translate(view.x,view.y);bg.rotate(view.rotation);bg.scale(view.zoom,view.zoom);bg.shadowColor='#0008';bg.shadowBlur=25/view.zoom;bg.fillStyle='#fff';bg.fillRect(0,0,documentWidth,documentHeight);bg.restore();this.key=key;
  }
  ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.drawImage(this.canvas!,0,0);ctx.restore();
 }
}
