import {expect,it} from 'vitest';
import {importBrushFile} from '../src/core/brushImport';

function gbr(name:string,spacing:number,width:number,height:number,alpha:number[],rgba=false){
 const label=Buffer.from(name+'\0','utf8'),head=Buffer.alloc(28);
 head.writeUInt32BE(28+label.length);head.writeUInt32BE(2,4);head.writeUInt32BE(width,8);head.writeUInt32BE(height,12);
 head.writeUInt32BE(rgba?4:1,16);head.write('GIMP',20);head.writeUInt32BE(spacing,24);
 return Buffer.concat([head,label,Uint8Array.from(rgba?alpha.flatMap(a=>[200,17,50,a]):alpha)]);
}
it('imports a grayscale GIMP GBR with its Unicode name, dimensions and spacing',async()=>{
 const file=new File([new Uint8Array(gbr('Rizos y nieve',42,3,2,[0,180,0,255,72,0]))],'Snow.gbr');
 const results=await importBrushFile(file,'auto',()=>{});
 expect(results).toHaveLength(1);
 expect(results[0]).toMatchObject({name:'Rizos y nieve',size:3,tips:[{width:3,height:2}],settings:{spacing:.42}});
});
it('imports a random GIMP GIH with distinct grayscale and RGBA tip cells',async()=>{
 const header=Buffer.from('Grass · 草\n2 ncells:2 step:35 dim:1 rank0:2 sel0:random\n','utf8');
 const bytes=Buffer.concat([header,gbr('A',25,3,2,[0,255,0,0,148,255]),gbr('B',25,2,2,[180,0,28,255],true)]);
 const progress:number[]=[];
 const results=await importBrushFile(new File([Uint8Array.from(bytes)],'Grass.gih'),'auto',current=>progress.push(current));
 expect(results).toHaveLength(1);
 expect(results[0]).toMatchObject({name:'Grass · 草',size:3,tips:[{width:3,height:2},{width:2,height:2}],selection:'random',settings:{spacing:.35}});
 expect(results[0].tips[0].id).not.toEqual(results[0].tips[1].id);
 expect(Buffer.from(results[0].tips[1].alpha,'base64')).toEqual(Buffer.from([180,0,28,255]));
 expect(progress).toEqual([0,0,1]);
});
