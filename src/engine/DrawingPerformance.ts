/** Opt-in, bounded local profiling. Times canvas submission, not display scanout. */
export class DrawingPerformance {
 enabled=false;private timings:Record<string,number[]>={};private pending?:{first:number;last:number};
 start(){this.timings={};this.pending=undefined;this.enabled=true;}
 stop(){this.enabled=false;}
 record(name:string,ms:number){if(!this.enabled)return;const values=this.timings[name]??=[];if(values.length<20000)values.push(ms);}
 measure<T>(name:string,work:()=>T):T{if(!this.enabled)return work();const start=performance.now();try{return work();}finally{this.record(name,performance.now()-start);}}
 input(){if(!this.enabled)return;const now=performance.now();this.pending={first:this.pending?.first??now,last:now};}
 visible(){if(!this.enabled||!this.pending)return;const now=performance.now();this.record('oldestInputToCanvasMs',now-this.pending.first);this.record('latestInputToCanvasMs',now-this.pending.last);this.pending=undefined;}
 export(){return structuredClone(this.timings);}
}
