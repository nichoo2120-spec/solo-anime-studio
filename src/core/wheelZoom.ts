import {toProject,toScreen,type View} from './geometry';

/** Normalize mouse wheels and trackpads, keeping the canvas point under the
 * cursor fixed. Limit a single event so a page-mode wheel cannot jump to a cap. */
export function wheelZoom(view:View,pivot:{x:number;y:number},deltaY:number,deltaMode=0,pageHeight=800,minZoom=.25):View{
 const pixels=deltaY*(deltaMode===1?16:deltaMode===2?pageHeight:1);
 const delta=Math.max(-180,Math.min(180,Number.isFinite(pixels)?pixels:0));
 const zoom=Math.max(minZoom,Math.min(8,view.zoom*Math.exp(-delta*.0012)));
 if(zoom===view.zoom)return view;
 const anchor=toProject(pivot,view),next={...view,zoom},screen=toScreen(anchor,next);
 return {...next,x:next.x+pivot.x-screen.x,y:next.y+pivot.y-screen.y};
}
