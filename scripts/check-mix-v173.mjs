import assert from 'node:assert/strict';
import {newBrushLibrary,activeInputPreset,stockPresets} from '../offline/src/core/brushes.js';
import {displayCleanInk} from '../offline/src/engine/InkDisplay.js';
import {workerBlendEligible} from '../offline/src/engine/LiveBlendWorker.js';
import {validateProject,newProject} from '../offline/src/core/model.js';
assert.equal(displayCleanInk({brushKind:'technical',engineVersion:10}),true,'original fast ink must remain');
for(const version of [1,2])assert.equal(displayCleanInk({brushKind:'technical',engineVersion:10,nativeMixVersion:version}),false,'Ink Mix must bypass fast ink renderer');
assert.equal(workerBlendEligible({tool:'brush',nativeMixVersion:2}),true,'v2 must go to worker');
for(const preset of stockPresets.filter(p=>p.category!=='Eraser'&&!['color-blender','smudge-bristle','blender-soft','wet-mix'].includes(p.id))){
 const library=newBrushLibrary();library.brushId=preset.id;library.mode='mix';
 const mixed=activeInputPreset(library);assert.equal(mixed.settings.nativeMixEnabled,true,preset.id);assert.equal(mixed.settings.brushKind,preset.settings.brushKind,preset.id);assert.equal(mixed.settings.brushTip,preset.settings.brushTip,preset.id);
}
for(const version of [1,2]){const p=newProject();p.layers[0].operations.push({kind:'stroke',id:'test-'+version,tool:'brush',size:45,opacity:1,color:'#ff0000',response:1,pressure:false,engineVersion:10,nativeMixVersion:version,nativeMixAmount:.7,nativeMixRadius:.5,points:[{x:50,y:50,p:1}]});validateProject(p);}
console.log('PASS: Ink Mix avoids Ink display bypass, normal brushes keep their identities, worker enabled, v1 and v2 saved strokes validate.');
