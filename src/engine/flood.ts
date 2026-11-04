export function floodFill(data:Uint8ClampedArray,width:number,height:number,x:number,y:number,color:number[],tolerance:number){
 const output=new Uint8ClampedArray(data.length),seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
 x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return {output,touchesEdge:false,count:0};
 const start=y*width+x,target=Array.from(data.slice(start*4,start*4+4));let head=0,tail=1,count=0,touchesEdge=false;queue[0]=start;seen[start]=1;
 const matches=(i:number)=>{const j=i*4;if(target[3]===0&&data[j+3]===0)return true;return Math.max(Math.abs(data[j]-target[0]),Math.abs(data[j+1]-target[1]),Math.abs(data[j+2]-target[2]),Math.abs(data[j+3]-target[3]))<=tolerance;};
 while(head<tail){const i=queue[head++];if(!matches(i))continue;const px=i%width,py=Math.floor(i/width);output.set(color,i*4);count++;if(px===0||py===0||px===width-1||py===height-1)touchesEdge=true;
  const visit=(n:number)=>{if(!seen[n]){seen[n]=1;queue[tail++]=n;}};
  if(px>0)visit(i-1);if(px<width-1)visit(i+1);if(py>0)visit(i-width);if(py<height-1)visit(i+width);
 }
 return {output,touchesEdge,count};
}
