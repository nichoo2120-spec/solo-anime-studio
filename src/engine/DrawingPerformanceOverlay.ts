type UndoStats={entries:number;bytes:number;budget:number};
const mib=(value:number)=>`${(value/1048576).toFixed(1)} MiB`;

export class DrawingPerformanceOverlay{
 private panel?:HTMLElement;
 private frame=0;
 private started=0;
 private frames=0;
 private renderMs=0;
 constructor(private host:HTMLElement,private undoStats:()=>UndoStats){}

 get visible(){return !!this.panel;}
 rendered(ms:number){this.renderMs=ms;}

 toggle(){
  if(this.panel){this.dispose();return;}
  const panel=document.createElement('output');
  panel.className='drawing-performance-overlay';
  panel.setAttribute('aria-label','Drawing performance');
  this.host.append(panel);
  this.panel=panel;this.started=performance.now();this.frames=0;this.renderMs=0;
  this.publish(0);
  this.frame=requestAnimationFrame(this.sample);
 }
 private sample=(now:number)=>{
  if(!this.panel)return;
  this.frames++;
  const elapsed=now-this.started;
  if(elapsed>=300){this.publish(this.frames*1000/elapsed);this.started=now;this.frames=0;}
  this.frame=requestAnimationFrame(this.sample);
 };
 private publish(fps:number){
  const heap=(performance as Performance&{memory?:{usedJSHeapSize:number}}).memory?.usedJSHeapSize;
  const {entries,bytes,budget}=this.undoStats();
  this.panel!.textContent=`FPS ${fps?fps.toFixed(0):'—'}\nFrame ${this.renderMs.toFixed(1)} ms\nJS memory ${heap===undefined?'Unavailable':mib(heap)}\nUndo ${entries} · ${mib(bytes)} / ${mib(budget)} raster cache`;
 }
 dispose(){if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;this.panel?.remove();this.panel=undefined;}
}
