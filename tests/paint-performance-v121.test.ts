import {describe,it,expect} from 'vitest';
import {paintPaperGrain,paintPaperGrainRow} from '../src/engine/paintNibsV8';
import {activeLayer,newProject,validateProject,type Stroke} from '../src/core/model';

describe('paint texture rows',()=>{
 it('matches the original grain at every pixel, including scaled and negative coordinates',()=>{
  for(const seed of [0,123,4294967295])for(const scale of [1,2.4,.62,.16,.67,.30,.80])for(const [x,y] of [[0,0],[61,127],[-37,-29],[2041,1069]]){
   const row=paintPaperGrainRow(x,y,131,seed,scale);
   for(let i=0;i<row.length;i++)expect(row[i]).toBe(paintPaperGrain((x+i)*scale,y*scale,seed));
  }
 });
 it('saves the sampling version and rejects unknown versions',()=>{
  const p=newProject(),s:Stroke={id:'paint',kind:'stroke',tool:'brush',points:[{x:100,y:100,p:.7}],size:150,opacity:.9,color:'#30343a',pressure:true,response:1,brushKind:'paint',engineVersion:10,paintNibVersion:1};
  activeLayer(p).operations=[s];const loaded=validateProject(JSON.parse(JSON.stringify(p)));
  expect(activeLayer(loaded).operations[0]).toEqual(s);
  expect(()=>validateProject({...p,layers:p.layers.map(l=>l.id===p.activeLayerId?{...l,operations:[{...s,paintNibVersion:2}]}:l)})).toThrow('Unsupported paint nib');
 });
});
