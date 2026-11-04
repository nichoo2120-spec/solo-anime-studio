/** Shared 2D mesh foundation. Mesh topology never modifies source artwork.
 * Source positions/UVs are immutable snapshots; moving a destination vertex
 * cannot progressively re-sample an already deformed image.
 * No rendering dependency: usable by Canvas, WebGL or a later worker.
 */
export type Point2={x:number;y:number};
export type MeshVertex={readonly source:Readonly<Point2>;readonly uv:Readonly<Point2>;destination:Point2;locked:boolean};
export type MeshFace=readonly [number,number,number];
export type GeometryMesh={vertices:MeshVertex[];faces:MeshFace[]};
export type MeshIssue={face:number;reason:'invalid-index'|'degenerate-source'|'folded-destination'|'non-finite'};
export type Bounds2={x:number;y:number;w:number;h:number};
const cross=(a:Point2,b:Point2,c:Point2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const finite=(p:Point2)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const copy=(p:Point2)=>({x:p.x,y:p.y});

/** Build regular mesh topology. Rows and columns count cells, not handles. */
export function createRegularMesh(area:Bounds2,rows:number,cols:number):GeometryMesh{
 if(!finite(area)||!Number.isFinite(area.w)||!Number.isFinite(area.h)||area.w<=0||area.h<=0)throw Error('Invalid mesh bounds');
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>64||cols>64)throw Error('Invalid mesh density');
 const vertices:MeshVertex[]=[];
 for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
  const u=x/cols,v=y/rows,source={x:area.x+area.w*u,y:area.y+area.h*v};
  vertices.push({source:Object.freeze(source),uv:Object.freeze({x:u,y:v}),destination:copy(source),locked:false});
 }
 const faces:MeshFace[]=[];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const a=y*(cols+1)+x,b=a+1,d=a+cols+1,c=d+1;
  faces.push([a,b,c],[a,c,d]);
 }
 return {vertices,faces};
}

/** Clones the editable vertex state but preserves the original source and topology. */
export function copyMesh(mesh:GeometryMesh):GeometryMesh{
 return {vertices:mesh.vertices.map(v=>({source:v.source,uv:v.uv,destination:copy(v.destination),locked:v.locked})),faces:mesh.faces};
}

/** Move destination only. The original coordinates are never rewritten. */
export function moveVertex(mesh:GeometryMesh,index:number,target:Point2):boolean{
 const v=mesh.vertices[index];if(!v||v.locked||!finite(target))return false;
 v.destination=copy(target);return true;
}

export function validateMesh(mesh:GeometryMesh):MeshIssue[]{
 const issues:MeshIssue[]=[];
 mesh.faces.forEach(([i,j,k],face)=>{
  if(![i,j,k].every(n=>Number.isInteger(n)&&n>=0&&n<mesh.vertices.length)||new Set([i,j,k]).size!==3){issues.push({face,reason:'invalid-index'});return;}
  const a=mesh.vertices[i],b=mesh.vertices[j],c=mesh.vertices[k];
  if(![a.source,b.source,c.source,a.destination,b.destination,c.destination].every(finite)){issues.push({face,reason:'non-finite'});return;}
  const sourceArea=cross(a.source,b.source,c.source),targetArea=cross(a.destination,b.destination,c.destination);
  if(Math.abs(sourceArea)<1e-7){issues.push({face,reason:'degenerate-source'});return;}
  if(sourceArea*targetArea<=1e-10)issues.push({face,reason:'folded-destination'});
 });
 return issues;
}

/** Barycentric inverse-map for a destination pixel; null outside all faces.
 * A renderer samples the ORIGINAL bitmap at the returned coordinate.
 */
export function sourceAt(mesh:GeometryMesh,p:Point2):Point2|null{
 if(!finite(p))return null;
 for(const [ia,ib,ic] of mesh.faces){
  const va=mesh.vertices[ia],vb=mesh.vertices[ib],vc=mesh.vertices[ic];
  if(!va||!vb||!vc)continue;
  const a=va.destination,b=vb.destination,c=vc.destination,denom=cross(a,b,c);
  if(!Number.isFinite(denom)||Math.abs(denom)<1e-10)continue;
  const wb=cross(a,p,c)/denom,wc=cross(a,b,p)/denom,wa=1-wb-wc;
  if(wa>=-1e-8&&wb>=-1e-8&&wc>=-1e-8){
   return {x:wa*va.source.x+wb*vb.source.x+wc*vc.source.x,y:wa*va.source.y+wb*vb.source.y+wc*vc.source.y};
  }
 }
 return null;
}

/** Geometry-only validation of an undeformed identity mesh. */
export function isIdentityMesh(mesh:GeometryMesh,tolerance=1e-8){
 return mesh.vertices.every(v=>Math.hypot(v.destination.x-v.source.x,v.destination.y-v.source.y)<=tolerance);
}
