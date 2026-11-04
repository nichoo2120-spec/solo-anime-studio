import {newProject,newLayer,type Stroke} from '../src/core/model';
import {stockPresets} from '../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../src/core/paintTips';
/** Fixed 281-stroke, six-layer scene, shared by both production builds. */
export function performanceScene(width=1920,height=1080){
 const p=newProject('Performance 281 strokes',width,height);p.id='performance-v155';p.createdAt='2026-10-30T00:00:00.000Z';p.settings.guides=true;
 p.layers=['Upper ink','Line','Colour','Rough','Background','Spare'].map((name,i)=>({...newLayer(name),id:'perf-layer-'+i}));p.activeLayerId=p.layers[2].id;
 const make=(preset:string,index:number,size:number,color:string):Stroke=>{const b=stockPresets.find(p=>p.id===preset)!.settings,id='perf-base-'+preset+'-'+index,seed=watercolorSeedFor(id),x=.05+(index%10)*.075,y=.08+((index*7)%17)*.045;
  return{...b,...brushStrokeMetadata(b),id,kind:'stroke',tool:'brush',size,opacity:preset==='color-solid'?.65:1,color,pressure:false,response:1,smoothness:18,stabilization:0,taperStart:0,taperEnd:0,colorSeed:b.coloringEngine?seed:undefined,dryBristleSeed:b.dryBristleVersion?seed:undefined,points:Array.from({length:21},(_,j)=>{const t=j/20;return{x:width*(x+.16*t),y:height*(y+.025*Math.sin(t*Math.PI*2+index)),p:1,v:.65};})};};
 for(let i=0;i<90;i++)p.layers[i<60?4:2].operations.push(make('color-solid',i,110+i%6*18,['#345570','#c3a486','#486f65','#7e6881','#d1bca3'][i%5]));
 for(let i=0;i<150;i++)p.layers[i<100?1:0].operations.push(make(i%3?'technical':'g-pen',i,2+i%3,'#25313e'));
 for(let i=0;i<41;i++)p.layers[3].operations.push(make('hb',i,4,'#4c667c'));
 return p;
}
