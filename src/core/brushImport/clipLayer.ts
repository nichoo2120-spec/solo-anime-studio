/* The C2F layout and SQLite overflow traversal are adapted from
 * https://github.com/sandyseacastle/brush-converters/blob/main/lib/csp/c2f.js
 *
 * MIT License
 *
 * Copyright (c) 2026 Javad Hamidi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {unzlibSync} from 'fflate';

const pageSize=4096,tile=256,tileArea=tile*tile;
const utf8=new TextDecoder(),utf16=new TextDecoder('utf-16be');
const view=(data:Uint8Array)=>new DataView(data.buffer,data.byteOffset,data.byteLength);
const magic=[137,67,50,70,13,10,26,10];
const tileMarker='BlockDataBeginChunk';
const readCode=(data:Uint8Array,start:number,end:number)=>utf8.decode(data.subarray(start,end));

function layerDatabase(source:Uint8Array){
 if(!magic.every((value,i)=>value===source[i]))throw Error('Invalid Clip Studio layer.');
 const data=new Uint8Array(source.length),v=view(source);
 let size=0;
 for(let offset=8;offset+12<=source.length;){
  const length=v.getUint32(offset,true),start=offset+8,end=start+length;
  if(end+4>source.length)throw Error('Truncated Clip Studio layer.');
  if(length>=2&&readCode(source,offset+4,start)==='dATA'){
   if(source[start]===0){data.set(source.subarray(start+2,end),size);size+=length-2;}
   else if(length>=10)size+=length-10; // Ignore the private header. Image pages are plaintext.
  }
  offset=end+4;
 }
 return data.subarray(0,size);
}
function sqliteVarint(data:Uint8Array,offset:number):[number,number]{
 let value=0;
 for(let i=0;i<9;i++){
  const next=data[offset++];if(next===undefined)break;
  if(i===8)return [value*256+next,offset];
  value=value*128+(next&127);
  if(next<128)return [value,offset];
 }
 throw Error('Invalid SQLite number.');
}
function payload(database:Uint8Array,page:Uint8Array,start:number){
 const [bytes,row]=sqliteVarint(page,start),[,offset]=sqliteVarint(page,row);
 if(!Number.isSafeInteger(bytes)||bytes>Math.min(database.length,32*1024*1024))throw Error('Clip Studio layer record too large.');
 const max=pageSize-35,min=Math.floor((pageSize-12)*32/255)-23;
 let local=bytes<=max?bytes:min+(bytes-min)%(pageSize-4);
 if(local>max)local=min;
 if(offset+local>page.length)throw Error('Truncated SQLite cell.');
 if(local===bytes)return page.subarray(offset,offset+local);
 const result=new Uint8Array(bytes);
 result.set(page.subarray(offset,offset+local));
 const db=view(database),seen=new Set<number>();
 let next=view(page).getUint32(offset+local),filled=local;
 while(next&&filled<bytes&&!seen.has(next)&&next*pageSize<=database.length){
  seen.add(next);
  const at=(next-1)*pageSize;
  const length=Math.min(pageSize-4,bytes-filled);
  result.set(database.subarray(at+4,at+4+length),filled);filled+=length;
  next=db.getUint32(at);
 }
 if(filled!==bytes)throw Error('Truncated SQLite overflow page.');
 return result;
}
function recordBlobs(data:Uint8Array){
 const [header,first]=sqliteVarint(data,0);
 if(header>data.length||header<first||header>4096)throw Error('Invalid SQLite record header.');
 const result:Uint8Array[]=[];
 let cursor=header;
 for(let field=first;field<header;){
  const [type,next]=sqliteVarint(data,field);field=next;
  const length=type>=12?Math.floor((type-12)/2):([0,1,2,3,4,6,8,8,0,0][type]??0);
  if(!Number.isSafeInteger(length)||cursor+length>data.length)throw Error('Truncated SQLite record.');
  if(type>=12&&type%2===0)result.push(data.subarray(cursor,cursor+length));
  cursor+=length;
 }
 return result;
}
type LayerPixels={width:number;height:number;alpha:Uint8Array;tone:Uint8Array;blocks:number};
function imageLayer(attr:Uint8Array,tiles:Uint8Array):LayerPixels|undefined{
 if(attr.length<54||utf16.decode(attr.subarray(20,38))!=='Parameter')return;
 const a=view(attr),b=view(tiles);
 const width=a.getUint32(38),height=a.getUint32(42),across=a.getUint32(46),down=a.getUint32(50);
 if(!width||!height||width*height>16000000||across!==Math.ceil(width/tile)||down!==Math.ceil(height/tile))return;
 const alpha=new Uint8Array(width*height),tone=new Uint8Array(width*height);
 let blocks=0;
 for(let start=0;start+66<=tiles.length;){
  const length=b.getUint32(start),end=start+length,info=start+8+tileMarker.length*2;
  if(end<=info+20||end>tiles.length||b.getUint32(start+4)!==tileMarker.length||utf16.decode(tiles.subarray(start+8,info))!==tileMarker)break;
  const index=b.getUint32(info),outputSize=b.getUint32(info+4),filled=b.getUint32(info+16);
  if(filled&&index<across*down&&info+28<=end&&[tileArea/4,tileArea,tileArea*2,tileArea*5].includes(outputSize)){
   const inputSize=b.getUint32(info+24,true);
   if(info+28+inputSize<=end){
    const raw=unzlibSync(tiles.subarray(info+28,info+28+inputSize),{out:new Uint8Array(outputSize)});
    const x=index%across*tile,y=Math.floor(index/across)*tile;
    for(let row=0;row<Math.min(tile,height-y);row++)for(let col=0;col<Math.min(tile,width-x);col++){
     const p=row*tile+col,d=(y+row)*width+x+col;
     if(outputSize===tileArea/4){
      const byte=p>>>3,shift=7-(p&7);alpha[d]=(raw[byte]>>shift&1)*255;tone[d]=(raw[tileArea/8+byte]>>shift&1)*255;
     }else{
      alpha[d]=raw[p];
      if(outputSize===tileArea*2)tone[d]=raw[tileArea+p];
      if(outputSize===tileArea*5){const color=tileArea+p*4;tone[d]=Math.round(.2126*raw[color+2]+.7152*raw[color+1]+.0722*raw[color]);}
     }
    }
    blocks++;
   }
  }
  start=end;
 }
 return blocks?{width,height,alpha,tone,blocks}:undefined;
}
export function decodeClipLayer(source:Uint8Array):LayerPixels|undefined{
 const db=layerDatabase(source);
 let best:LayerPixels|undefined;
 for(let offset=pageSize;offset+pageSize<=db.length;offset+=pageSize){
  const page=db.subarray(offset,offset+pageSize);
  if(page[0]!==13)continue;
  const p=view(page),cells=Math.min(p.getUint16(3),(pageSize-8)/2);
  for(let entry=0;entry<cells;entry++){
   try{
    const data=recordBlobs(payload(db,page,p.getUint16(8+entry*2)));
    for(let k=0;k<data.length-1;k++){
     const decoded=imageLayer(data[k],data[k+1]);
     if(decoded&&(!best||decoded.blocks>best.blocks||decoded.blocks===best.blocks&&decoded.alpha.length>best.alpha.length))best=decoded;
    }
   }catch{/* Inaccessible pages do not prevent decoding the remaining layers. */}
  }
 }
 return best;
}
