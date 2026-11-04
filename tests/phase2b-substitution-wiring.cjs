const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const sources=['src/animation/substitutions.ts','src/ui/SubstitutionShelf.tsx','src/core/shortcuts.ts','src/ui/App.tsx','src/core/model.ts'];
for(const file of sources){const parsed=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert(!parsed.parseDiagnostics.length,`${file} syntax error: ${parsed.parseDiagnostics.map(d=>d.messageText).join(', ')}`);}
const app=fs.readFileSync('src/ui/App.tsx','utf8'),css=fs.readFileSync('src/styles.css','utf8'),shortcuts=fs.readFileSync('src/core/shortcuts.ts','utf8');
for(const piece of ["substitutionShelf:'shift+u'","substitutionShelf:'Open drawing substitutions shelf'"])assert(shortcuts.includes(piece));
for(const piece of ["command==='substitutionShelf'", "setRightTab('substitutions')", "rightTab==='substitutions'", "<SubstitutionShelf", "saveSubstitution(", "applySubstitution(", "Rename drawing substitution", "Remove drawing substitution", "Drawing Substitution Shelf · "])assert(app.includes(piece),piece);
for(const piece of ['.substitution-shelf','.substitution-thumb','.substitution-card'])assert(css.includes(piece));
const data=fs.readFileSync('src/ui/SubstitutionShelf.tsx','utf8');assert(data.includes('useMemo')&&data.includes('memo(')&&data.includes('slice(0,25)'),'Thumbnail should be bounded/memoized');assert(!data.includes('requestAnimationFrame('),'Shelf must never paint every frame');
assert(app.includes('onContextMenu={event=>')&&app.includes('event.preventDefault();'),'Wacom browser-menu fix must remain');
assert(app.includes("e.code==='KeyW'")&&app.includes("command==='xsheet'")&&app.includes("command==='lightTable'"),'Existing shortkeys remain');
console.log('PASS shelf UI/shortcut wiring, TSX syntax, Wacom menu guard, existing Light Table / Xsheet / pop-out wheel shortcuts and bounded previews');
