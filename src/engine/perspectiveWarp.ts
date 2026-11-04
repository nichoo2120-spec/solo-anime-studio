/** Lightweight exact 4-corner projective mapping (homography) for stroke geometry. */
export type XY={x:number;y:number};
export type H=[number,number,number,number,number,number,number,number,number];
export const H_ID:H=[1,0,0,0,1,0,0,0,1];
export function affineH(m:readonly number[]):H{return [m[0],m[2],m[4],m[1],m[3],m[5],0,0,1];}
export function multiplyH(a:H,b:H):H{return [a[0]*b[0]+a[1]*b[3]+a[2]*b[6],a[0]*b[1]+a[1]*b[4]+a[2]*b[7],a[0]*b[2]+a[1]*b[5]+a[2]*b[8],a[3]*b[0]+a[4]*b[3]+a[5]*b[6],a[3]*b[1]+a[4]*b[4]+a[5]*b[7],a[3]*b[2]+a[4]*b[5]+a[5]*b[8],a[6]*b[0]+a[7]*b[3]+a[8]*b[6],a[6]*b[1]+a[7]*b[4]+a[8]*b[7],a[6]*b[2]+a[7]*b[5]+a[8]*b[8]];}
export function projectPoint<T extends XY>(p:T,h:H):T{const d=h[6]*p.x+h[7]*p.y+h[8];if(Math.abs(d)<1e-9)return {...p};return {...p,x:(h[0]*p.x+h[1]*p.y+h[2])/d,y:(h[3]*p.x+h[4]*p.y+h[5])/d};}
export function quadValid(q:XY[]):boolean{
 if(q.length!==4||q.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e6||Math.abs(p.y)>1e6))return false;
 let sign=0;for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(Math.abs(cross)<.5)return false;if(sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross);}
 return true;
}
/** Solve 8x8 via partial pivot elimination, retaining h33=1. */
export function homography(from:XY[],to:XY[]):H|null{
 if(from.length!==4||!quadValid(to))return null;
 const a:number[][]=[];
 for(let i=0;i<4;i++){const s=from[i],d=to[i];a.push([s.x,s.y,1,0,0,0,-s.x*d.x,-s.y*d.x,d.x]);a.push([0,0,0,s.x,s.y,1,-s.x*d.y,-s.y*d.y,d.y]);}
 for(let k=0;k<8;k++){let best=k;for(let r=k+1;r<8;r++)if(Math.abs(a[r][k])>Math.abs(a[best][k]))best=r;if(Math.abs(a[best][k])<1e-11)return null;[a[k],a[best]]=[a[best],a[k]];const div=a[k][k];for(let c=k;c<9;c++)a[k][c]/=div;for(let r=0;r<8;r++){if(r===k)continue;const factor=a[r][k];for(let c=k;c<9;c++)a[r][c]-=factor*a[k][c];}}
 const h=[...a.map(r=>r[8]),1] as H;
 if(!h.every(Number.isFinite)||h.some(v=>Math.abs(v)>1e6))return null;
 return h;
}
