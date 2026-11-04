import {memo,useId} from 'react';

/**
 * Solo Anime Studio's original Brush icon: a silver drawing brush with a teal
 * ink flourish. Designed for the circular wheel (21–25 px) and compact rails.
 * This is artwork only — tool selection, input handling, and shortcuts are unchanged.
 */
export const StudioBrushIcon=memo(function StudioBrushIcon({size=24,className}:{size?:number|string;className?:string}){
 const id=useId().replace(/:/g,'');
 return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="2 1 44 44" fill="none" className={className} aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={`${id}barrel`} x1="27" y1="26" x2="43" y2="5" gradientUnits="userSpaceOnUse">
    <stop stopColor="#7396af"/><stop offset=".42" stopColor="#eaf9ff"/><stop offset=".78" stopColor="#fbfdff"/><stop offset="1" stopColor="#91c4de"/>
   </linearGradient>
   <linearGradient id={`${id}ink`} x1="5" y1="34" x2="43" y2="43" gradientUnits="userSpaceOnUse">
    <stop stopColor="#1ce6de"/><stop offset=".55" stopColor="#6bf9f5"/><stop offset="1" stopColor="#0baacb"/>
   </linearGradient>
  </defs>
  {/* The bold ink sweep remains legible even when the wheel is compact. */}
  <path d="M11 30.5C5.4 33 4.5 39.3 9.7 41.2c3.8 1.4 7.4-.2 12.8-1.9 6-1.8 11-.5 17.8 2.2-5.4-1.1-10.3-6.1-18.9-3.1C11 41.7 6.6 37.7 11 30.5Z" fill={`url(#${id}ink)`}/>
  <path d="M10 38.4c5.2 2 11-4 18.7-3.7 4.4.2 8 1.6 11.8 4.7-4.5-.8-8.7-2.1-14.1-.6-9.3 2.6-13.2 4.4-16.4-.4Z" fill="#8afff6" opacity=".88"/>
  {/* Handle silhouette, glossy bevel and silver ferrule. */}
  <path d="M24.2 27.5 36.6 7.5c2.9-4.6 5.5-5.5 7-3.9 1.5 1.7.2 4.1-2 7.5L29.5 30.3Z" fill={`url(#${id}barrel)`}/>
  <path d="M27.5 26.2 40.3 6.9c1-1.5 1.8-2.1 2.3-2.2" stroke="#ffffff" strokeWidth="1.25" strokeLinecap="round" opacity=".9"/>
  <path d="m23.4 25.5 6.1 4.5-3.4 4-6.7-4.3Z" fill="#729db0" stroke="#e9fbff" strokeWidth=".85" strokeLinejoin="round"/>
  <path d="m23.9 27.2 4.6 3.4" stroke="#e6fbff" strokeWidth="1.4" strokeLinecap="round"/>
  {/* Bristles bend into the ink, rather than representing a generic pencil. */}
  <path d="M19.8 29.1c-3.5-.6-6.3 1.3-7.4 4.2-.8 2.3-1.6 4.1-4.8 4.1 3 2 6.8 1.7 9.7-.2 3.5-2.3 6-3.9 6.2-5.2.1-1.1-1.3-2-3.7-2.9Z" fill="#f9feff" stroke="#9ccedc" strokeWidth=".55" strokeLinejoin="round"/>
  <path d="M18.8 30.1c-3.1.5-3.8 4.1-6.7 6.5" stroke="#c8edf3" strokeWidth="1" strokeLinecap="round"/>
 </svg>;
});
