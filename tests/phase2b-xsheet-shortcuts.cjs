const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {initialShortcuts,normalizeShortcuts,shortcutValid,keyChord}=require('../src/core/shortcuts.ts');
assert.equal(initialShortcuts.xsheet,'shift+x');assert.equal(new Set(Object.values(initialShortcuts)).size,Object.values(initialShortcuts).length);
assert.equal(keyChord({key:'X',shiftKey:true}),initialShortcuts.xsheet);
assert.equal(shortcutValid('shift+x','brush',initialShortcuts),false);
const old=Object.fromEntries(Object.entries(initialShortcuts).filter(([k])=>k!=='xsheet'));const normalized=normalizeShortcuts(old);
assert.equal(normalized.xsheet,'shift+x');assert.deepEqual(Object.fromEntries(Object.keys(old).map(k=>[k,normalized[k]])),old);
const custom=normalizeShortcuts({...old,brush:'shift+x'});assert.equal(custom.brush,'shift+x');assert.notEqual(custom.xsheet,'shift+x');assert.equal(new Set(Object.values(custom)).size,Object.values(custom).length);
for(const path of ['src/ui/App.tsx','src/ui/XsheetView.tsx']){
 const source=fs.readFileSync(path,'utf8'),file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(file.parseDiagnostics.length,0,`${path} parse errors: ${file.parseDiagnostics.map(x=>x.messageText).join('; ')}`);
}
const app=fs.readFileSync('src/ui/App.tsx','utf8');const view=fs.readFileSync('src/ui/XsheetView.tsx','utf8');
for(const fragment of ["if(command==='xsheet'){if(!e.repeat)toggleXsheetView();}","setTimelineView(old=>old==='timeline'?'xsheet':'timeline');","<XsheetView project={doc}","action:toggleXsheetView","<kbd>{shortcuts.xsheet.toUpperCase()}</kbd>","writePreference('timeline-view',timelineView)"])assert(app.includes(fragment),`Missing UI wiring: ${fragment}`);
for(const fragment of ['xsheetVisibleRange','xsheetRows','onHoldChange(row.frameId,row.hold+1)','onHoldChange(row.frameId,row.hold-1)','onMakeKey(row.frameId,layer.id)','cancelAnimationFrame'])assert(view.includes(fragment),`Missing Xsheet function: ${fragment}`);
assert(!view.includes('canvas.getContext'),'Xsheet must never touch canvas renderer');
console.log('PASS side-docked Xsheet shortcut Shift+X, preference migration, no shortcut collisions, wired view/menu/controls, TSX parses.');
