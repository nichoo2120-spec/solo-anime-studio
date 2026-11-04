/** A small closing of the coverage field fuses sub-brush notches between
 * neighboring sweeps. Max/min operations preserve loaded interiors and edge
 * contrast; this does not blur the painted surface or its native paper grain. */
export function joinWaterFront(data:Uint8ClampedArray,w:number,h:number,r:number,a:Float32Array,b:Float32Array){
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)v=Math.max(v,data[(y*w+k)*4+3]);a[y*w+x]=v;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)v=Math.max(v,a[k*w+x]);b[y*w+x]=v;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=255;for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++)v=Math.min(v,b[y*w+k]);a[y*w+x]=v;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=255;for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++)v=Math.min(v,a[k*w+x]);data[(y*w+x)*4+3]=v;}
}
