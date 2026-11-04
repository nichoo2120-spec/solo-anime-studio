import assert from 'node:assert/strict';
import {newBrushLibrary,activeInputPreset,stockPresets,isRetiredBlendPresetId,brushList} from '../offline/src/core/brushes.js';
const legacyIDs=['color-blender','smudge-bristle','blender-soft','wet-mix'];
for(const id of legacyIDs){assert(isRetiredBlendPresetId(id));assert(!brushList(newBrushLibrary(),'Paint').some(p=>p.id===id));}
const normal=stockPresets.filter(p=>p.category!=='Eraser'&&!isRetiredBlendPresetId(p.id));
for(const b of normal){
 const library=newBrushLibrary();library.brushId=b.id;
 const paint=activeInputPreset(library).settings;
 assert.deepEqual(paint,b.settings,'Paint mode pixel metadata must be unchanged for '+b.id);
 library.mode='mix';const mixed=activeInputPreset(library).settings;
 for(const key of ['brushTip','brushKind','colorNib','dryBristleVersion','dryMaterial','watercolorEngine','watercolorShape','watercolorMode','textureStrength','pressureCurve','tipSpacing','tipAngle','smoothness','stabilization','flow','opacity','size'])assert.deepEqual(mixed[key],paint[key],b.id+' changed '+key);
 assert.notEqual(mixed.brushTip,'color-blender',b.id+' became generic blender');
 assert.equal(mixed.nativeMixEnabled,true,b.id+' missing mix toggle');
 assert.deepEqual(library.presets.find(x=>x.id===b.id).settings,b.settings,b.id+' modified existing preset');
}
console.log('PASS',normal.length,'normal Pencil / Ink / Paint / Watercolor brushes keep exact native settings in Mix, 4 legacy Blender presets hidden but retained');
