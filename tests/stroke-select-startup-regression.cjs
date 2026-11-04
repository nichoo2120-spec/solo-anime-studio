// Dependency-free guard for the icon import that previously crashed when pressing S.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/ui/App.tsx'),'utf8');
const ts=require('typescript');
const file=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.TSX);
const lucideImport=file.statements.find(stmt=>ts.isImportDeclaration(stmt)&&stmt.moduleSpecifier.text==='lucide-react');
assert(lucideImport,'Lucide React icon imports must exist');
const studioImport=file.statements.find(stmt=>ts.isImportDeclaration(stmt)&&stmt.moduleSpecifier.text==='./StudioToolIcons');
assert(studioImport,'Studio toolbar symbols must be imported');
const icons=new Set([...lucideImport.importClause.namedBindings.elements.map(el=>el.name.text), ...studioImport.importClause.namedBindings.elements.map(el=>el.name.text)]);
const studio=fs.readFileSync(path.join(root,'src/ui/StudioToolIcons.tsx'),'utf8');
const toolbar=source.match(/tool==='stroke-select'&&!advancedStrokeTransform[\s\S]*?<\/FloatingTransformPanel>/);
assert(toolbar,'Stroke Select tool mode toolbar must render when S is pressed');
const used=[...new Set([...toolbar[0].matchAll(/<(Studio\w+Icon)\s/g)].map(m=>m[1]))];
assert(used.length>=3,`Expected Select, Lasso and Transform icons, found ${used.length}`);
for(const icon of used){
 assert(icons.has(icon),`Missing icon import ${icon}: pressing S would crash`);
 if(icon.startsWith('Studio'))assert(studio.includes('export const '+icon+'='),`Tool icon ${icon} is not exported`);
}
const emitted=ts.transpileModule(source,{fileName:'App.tsx',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
const errors=(emitted.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
assert.equal(errors.length,0,`TSX syntax/transpile errors: ${errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' '))}`);
console.log(`PASS: ${used.length} Stroke Select mode icons are imported, all named and exported. JSX transpiles.`);
