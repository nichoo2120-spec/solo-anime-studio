/** v0.5.174 Scene Camera (2.5D multiplane), like a Harmony / Animate camera.
 * Pure data + math. It never changes artwork or brush pixels. The camera only
 * changes how the finished layers are framed in camera preview and in export.
 * Camera "frame" numbers are 1-based exposure numbers (the same numbers as the
 * PNG sequence and the timeline exposure count, holds included). */
export type CameraEase='linear'|'ease-in'|'ease-out'|'ease-in-out'|'hold';
export const CAMERA_EASES:CameraEase[]=['linear','ease-in','ease-out','ease-in-out','hold'];
/** x,y = point of the drawing at the centre of the camera (document px).
 * zoom = 1 shows the full page; 2 shows half the width (push in).
 * rotation = camera roll in degrees. ease = how the move from THIS key to the next key runs. */
export type CameraKey={frame:number;x:number;y:number;zoom:number;rotation:number;ease:CameraEase};
export type CameraState={x:number;y:number;zoom:number;rotation:number};
/** depth: layer id -> Z distance. 0 = on the camera focus plane (moves 1:1).
 * Positive = farther away (moves less: parallax). Negative = nearer (moves more), > -0.9. */
export type SceneCamera={version:1;enabled:boolean;keys:CameraKey[];depth:Record<string,number>;safeArea:boolean;fieldGuide:boolean};
export const MAX_CAMERA_KEYS=500;
export function newSceneCamera():SceneCamera{return {version:1,enabled:true,keys:[],depth:{},safeArea:true,fieldGuide:false};}
export function homeCamera(width:number,height:number):CameraState{return {x:width/2,y:height/2,zoom:1,rotation:0};}
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export const clampZoom=(z:number)=>Math.max(.1,Math.min(20,z));
export const clampDepth=(d:number)=>Math.max(-.9,Math.min(50,d));
export function easeValue(ease:CameraEase,t:number){t=Math.max(0,Math.min(1,t));switch(ease){case 'hold':return 0;case 'ease-in':return t*t;case 'ease-out':return 1-(1-t)*(1-t);case 'ease-in-out':return t<.5?2*t*t:1-2*(1-t)*(1-t);default:return t;}}
export function sortedKeys(c:SceneCamera){return [...c.keys].sort((a,b)=>a.frame-b.frame);}
/** Camera state at exposure `frame` (1-based). No keys = home camera. */
export function cameraAt(c:SceneCamera|undefined,frame:number,width:number,height:number):CameraState{
 const home=homeCamera(width,height);if(!c||!c.keys.length)return home;
 const k=sortedKeys(c);if(frame<=k[0].frame)return pick(k[0]);const last=k[k.length-1];if(frame>=last.frame)return pick(last);
 for(let i=0;i<k.length-1;i++){const a=k[i],b=k[i+1];if(frame>=a.frame&&frame<=b.frame){if(frame===b.frame)return pick(b);const t=easeValue(a.ease,(frame-a.frame)/(b.frame-a.frame)),m=(p:number,q:number)=>p+(q-p)*t;
  // Zoom moves in log space, so a push-in feels even (like pro tools).
  return {x:m(a.x,b.x),y:m(a.y,b.y),zoom:Math.exp(m(Math.log(a.zoom),Math.log(b.zoom))),rotation:m(a.rotation,b.rotation)};}}
 return pick(last);
}
const pick=(k:CameraKey):CameraState=>({x:k.x,y:k.y,zoom:k.zoom,rotation:k.rotation});
export function setCameraKey(c:SceneCamera,key:CameraKey):SceneCamera{const keys=c.keys.filter(k=>k.frame!==key.frame);if(keys.length>=MAX_CAMERA_KEYS)return c;return {...c,keys:[...keys,{...key,zoom:clampZoom(key.zoom)}].sort((a,b)=>a.frame-b.frame)};}
export function deleteCameraKey(c:SceneCamera,frame:number):SceneCamera{return {...c,keys:c.keys.filter(k=>k.frame!==frame)};}
export function layerDepth(c:SceneCamera|undefined,layerId:string){const d=c?.depth[layerId];return finite(d)?clampDepth(d):0;}
/** Matrix [a,b,c,d,e,f] mapping document px -> camera output px (output = page size).
 * Depth gives parallax: a layer at depth d follows the camera move with factor 1/(1+d). */
export function cameraMatrix(state:CameraState,width:number,height:number,depth=0):[number,number,number,number,number,number]{
 const k=1/(1+clampDepth(depth)),cx=width/2+(state.x-width/2)*k,cy=height/2+(state.y-height/2)*k,z=1+(clampZoom(state.zoom)-1)*k,r=-state.rotation*k*Math.PI/180,cos=Math.cos(r)*z,sin=Math.sin(r)*z;
 if(cx===width/2&&cy===height/2&&z===1&&r===0)return [1,0,0,1,0,0];
 return [cos,sin,-sin,cos,width/2-(cos*cx-sin*cy),height/2-(sin*cx+cos*cy)];
}
/** Camera frame corners in document px (for the on-canvas overlay). */
export function cameraFrame(state:CameraState,width:number,height:number,scale=1){
 const z=clampZoom(state.zoom),hw=width/2/z*scale,hh=height/2/z*scale,r=state.rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
 return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>({x:state.x+x*c-y*s,y:state.y+x*s+y*c}));
}
export function validateSceneCamera(value:unknown):value is SceneCamera{
 const c=value as any;if(!c||c.version!==1||typeof c.enabled!=='boolean'||typeof c.safeArea!=='boolean'||typeof c.fieldGuide!=='boolean'||!Array.isArray(c.keys)||c.keys.length>MAX_CAMERA_KEYS||!c.depth||typeof c.depth!=='object'||Array.isArray(c.depth))return false;
 const frames=new Set<number>();
 for(const k of c.keys){if(!k||!Number.isInteger(k.frame)||k.frame<1||k.frame>100000||frames.has(k.frame)||!finite(k.x)||!finite(k.y)||Math.abs(k.x)>1e6||Math.abs(k.y)>1e6||!finite(k.zoom)||k.zoom<.1||k.zoom>20||!finite(k.rotation)||Math.abs(k.rotation)>3600||!CAMERA_EASES.includes(k.ease))return false;frames.add(k.frame);}
 for(const [id,d] of Object.entries(c.depth))if(typeof id!=='string'||!finite(d)||d<-.9||d>50)return false;
 return true;
}
export function pruneCameraDepth(c:SceneCamera,layerIds:Set<string>):SceneCamera{const depth=Object.fromEntries(Object.entries(c.depth).filter(([id])=>layerIds.has(id)));return {...c,depth};}
