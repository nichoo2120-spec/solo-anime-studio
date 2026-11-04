import {newProject,newLayer,type Stroke} from '../../src/core/model';
import {stockPresets} from '../../src/core/brushes';
import {brushStrokeMetadata,watercolorSeedFor} from '../../src/core/paintTips';
/** Synthetic reproduction of the recording's occupied active layer, not its artwork. */
export function videoPaintFixture(){
 const p=newProject('Occupied paint layer — 137 marks',1920,1080),layer=newLayer('Line'),preset=stockPresets.find(p=>p.id==='color-texture')!.settings;
 p.layers=[layer];p.activeLayerId=layer.id;
 for(let i=0;i<137;i++){
  const x=180+(i%17)*87,y=170+Math.floor(i/17)*88,angle=(i%5-2)*.27,length=110+(i*19%85),id='video-like-'+i;
  const s:Stroke={...preset,...brushStrokeMetadata(preset),id,kind:'stroke',tool:'brush',coloringAppearanceVersion:2,colorNib:'filbert',colorNibFollow:false,size:97.2,opacity:1,flow:.95,color:['#d5c8b0','#42688d','#4aa99a'][Math.floor(i/43)%3],colorSeed:watercolorSeedFor(id),points:Array.from({length:15},(_,j)=>{const t=j/14;return {x:x+Math.sin(angle)*length*t+8*Math.sin(t*3),y:y+Math.cos(angle)*length*t,p:.35+.6*Math.sin(t*Math.PI),v:.65};})};layer.operations.push(s);
 }
 return p;
}
