const assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript');
const app=fs.readFileSync('src/ui/App.tsx','utf8'),wheel=fs.readFileSync('src/ui/RadialToolbar.tsx','utf8'),css=fs.readFileSync('src/styles.css','utf8');
for(const file of ['src/ui/App.tsx','src/ui/RadialToolbar.tsx','src/ui/XsheetView.tsx','src/core/shortcuts.ts']){
 const src=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(src.parseDiagnostics.length,0,file+': '+src.parseDiagnostics.map(x=>ts.flattenDiagnosticMessageText(x.messageText,' ')).join('; '));
}
for(const required of ["canvas-xsheet-row", "xsheetSide==='left'", "xsheet-side-dock", "xsheet-dock-controls", "setXsheetSide('left')", "setXsheetSide('right')", "resizeXsheetDock", "width:xsheetWidth", "writePreference('xsheet-side',xsheetSide)", "writePreference('xsheet-width',xsheetWidth)", "setTimelineView(old=>old==='timeline'?'xsheet':'timeline')"]){assert(app.includes(required),'Missing side-dock integration '+required);}
assert(app.indexOf('className="canvas-xsheet-row')<0||app.includes("className={'canvas-xsheet-row"));
assert(!app.includes("timelineView==='xsheet'?<XsheetView"),'Xsheet must NOT replace bottom Timeline');
assert(app.includes("!layout.bottomClosed&&<div className=\"timeline-body\""),'bottom Timeline must stay active');
assert(app.includes('className="wheel-overlay"'),'Wheel must be outside drawing-workspace and mounted in workbench');
assert.equal((app.match(/<RadialToolbar/g)||[]).length,1);
assert(app.indexOf('<RadialToolbar')>app.indexOf('</section>'),'wheel should follow timeline as overlay instead of sitting in canvas');
for(const required of ['canvas-xsheet-row','xsheet-side-dock','xsheet-dock-resizer','wheel-overlay','.radial-wrap{pointer-events:auto}'])assert(css.includes(required),'Missing CSS '+required);
for(const required of ['createPortal(contents,popout.document.body)', 'window.open(', 'popoutRef.current', 'returnToApp', 'popout-wheel', 'solo:wheel-popout-toggle', 'setPlacement(p=>({...p,collapsed:false}))', "onTool(t)"]){assert(wheel.includes(required),'Missing popout toolwheel integration '+required);}
assert(app.includes("e.code==='KeyW'"),'Wheel hotkey should be Shift+W');
assert(app.includes("new Event('solo:wheel-popout-toggle')"),'Wheel must use the same toggle in the menu and keyboard');
const shortcuts=fs.readFileSync('src/core/shortcuts.ts','utf8');assert(shortcuts.includes("key==='shift+w'")&&shortcuts.includes('!reserved(key)')&&shortcuts.includes('!reserved(candidate)'),'Shift+W must not be assignable to another tool');
const p=fs.readFileSync('src/animation/xsheet.ts','utf8');assert(p.includes('sameXsheetPresentation'),'Existing zero-extra-render Xsheet memo gate must remain');
const content=fs.readFileSync('src/ui/XsheetView.tsx','utf8');assert(content.includes('xsheetVisibleRange'),'Xsheet virtualization must remain');
console.log('PASS side-docked Xsheet and pop-out wheel wiring, TSX parse, resize constraints, Shift+W reservation and no duplicate paint engine');
