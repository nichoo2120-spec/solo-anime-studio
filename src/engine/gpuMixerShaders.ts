const header=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2D dabs,base,carry,owners,tieMap;
uniform sampler2DArray evenTank,oddTank;
uniform ivec2 grid;
uniform float reach,pitch,brushSize,drag,capacity,flow,textureKeep,edgeDark,loadFraction,carrySize;
uniform vec3 loaded;
uniform bool wash,solid,packedTank;
uniform int ordinal;
vec4 part(int index,int column){return texelFetch(dabs,ivec2(column,index),0);}
vec3 linearize(vec3 x){return mix(pow((x+0.055)/1.055,vec3(2.4)),x/12.92,lessThanEqual(x,vec3(.04045)));}
vec3 encode(vec3 x){
 x=floor(clamp(x,0.,1.)*4096.+.5)/4096.;
 return mix(1.055*pow(x,vec3(1./2.4))-.055,x*12.92,lessThanEqual(x,vec3(.0031308)));
}
vec4 source(ivec2 p){vec4 v=texelFetch(base,clamp(p,ivec2(0),grid-1),0);return vec4(linearize(v.rgb)*v.a,v.a);}
vec4 sampleBase(vec2 p){
 p=clamp(p,vec2(0),vec2(grid-1));ivec2 a=ivec2(floor(p));vec2 f=fract(p);
 return mix(mix(source(a),source(a+ivec2(1,0)),f.x),mix(source(a+ivec2(0,1)),source(a+1),f.x),f.y);
}
vec4 tank(int i,ivec2 p){
 if(i<0)return vec4(0);
 ivec3 pos=ivec3(clamp(p,ivec2(0),ivec2(23)),i/2);
 vec4 hi=(i%2==0)?texelFetch(evenTank,pos,0):texelFetch(oddTank,pos,0);
 
 pos.x+=24;
 vec4 lo=(i%2==0)?texelFetch(evenTank,pos,0):texelFetch(oddTank,pos,0);
 return hi+lo/(packedTank?255.:1024.);
}
vec4 chargeColor(ivec2 uv){
 vec4 first=part(0,0),v=sampleBase(first.xy+(vec2(uv)/23.-.5)*2.*first.z);
 return solid||v.a<=0.?vec4(loaded,1):v;
}
`;
export const fullVertex=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(2.*p-1.,0,1);}`;
export const ownerVertex=header+`
flat out int index;
void main(){
 index=gl_InstanceID;vec2 a=part(max(0,index-1),0).xy,b=part(index,0).xy;
 vec2 lo=floor(min(a,b)-reach),hi=ceil(max(a,b)+reach)+1.;
 vec2 corner=vec2(gl_VertexID&1,(gl_VertexID>>1)&1);
 gl_Position=vec4(2.*mix(lo,hi,corner)/vec2(grid)-1.,0,1);
}`;
export const ownerFragment=header+`
flat in int index;out vec4 color;
void main(){
 vec2 a=part(max(0,index-1),0).xy,b=part(index,0).xy,v=b-a,p=floor(gl_FragCoord.xy);
 float d=dot(v,v),f=clamp(dot(p-a,v)/(d==0.?1.:d),0.,1.);
 vec2 off=p-a-v*f;float dist=dot(off,off)/(reach*reach);if(dist>1.)discard;
 gl_FragDepth=dist*.99999;
 int id=index+1;color=vec4(float(id&255),float((id>>8)&255),float(id>>16),255.)/255.;
}`;
export const reservoirFragment=header+`
out vec4 result;
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy);bool low=p.x>=24;p.x%=24;
 vec4 dab=part(ordinal,0),params=part(ordinal,1);
 vec4 local=sampleBase(dab.xy+(vec2(p)/23.-.5)*2.*dab.z);
 vec4 old=tank(ordinal-1,p);
 if(ordinal==0&&carrySize>0.)old=texelFetch(carry,ivec2(floor(vec2(p)*(carrySize-1.)/23.+.5)),0);
 if(wash&&ordinal>0){
  vec4 adjacent=(tank(ordinal-1,p+ivec2(1,0))+tank(ordinal-1,p-ivec2(1,0))+tank(ordinal-1,p+ivec2(0,1))+tank(ordinal-1,p-ivec2(0,1)))*.25;
  old=mix(old,adjacent,params.w*.5);
 }
 vec4 value=mix(old,local,part(ordinal,2).y);
 float scale=packedTank?255.:1024.;result=low?fract(value*scale):floor(value*scale)/scale;
}`;
export const shadeFragment=header+`
out vec4 result;
vec4 bristle(int i,ivec2 uv,float f,float added){
 return mix(mix(tank(i-1,uv),tank(i,uv),f),chargeColor(uv),added);
}
void main(){
 ivec2 p=ivec2(gl_FragCoord.x,float(grid.y)-gl_FragCoord.y);
 ivec3 id=ivec3(round(texelFetch(owners,p,0).rgb*255.));int i=id.x+(id.y<<8)+(id.z<<16)-1;
 if(i<0){result=vec4(0);return;}
 int tie=int(texelFetch(tieMap,p,0).r);
 if(tie>0)i=tie-1;
 vec4 dab=part(i,0),params=part(i,1),mixing=part(i,2);
 vec2 a=part(max(0,i-1),0).xy,v=dab.xy-a;
 float span=dot(v,v),f=i==0?1.:clamp(dot(vec2(p)-a,v)/(span==0.?1.:span),0.,1.);
 vec2 n=(vec2(p)-a-v*f)/dab.z,uv=clamp(n*.5+.5,0.,1.)*23.;
 ivec2 u=ivec2(floor(uv)),u1=min(u+1,ivec2(23));vec2 frac=fract(uv);
 float rim=clamp(dot(n,n),0.,1.)*edgeDark;
 float direct=clamp(mixing.x*params.w*(.85+.3*textureKeep)*(1.-.25*rim),0.,1.);
 if(wash)direct*=1.-.8*params.w;
 float added=mixing.w;
 vec4 pigment=mix(mix(bristle(i,u,f,added),bristle(i,ivec2(u1.x,u.y),f,added),frac.x),
                   mix(bristle(i,ivec2(u.x,u1.y),f,added),bristle(i,u1,f,added),frac.x),frac.y);
 vec4 moved=sampleBase(vec2(p)-params.xy*min(params.z/pitch,dab.z*drag*.65));
 // Insert the direct sample before the loaded-paint interpolation.
 vec4 loadColor=mix(mix(chargeColor(u),chargeColor(ivec2(u1.x,u.y)),frac.x),
                    mix(chargeColor(ivec2(u.x,u1.y)),chargeColor(u1),frac.x),frac.y);
 pigment=mix(pigment,mix(moved,loadColor,added),direct);
 pigment=mix(source(p),pigment,mixing.z);
 if(pigment.a<=0.){result=vec4(0);return;}
 vec4 bytes=floor(255.*vec4(encode(pigment.rgb/pigment.a),pigment.a*flow*dab.w)+.5);
 result=vec4(floor(bytes.rgb*bytes.a/255.+.5),bytes.a)/255.;
}`;
