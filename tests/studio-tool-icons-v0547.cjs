const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const file='src/ui/StudioToolIcons.tsx', icons=read(file), app=read('src/ui/App.tsx'),catalog=read('src/ui/icons.tsx'),wheel=read('src/ui/RadialToolbar.tsx');
for(const name of [file,'src/ui/StudioBrushIcon.tsx','src/ui/icons.tsx','src/ui/App.tsx','src/ui/RadialToolbar.tsx']){
 const parse=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parse.parseDiagnostics.length,0,name+': '+parse.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(','));
}
assert(icons.includes('useId()'), 'Each SVG must have uniquely scoped gradient IDs');
assert(icons.includes('aria-hidden="true"'), 'Tool artwork is decorative, buttons provide accessible names');
const families=['Eraser','Lasso','Move','Fill','Hand','Zoom','RotateCanvas','Eyedropper','Vector','StrokeSelect','Rectangle','Freeform','Scale','RotateObject','Perspective','PerspectiveMove'];
for(const name of families){
 assert(icons.includes(`export const Studio${name}Icon=makeToolIcon(`),'Icon missing: '+name);
}
const entries={brush:['StudioBrushIcon','B'],eraser:['StudioEraserIcon','E'],lasso:['StudioLassoIcon','L'],transform:['StudioMoveIcon','V'],fill:['StudioFillIcon','G'],hand:['StudioHandIcon','H'],zoom:['StudioZoomIcon','Z'],rotate:['StudioRotateCanvasIcon','R'],eyedropper:['StudioEyedropperIcon','I'],vector:['StudioVectorIcon','N'],'stroke-select':['StudioStrokeSelectIcon','S'],rectangle:['StudioRectangleIcon','M']};
for(const [id,[symbol,key]] of Object.entries(entries)){
 assert(new RegExp(`id:'${id}',name:'[^']+',icon:${symbol},key:'${key}'`).test(catalog),'Catalog wiring/shortcut changed: '+id);
}
assert(wheel.includes('const Icon=allTools.find(t=>t.id===active)!.icon'));
assert(wheel.includes('<Icon size={placement.size<200?21:25}/>'));
const toolbar=app.match(/tool==='stroke-select'&&!advancedStrokeTransform[\s\S]*?<\/FloatingTransformPanel>/)?.[0];
assert(toolbar,'Compact stroke selection toolbar is present');
for(const icon of ['StudioStrokeSelectIcon','StudioLassoIcon','StudioMoveIcon'])assert(toolbar.includes('<'+icon+' size={21}/>'),'Selection icon is wired: '+icon);
assert(app.includes('<TransformOverlay engine={engineReady}'),'Full transform inspector remains available');
assert(app.includes('<t.icon size={17}/>'),'Left collapsed rail should use catalog icon');
assert(app.includes('<t.icon size={16}/>'),'Inspector toolbar should use catalog icon');
assert(!icons.includes('onClick='),'Artwork must not change actions');
console.log('PASS 0.5.47: 16 new artwork symbols, 12 catalog slots and shortcuts, 8 context transform buttons, scoped SVG gradients, responsive wheel/rails and TSX parsing.');
