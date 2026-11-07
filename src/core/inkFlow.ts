export type InkFlowControls={inkFlowAmount?:number;inkFlowLength?:number};
export type InkFlowStroke=InkFlowControls&{inkFlowVersion?:1;size:number};
export const isFlowInk=(kind:string|undefined)=>kind==='studio-ink'||kind==='contour-flow';
/** Distance from pen-down is the phase anchor. Never use elapsed time or the
 * unfinished total length: extending a stroke cannot move its settled pulses. */
export function inkFlowFactor(stroke:InkFlowStroke,distance:number){
 if(stroke.inkFlowVersion!==1)return 1;
 const amount=Math.max(0,Math.min(1,stroke.inkFlowAmount??0));
 const spacing=Math.max(24,stroke.size*3,stroke.inkFlowLength??160);
 const wave=Math.sin(Math.PI*Math.max(0,distance)/spacing);
 return 1-amount+amount*wave*wave;
}

