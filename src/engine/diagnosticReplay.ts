import {newProject,appendOperation,validateProject,type Stroke} from '../core/model';
import {strokeSnapshot} from './geometryCache';
import {strokeGeometry} from './strokeGeometry';
import type {StrokeTrace} from './StrokeDiagnostics';
export function diagnosticTrace(value:unknown):StrokeTrace{const t=value as StrokeTrace;if(!t||!['brush','eraser','lasso','rectangle'].includes(t.tool))throw Error('Choose a drawing or selection recording.');const source=t.source??t.selection;if(!Array.isArray(source)||!source.length||source.length>20000||source.some(p=>!p||(![p.x,p.y,p.p].every(Number.isFinite)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6||p.p<0||p.p>1)))throw Error('Invalid or excessive recorded samples.');if(t.truncated)throw Error('This record was truncated; exact replay cannot be certified.');if(t.source){const s={...t.settings as Stroke,points:source};validateProject(appendOperation(newProject(),s));}return structuredClone(t);}
export async function replayTrace(value:unknown,count=100,cancel=()=>false){const t=diagnosticTrace(value),stroke=t.source?strokeSnapshot({...t.settings as Stroke,points:t.source}):undefined;let signature='',geometry:ReturnType<typeof strokeGeometry>|undefined,completed=0,totalMs=0;
 for(let i=0;i<Math.max(1,Math.min(100,count));i++){if(cancel())break;const start=performance.now();geometry=stroke?strokeGeometry(stroke):{points:structuredClone(t.selection!),cubics:[]};const next=JSON.stringify(geometry);totalMs+=performance.now()-start;if(i&&next!==signature)throw Error('Geometry differs on repeated replay.');signature=next;completed++;await new Promise(r=>setTimeout(r,0));}
 let checksum=2166136261;for(let i=0;i<signature.length;i++)checksum=Math.imul(checksum^signature.charCodeAt(i),16777619);
 return {completed,identical:completed===Math.min(100,count),checksum:(checksum>>>0).toString(16),totalMs,geometry,sourceSamples:(t.source??t.selection)!.length,audit:t.audit??null,notes:t.notes??[]};
}
