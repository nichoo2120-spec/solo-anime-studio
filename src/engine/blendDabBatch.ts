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
  this.left=Math.min(this.left,x-r-4);this.top=Math.min(this.top,y-r-4);
  this.right=Math.max(this.right,x+r+4);this.bottom=Math.max(this.bottom,y+r+4);
 }

 run(prepare:(bounds:DabBounds)=>void,dab:(x:number,y:number,p:number,r:number,step:number,dx:number,dy:number,distance:number)=>void){
  if(!this.count)return;
  prepare({x:this.left,y:this.top,width:this.right-this.left,height:this.bottom-this.top});
  const data=this.data;
  for(let i=0;i<this.count;i+=8)dab(data[i],data[i+1],data[i+2],data[i+3],data[i+4],data[i+5],data[i+6],data[i+7]);
  this.count=0;
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

/** Precompute one axis of patch interpolation per column. The same values
 * serve every row and tile of the full-resolution deposit. */
export class BlendPatchColumns {
 private index=new Uint8Array(1024);
 private fraction=new Float32Array(1024);

 ensure(width:number){
  if(width>this.index.length){
   this.index=new Uint8Array(width);
   this.fraction=new Float32Array(width);
  }
 }

 prepare(left:number,right:number,x:number,inv:number,patch:number,nearest:boolean){
  for(let i=0;i<right-left;i++){
   const u=Math.max(0,Math.min(patch-1,((left+i+.5-x)*inv+1)*.5*patch-.5));
   const at=nearest?Math.round(u):Math.min(patch-2,Math.floor(u));
   this.index[i]=at;
   this.fraction[i]=nearest?0:u-at;
  }
  return this;
 }

 get indices(){return this.index;}
 get fractions(){return this.fraction;}
}
