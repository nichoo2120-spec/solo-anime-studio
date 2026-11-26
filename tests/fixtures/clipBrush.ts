import {Buffer} from 'node:buffer';
import initSqlJs from 'sql.js';
import {zlibSync} from 'fflate';

const sqlite=initSqlJs();
const utf16be=(value:string)=>Buffer.from(value,'utf16le').swap16();
const tar=(name:string,entry:Uint8Array)=>{
 const head=Buffer.alloc(512);
 head.write(name);head.write(entry.length.toString(8).padStart(11,'0'),124);
 return Buffer.concat([head,entry,Buffer.alloc(((512-entry.length%512)%512)+1024)]);
};
const reference=(path:string)=>{
 const data=Buffer.from(path,'utf16le'),head=Buffer.alloc(16);
 head.writeUInt32BE(8,0);head.writeUInt32BE(1,4);head.writeUInt32BE(data.length+8,8);head.writeUInt32BE(data.length,12);
 return Buffer.concat([head,data]);
};
async function clipLayerFixture(){
 const {Database}=await sqlite,db=new Database();
 try{
  const attr=Buffer.alloc(54);
  attr.writeUInt32BE(16,0);attr.writeUInt32BE(9,16);utf16be('Parameter').copy(attr,20);
  attr.writeUInt32BE(7,38);attr.writeUInt32BE(5,42);attr.writeUInt32BE(1,46);attr.writeUInt32BE(1,50);
  const raw=new Uint8Array(256*256*2);raw[256+1]=255;raw[256+2]=184;raw[2*256+2]=219;
  const compressed=zlibSync(raw);
  const marker=utf16be('BlockDataBeginChunk'),block=Buffer.alloc(8+marker.length+28+compressed.length);
  block.writeUInt32BE(block.length);block.writeUInt32BE(19,4);marker.copy(block,8);
  const fields=8+marker.length;block.writeUInt32BE(raw.length,fields+4);block.writeUInt32BE(256,fields+8);
  block.writeUInt32BE(256,fields+12);block.writeUInt32BE(1,fields+16);block.writeUInt32LE(compressed.length,fields+24);
  block.set(compressed,fields+28);
  db.run('CREATE TABLE Offscreen (Attribute BLOB, BlockData BLOB)');
  db.run('INSERT INTO Offscreen VALUES (?, ?)',[attr,block]);
  const payload=db.export(),head=Buffer.alloc(16);
  head.set([137,67,50,70,13,10,26,10]);head.writeUInt32LE(payload.length+2,8);head.write('dATA',12);
  return Buffer.concat([head,Buffer.alloc(2),payload,Buffer.alloc(4)]);
 }finally{db.close();}
}

export async function sutFixture(){
 const {Database}=await sqlite,db=new Database();
 try{
  db.run('CREATE TABLE Node (NodeName TEXT, NodeVariantID INTEGER); CREATE TABLE Variant (VariantID INTEGER, BrushSize REAL, BrushInterval REAL, BrushPatternImageArray BLOB); CREATE TABLE MaterialFile (OriginalPath TEXT,FileData BLOB);');
  db.run('INSERT INTO Node VALUES (?,1)',['Roche · 山']);
  db.run('INSERT INTO Variant VALUES (1,72,31,?)',[reference('art/rocks')]);
  const layer=await clipLayerFixture();
  db.run('INSERT INTO MaterialFile VALUES (?,?)',['art/rocks',tar('data/material_0.layer',layer)]);
  return Buffer.from(db.export());
 }finally{db.close();}
}
