export type DabBounds={x:number;y:number;width:number;height:number};

/** Store scalar dab parameters in a reusable arena, then prepare the canvas
 * region before entering either renderer's dab loop. */
export class BlendDabBatch {
 private data=new Float64Array(64*8);
 private count=0;
 private left=Infinity;
 private top=Infinity;
 private right=-Infinity;
 private bottom=-Infinity;
 private maxRadius=0;

 add(x:number,y:number,p:number,r:number,step:number,dx:number,dy:number,distance:number){
  const i=this.count;
  if(i===this.data.length){
   const grown=new Float64Array(i*2);
   grown.set(this.data);
   this.data=grown;
  }
  const data=this.data;
  data[i]=x;data[i+1]=y;data[i+2]=p;data[i+3]=r;data[i+4]=step;
  data[i+5]=dx;data[i+6]=dy;data[i+7]=distance;
  this.count+=8;
  this.maxRadius=Math.max(this.maxRadius,r);
  this.left=Math.min(this.left,x-r-4);this.top=Math.min(this.top,y-r-4);
  this.right=Math.max(this.right,x+r+4);this.bottom=Math.max(this.bottom,y+r+4);
 }

 run(prepare:(bounds:DabBounds,diameter:number)=>void,dab:(x:number,y:number,p:number,r:number,step:number,dx:number,dy:number,distance:number)=>void){
  if(!this.count)return;
  prepare({x:this.left,y:this.top,width:this.right-this.left,height:this.bottom-this.top},Math.ceil(this.maxRadius*2)+2);
  const data=this.data;
  for(let i=0;i<this.count;i+=8)dab(data[i],data[i+1],data[i+2],data[i+3],data[i+4],data[i+5],data[i+6],data[i+7]);
  this.count=0;
  this.maxRadius=0;
  this.left=this.top=Infinity;
  this.right=this.bottom=-Infinity;
 }
}

/** Increase pickup interval mildly on large brushes. Deposit opacity is
 * integrated over distance by the engines' existing step compensation. */
export function largeBlendSpacing(size:number,spacing:number){
 const factor=size>200?4.5:2;
 return Math.max(spacing,Math.min(.36,spacing*factor));
}

/** Upscale pigment color from a low-resolution grid while leaving alpha,
 * the paper texture, and the actual brush footprint at device resolution. */
export class BlendPatchRaster {
 private indices:Uint8Array;
 private fractions:Float32Array;
 pixels:Float32Array;
 stride=0;
 readonly shift:number;

 constructor(size:number){
  this.shift=size>200?2:1;
  const side=Math.ceil((size*1.35+12)/(1<<this.shift));
  this.indices=new Uint8Array(side);
  this.fractions=new Float32Array(side);
  this.pixels=new Float32Array(side*side*4);
 }

 ensure(width:number,height:number){
  const cols=Math.ceil(width/(1<<this.shift)),rows=Math.ceil(height/(1<<this.shift));
  if(cols>this.indices.length){
   this.indices=new Uint8Array(cols);
   this.fractions=new Float32Array(cols);
  }
  if(cols*rows*4>this.pixels.length)this.pixels=new Float32Array(cols*rows*4);
 }

 prepare(target:Float32Array,left:number,top:number,right:number,bottom:number,x:number,y:number,inv:number,patch:number,nearest:boolean){
  const scale=1<<this.shift,cols=Math.ceil((right-left)/scale),rows=Math.ceil((bottom-top)/scale);
  this.stride=cols*4;
  for(let i=0;i<cols;i++){
   const u=Math.max(0,Math.min(patch-1,((left+i*scale+scale*.5-x)*inv+1)*.5*patch-.5));
   const at=nearest?Math.round(u):Math.min(patch-2,Math.floor(u));
   this.indices[i]=at;
   this.fractions[i]=nearest?0:u-at;
  }
  for(let j=0;j<rows;j++){
   const v=Math.max(0,Math.min(patch-1,((top+j*scale+scale*.5-y)*inv+1)*.5*patch-.5));
   const row=nearest?Math.round(v):Math.min(patch-2,Math.floor(v));
   const fv=nearest?0:v-row;
   for(let i=0;i<cols;i++){
    const k=(row*patch+this.indices[i])*4,at=(j*cols+i)*4;
    if(nearest){
     for(let c=0;c<4;c++)this.pixels[at+c]=target[k+c];
    }else{
     const fu=this.fractions[i],next=k+patch*4;
     for(let c=0;c<4;c++)this.pixels[at+c]=(target[k+c]*(1-fu)+target[k+4+c]*fu)*(1-fv)+(target[next+c]*(1-fu)+target[next+4+c]*fu)*fv;
    }
   }
  }
  return this;
 }
}
