const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {initialShortcuts,normalizeShortcuts,keyChord,shortcutValid}=require('../src/core/shortcuts.ts');
const app=fs.readFileSync('src/ui/App.tsx','utf8');
const sourceFile=ts.createSourceFile('App.tsx',app,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
assert.equal(sourceFile.parseDiagnostics.length,0,`App.tsx must parse: ${sourceFile.parseDiagnostics.map(e=>e.messageText).join(' / ')}`);
assert.equal(initialShortcuts.lightTable,'shift+l');
assert.equal(initialShortcuts.pinLightTable,'shift+p');
assert.equal(new Set(Object.values(initialShortcuts)).size,Object.values(initialShortcuts).length,'New shortcuts must not collide with default shortcuts');
assert.equal(keyChord({key:'L',shiftKey:true}),initialShortcuts.lightTable);
assert.equal(keyChord({key:'P',shiftKey:true}),initialShortcuts.pinLightTable);
assert.equal(shortcutValid('shift+l','eraser',initialShortcuts),false,'Remapping cannot steal light table shortcut');
const oldStored=Object.fromEntries(Object.entries(initialShortcuts).filter(([key])=>key!=='lightTable'&&key!=='pinLightTable'));
const updated=normalizeShortcuts(oldStored);
assert.equal(updated.lightTable,'shift+l','Migrated users must get Light Table toggle');
assert.equal(updated.pinLightTable,'shift+p','Migrated users must get Light Table pin');
assert.deepEqual(Object.fromEntries(Object.keys(oldStored).map(k=>[k,updated[k]])),oldStored,'Migrate without changing existing shortcut assignments');
const customStored={...oldStored,brush:'shift+l',eraser:'shift+p'};
const custom=normalizeShortcuts(customStored);
assert.equal(custom.brush,'shift+l');assert.equal(custom.eraser,'shift+p');
assert.equal(new Set(Object.values(custom)).size,Object.values(custom).length,'No duplicated shortcuts after migrating customized preferences');
assert.notEqual(custom.lightTable,'shift+l','Existing user shortcuts must take precedence');
assert.notEqual(custom.pinLightTable,'shift+p');
for(const snippet of [
 "if(command==='lightTable'){if(!e.repeat)toggleLightTablePanel();}",
 "else if(command==='pinLightTable'){if(!e.repeat)pinLightTableFromShortcut();}",
 "setLayout(old=>({...old,bottomClosed:false}));setLightTableOpen(old=>!old);",
 "{label:'Advanced Light Table · '+shortcuts.lightTable.toUpperCase(),action:toggleLightTablePanel}",
 "{label:'Pin / unpin current drawing · '+shortcuts.pinLightTable.toUpperCase(),action:pinLightTableFromShortcut}",
 "<kbd>{shortcuts.lightTable.toUpperCase()}</kbd>",
 "<kbd>{shortcuts.pinLightTable.toUpperCase()}</kbd>"
])assert.ok(app.includes(snippet),`Expected keyboard/menu/panel wiring: ${snippet}`);
console.log('PASS Light Table Shift+L toggle and Shift+P pin: UI+menu wiring, no key collisions, save preference migration, customizable shortcuts, TSX syntax.');
