/** Canvas stores premultiplied colour. GPU/CPU readbacks can differ by one
 * unpremultiplied channel level without changing the stored pixel. Do not
 * replace sharp ink for those conversion-only differences. */
export function nativePixelsDiffer(before:Uint8ClampedArray,after:Uint8ClampedArray,a:number,b=a){
 const alpha=before[a+3];
 if(alpha!==after[b+3])return true;
 if(before[a]===after[b]&&before[a+1]===after[b+1]&&before[a+2]===after[b+2])return false;
 const premultiplied=(value:number)=>Math.floor((value*alpha+127)/255);
 return premultiplied(before[a])!==premultiplied(after[b])||premultiplied(before[a+1])!==premultiplied(after[b+1])||premultiplied(before[a+2])!==premultiplied(after[b+2]);
}
