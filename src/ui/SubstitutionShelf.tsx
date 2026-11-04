import {memo,useMemo,useState} from 'react';
import {BookmarkPlus,Copy,Trash2,PenLine} from 'lucide-react';
import {substitutionCategories,type SubstitutionCategory,type SubstitutionItem,MAX_SUBSTITUTIONS} from '../animation/substitutions';

/** Deliberately lightweight SVG thumbnail. Never invokes the full canvas renderer
 * and only scans its immutable shelf item on save/change, not on each pen stroke. */
const ShelfThumbnail=memo(function ShelfThumbnail({item}:{item:SubstitutionItem}){
 const preview=useMemo(()=>{
  const paths:{id:string;d:string;color:string}[]=[];let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const op of item.operations.slice(0,25)){
   const points=op.kind==='stroke'?op.points:op.kind==='vector'?op.nodes:[];
   const color=op.kind==='stroke'||op.kind==='vector'?op.color:'#a0c7c2';
   if(op.kind==='stroke'&&op.tool==='eraser')continue;
   if(!points.length)continue;
   const step=Math.max(1,Math.floor(points.length/70));
   const sampled=points.filter((_,i)=>i%step===0||i===points.length-1);
   for(const point of sampled){x0=Math.min(x0,point.x);y0=Math.min(y0,point.y);x1=Math.max(x1,point.x);y1=Math.max(y1,point.y);}
   paths.push({id:op.id,d:sampled.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),color});
  }
  if(!paths.length)return null;
  const w=Math.max(25,x1-x0),h=Math.max(25,y1-y0),pad=Math.max(w,h)*.12;
  return {viewBox:[x0-pad,y0-pad,w+pad*2,h+pad*2].join(' '),paths};
 },[item]);
 return <svg className="substitution-thumb" viewBox={preview?.viewBox??'0 0 100 65'} aria-label="Simplified drawing preview" role="img" preserveAspectRatio="xMidYMid meet">
  {preview?preview.paths.map(path=><path key={path.id} d={path.d} stroke={path.color} strokeWidth="2" vectorEffect="non-scaling-stroke" fill="none" opacity=".85" strokeLinecap="round" strokeLinejoin="round"/>):<text x="50" y="33" fill="#78aba7" fontSize="10" textAnchor="middle">ART</text>}
 </svg>;
});

export function SubstitutionShelf({items,layerName,selectedCount,disabled,onSave,onApply,onRename,onDelete}:{
 items:SubstitutionItem[];layerName:string;selectedCount:number;disabled:boolean;
 onSave:(name:string,category:SubstitutionCategory,selection:boolean)=>boolean;
 onApply:(id:string,mode:'append'|'replace')=>void;
 onRename:(id:string,name:string)=>void;
 onDelete:(id:string)=>void;
}){
 const [name,setName]=useState(''),[category,setCategory]=useState<SubstitutionCategory>('mouth');
 const [filter,setFilter]=useState<'all'|SubstitutionCategory>('all');
 const [mode,setMode]=useState<'append'|'replace'>('append');
 const shown=filter==='all'?items:items.filter(item=>item.category===filter);
 const capture=(selection:boolean)=>{if(onSave(name,category,selection))setName('');};
 return <div className="substitution-shelf" role="region" aria-label="Drawing Substitution Shelf">
  <div className="substitution-intro"><strong>DRAWING SUBSTITUTIONS</strong><span>{items.length}/{MAX_SUBSTITUTIONS}</span></div>
  <p className="hint">Reuse your own mouth, eye, hand, pose or FX drawings. Saved in this project. Copies are independent, never linked.</p>
  <label className="substitution-label">Name<input aria-label="Name new substitution" maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Mouth A / Blink Closed"/></label>
  <label className="substitution-label">Category<select aria-label="Substitution category" value={category} onChange={e=>setCategory(e.target.value as SubstitutionCategory)}>{substitutionCategories.map(cat=><option key={cat} value={cat}>{cat.toUpperCase()}</option>)}</select></label>
  <div className="substitution-save-buttons">
   <button disabled={disabled||!selectedCount||!name.trim()||items.length>=MAX_SUBSTITUTIONS} title="Save selected strokes from active layer only" onClick={()=>capture(true)}><BookmarkPlus size={14}/> Save selection</button>
   <button disabled={disabled||!name.trim()||items.length>=MAX_SUBSTITUTIONS} title={'Save everything drawn on '+layerName} onClick={()=>capture(false)}><BookmarkPlus size={14}/> Save layer</button>
  </div>
  <small className="substitution-caption">Active layer: {layerName}. Select strokes with S / Shift-click / lasso, then save your selection.</small>
  <div className="substitution-divider"/>
  <label className="substitution-label">Show<select aria-label="Filter saved drawings" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="all">All drawings</option>{substitutionCategories.map(cat=><option key={cat} value={cat}>{cat.toUpperCase()}</option>)}</select></label>
  <label className="substitution-label">Insert mode<select aria-label="Substitution insert mode" value={mode} onChange={e=>setMode(e.target.value as 'append'|'replace')}><option value="append">Add to current layer (safe)</option><option value="replace">Replace current layer (confirm)</option></select></label>
  <div className="substitution-cards">
   {shown.map(item=><div key={item.id} className="substitution-card">
    <ShelfThumbnail item={item}/>
    <div className="substitution-card-heading"><strong title={item.name}>{item.name}</strong><small>{item.category.toUpperCase()} · {item.layerKind}</small></div>
    <div className="substitution-card-actions">
     <button className="substitution-insert" title={'Insert independent copy into '+layerName} disabled={disabled} onClick={()=>onApply(item.id,mode)}><Copy size={12}/> Insert</button>
     <button aria-label={'Rename '+item.name} title="Rename" disabled={disabled} onClick={()=>{const label=window.prompt('Rename drawing:',item.name);if(label!==null)onRename(item.id,label);}}><PenLine size={13}/></button>
     <button aria-label={'Delete '+item.name} title="Remove from shelf (original artwork unaffected)" disabled={disabled} onClick={()=>{if(window.confirm('Remove “'+item.name+'” from this project shelf? Existing artwork is not affected.'))onDelete(item.id);}}><Trash2 size={13}/></button>
    </div>
   </div>)}
   {!shown.length&&<p className="hint">{items.length?'Nothing in this category yet.':'No drawings saved yet. Make a drawing, name it above, then choose Save selection or Save layer.'}</p>}
  </div>
  <p className="hint">Held animation cels automatically become independent keys when you insert a substitution. Undo restores the previous drawing. No automatic linked edits or cycles yet.</p>
 </div>;
}
