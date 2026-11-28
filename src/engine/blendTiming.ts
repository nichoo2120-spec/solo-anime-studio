type Stage='input'|'dabs'|'pickup'|'mask'|'mix'|'composite'|'present'|'worker';
type Sample=Record<Stage,number>&{points:number,size:number};
const history:Sample[]=[];
let current:Sample|undefined;
let inputAt=0;
export const blendTiming={
 enabled:false,
 history,
 input(){if(this.enabled&&!inputAt)inputAt=performance.now();},
 begin(points:number,size:number){if(!this.enabled)return;current={points,size,input:inputAt?performance.now()-inputAt:0,dabs:0,pickup:0,mask:0,mix:0,composite:0,present:0,worker:0};inputAt=0;},
 start(){return current?performance.now():0;},
 end(stage:Stage,start:number){if(current&&start)current[stage]+=performance.now()-start;},
 finish(){if(current){history.push(current);if(history.length>1024)history.shift();current=undefined;}}
};
if((process.env.NODE_ENV !== 'production')&&typeof window!=='undefined')Object.assign(window,{soloBlendTiming:blendTiming});
