import {advancedFill} from './advancedFill';
self.onmessage=(event:MessageEvent)=>{try{const {data,width,height,x,y,color,tolerance,gap,expansion}=event.data;const result=advancedFill(data,width,height,x,y,color,tolerance,gap,expansion);self.postMessage(result,{transfer:[result.output.buffer]});}catch(error){self.postMessage({error:String(error)});}};
