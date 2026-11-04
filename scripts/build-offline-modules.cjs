// v0.5.176: regenerates offline/src, a plain-JavaScript copy of src/ (one file per
// module). The app does NOT load it any more (offline/index.html loads the optimised
// bundle in offline/assets); it is kept only for the existing Node/Python checks
// (check-mix-v173, check-native-mix-v170, mix tests) that import single modules.
// Usage: node scripts/build-offline-modules.cjs [sourceRoot] [outRoot]
const ts=require('typescript');const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),srcRoot=path.resolve(process.argv[2]||path.join(root,'src')),outRoot=path.resolve(process.argv[3]||path.join(root,'offline/src'));
const map={'react':'react.js','react-dom':'react-dom.js','react-dom/client':'react-dom-client.js','react/jsx-runtime':'jsx-runtime.js','lucide-react':'lucide.js'};
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
let n=0;
for(const file of walk(srcRoot)){
 if(!/\.tsx?$/.test(file)||file.endsWith('.d.ts'))continue;
 const rel=path.relative(srcRoot,file).replace(/\\/g,'/').replace(/\.tsx?$/,'.js'),up='../'.repeat(rel.split('/').length);
 let code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,useDefineForClassFields:true,isolatedModules:true}}).outputText;
 code=code.replace(/(from\s*|import\s*\(\s*|import\s*)(["'])([^"']+)\2/g,(m,a,q,spec)=>{if(map[spec])return a+q+up+map[spec]+q;if(spec.startsWith('.')&&!/\.(js|css|json)$/.test(spec)){const base=path.resolve(path.dirname(file),spec);if(['.ts','.tsx'].some(e=>fs.existsSync(base+e)))return a+q+spec+'.js'+q;if(['/index.ts','/index.tsx'].some(e=>fs.existsSync(base+e)))return a+q+spec+'/index.js'+q;}return m;});
 code=code.replace(/new URL\((["'])(\.\/[\w.-]+)\.ts\1/g,'new URL($1$2.js$1').replace(/import\.meta\.env\.DEV/g,'false').replace(/^import ['"]\.\/styles\.css['"];\n/m,'');
 const out=path.join(outRoot,rel);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,code);n++;
}
console.log('offline/src: '+n+' modules written');
