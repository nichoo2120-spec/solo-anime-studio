import type {Matrix,Point} from './model';
export type View={x:number;y:number;zoom:number;rotation:number};
export function toScreen(p:{x:number;y:number},v:View){const c=Math.cos(v.rotation),s=Math.sin(v.rotation);return {x:v.x+(p.x*c-p.y*s)*v.zoom,y:v.y+(p.x*s+p.y*c)*v.zoom};}
export function toProject(p:{x:number;y:number},v:View){const x=(p.x-v.x)/v.zoom,y=(p.y-v.y)/v.zoom,c=Math.cos(v.rotation),s=Math.sin(v.rotation);return {x:x*c+y*s,y:-x*s+y*c};}
/** Keep every viewport corner on drawable paper, including after canvas rotation. */
export function coverView(view:View,width:number,height:number,paperWidth:number,paperHeight:number):View{
 if(width<=0||height<=0)return view;
 const cos=Math.abs(Math.cos(view.rotation)),sin=Math.abs(Math.sin(view.rotation));
 // Leave a screen pixel of paper past the edges for fractional device scaling.
 const extentWidth=width*cos+height*sin+2,extentHeight=width*sin+height*cos+2;
 const zoom=Math.max(view.zoom,extentWidth/paperWidth,extentHeight/paperHeight);
 const halfWidth=extentWidth/(2*zoom),halfHeight=extentHeight/(2*zoom);
 const middle={x:width/2,y:height/2},center=toProject(middle,view);
 const x=Math.max(halfWidth,Math.min(paperWidth-halfWidth,center.x));
 const y=Math.max(halfHeight,Math.min(paperHeight-halfHeight,center.y));
 if(zoom===view.zoom&&x===center.x&&y===center.y)return view;
 const offset=toScreen({x,y},{x:0,y:0,zoom,rotation:view.rotation});
 return {...view,zoom,x:middle.x-offset.x,y:middle.y-offset.y};
}
export function fitView(w:number,h:number,pw:number,ph:number,rotation=0):View{const c=Math.cos(rotation),s=Math.sin(rotation),rw=Math.abs(pw*c)+Math.abs(ph*s),rh=Math.abs(pw*s)+Math.abs(ph*c),zoom=Math.max(.02,Math.min((w-90)/rw,(h-90)/rh));return {x:w/2-(pw*c-ph*s)*zoom/2,y:h/2-(pw*s+ph*c)*zoom/2,zoom,rotation};}
export function transformMatrix(cx:number,cy:number,dx:number,dy:number,scale:number,angle:number,scaleY=scale):Matrix {const a=Math.cos(angle)*scale,b=Math.sin(angle)*scale,c=-Math.sin(angle)*scaleY,d=Math.cos(angle)*scaleY;return [a,b,c,d,cx+dx-a*cx-c*cy,cy+dy-b*cx-d*cy];}
export function bounds(points:Point[]){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}return {x,y,w:right-x,h:bottom-y};}
export function pressureWidth(size:number,p:number,enabled:boolean,response:number){return size*(enabled?Math.max(.08,Math.pow(p,response)):1);}
