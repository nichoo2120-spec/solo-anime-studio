import {useLayoutEffect,useRef,useState} from 'react';
/** Match vector coordinates and raster backing pixels to their actual CSS viewport. */
export function useSurfaceSize<T extends Element>(initialWidth:number,initialHeight:number){
 const ref=useRef<T>(null),[size,setSize]=useState({width:initialWidth,height:initialHeight,dpr:1});
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;let frame=0;
  const measure=()=>{const width=el.clientWidth,height=el.clientHeight,dpr=window.devicePixelRatio||1;if(width&&height)setSize(old=>old.width===width&&old.height===height&&old.dpr===dpr?old:{width,height,dpr});};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);observer.observe(el);window.addEventListener('resize',schedule);measure();
  return()=>{observer.disconnect();window.removeEventListener('resize',schedule);cancelAnimationFrame(frame);};
 },[]);
 return {ref,...size};
}

