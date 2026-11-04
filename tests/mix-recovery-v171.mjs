import {strict as assert} from 'node:assert';
// Exercise the actual precompiled offline worker manager with a deterministic
// failing Worker: no Canvas DOM, browser permissions or npm dependencies needed.
const created=[];
globalThis.document={createElement(name){assert.equal(name,'canvas');return {width:1,height:1};}};
globalThis.OffscreenCanvas=class{};
globalThis.createImageBitmap=async()=>{};
globalThis.Worker=class {
 constructor(){this.closed=false;created.push(this);}
 terminate(){this.closed=true;}
 postMessage(){}
};
const {LiveBlendWorker}=await import('../offline/src/engine/LiveBlendWorker.js');
let updates=0;
const w=new LiveBlendWorker(()=>updates++);
w.warm();assert.equal(w.available(),true);assert.equal(created.length,1);
created[0].onerror({preventDefault(){}});
assert.equal(w.available(),false);assert.equal(updates,1);
w.retryForNewGesture();assert.equal(w.available(),true);assert.equal(created.length,2);
created[1].onerror({preventDefault(){}});
assert.equal(w.available(),false);assert.equal(updates,2);
w.retryForNewGesture();assert.equal(w.available(),false,'circuit breaker must not respawn indefinitely');
assert.equal(created.length,2);
w.dispose();
console.log('PASS: one recovery on a new gesture; two failures stop further worker respawns');
