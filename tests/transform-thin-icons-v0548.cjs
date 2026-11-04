const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const icons=fs.readFileSync(path.join(root,'src/ui/StudioToolIcons.tsx'),'utf8');
const app=fs.readFileSync(path.join(root,'src/ui/App.tsx'),'utf8');
const engine=fs.readFileSync(path.join(root,'src/engine/StudioEngine.ts'),'utf8');
const style=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
for(const symbol of ['freeform','move','scale','rotate-object','perspective']){
 const art=icons.split(`case '${symbol}':art=<>`)[1]?.split('</>;break;')[0];
 assert(art,`Missing approved ${symbol} icon`);
 const widths=[...art.matchAll(/strokeWidth="([\d.]+)"/g)].map(x=>Number(x[1]));
 assert(widths.length&&widths.every(width=>width<=2.5),`${symbol} must use thin cyan-line strokes`);
 assert(!art.includes('strokeWidth={3.'),`${symbol} has old thick strokes`);
}
assert(app.includes('label="Selection transform tools"'),'Conventional area Transform toolbar missing');
assert(app.includes('selectStrokesForPerspective(ids)'),'Area selection should be able to enter stroke Perspective mode');
assert(app.includes('setAreaTransformMode(id)'),'Area modes are not wired');
assert(engine.includes("if(!selecting&&this.strokeIds.length)return;"),'Transform modes must not re-pick strokes on missed drag');
assert(engine.includes("['move','freeform','perspective-move'].includes(this.strokeMode)"),'Scale and Rotate must not default to Move');
assert(engine.includes("this.paintCursor();return;"),'Custom directional drag overlay missing');
assert(engine.includes("this.canvas.style.cursor='none'"),'Dragging should use the direction-aware SVG-style cursor overlay');
assert(style.includes('THIN-LINE')||style.includes('thin-stroke'),'Icon CSS update missing');
console.log('PASS: five thin SVGs, live directional feedback, single-mode guards, classic Selection Transform toolbar and editable Perspective switching');
