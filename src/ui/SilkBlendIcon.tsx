import {memo,useId} from 'react';

/**
 * v0.5.238 Silk Blend icon: a soft, rounded silver brush tip resting in a
 * two-colour silk ribbon that melts from teal into warm rose. Artwork only.
 */
export const SilkBlendIcon=memo(function SilkBlendIcon({size=24,className}:{size?:number|string;className?:string}){
 const id=useId().replace(/:/g,'');
 return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="2 1 44 44" fill="none" className={className} aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={`${id}silk`} x1="5" y1="36" x2="43" y2="30" gradientUnits="userSpaceOnUse">
    <stop stopColor="#1fd6e0"/><stop offset=".45" stopColor="#8fd8ff"/><stop offset=".7" stopColor="#d6a6ff"/><stop offset="1" stopColor="#ff9fb8"/>
   </linearGradient>
   <linearGradient id={`${id}tip`} x1="26" y1="27" x2="40" y2="6" gradientUnits="userSpaceOnUse">
    <stop stopColor="#7c9fb6"/><stop offset=".5" stopColor="#f1fbff"/><stop offset="1" stopColor="#9fcfe6"/>
   </linearGradient>
  </defs>
  {/* Silk ribbon: two colours folding into one smooth gradient. */}
  <path d="M5 35.5c5.5-6 11.2-1.4 16.4-3.6 5.4-2.3 8.6-8.6 16.3-6.3 3 .9 4.5 2.8 5.3 4.6-3.9-2.1-7.7-1.7-11.3 1.4-5.6 4.8-10.6 8.8-17.6 7.9-4-.5-6.7-2.1-9.1-4Z" fill={`url(#${id}silk)`}/>
  <path d="M8.2 36.6c4.9 1.6 9.7 1.1 14.3-2.3 4.2-3.1 7.8-6.4 13.4-6.3" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" opacity=".75"/>
  {/* Soft round tip: a rounded dome instead of a pointed bristle. */}
  <path d="M27.3 24.6 37.9 8c2.4-3.7 4.7-4.4 6-3 1.3 1.4.3 3.5-1.6 6.3L32.4 27.6Z" fill={`url(#${id}tip)`}/>
  <path d="m26.2 23.6 6.6 4.6-2.6 3.1-6.8-4.4Z" fill="#6f98ad" stroke="#e9fbff" strokeWidth=".8" strokeLinejoin="round"/>
  <ellipse cx="23.2" cy="29.6" rx="5.1" ry="3.6" transform="rotate(-32 23.2 29.6)" fill="#f7fdff" stroke="#9fd2e2" strokeWidth=".6"/>
  <path d="M20.4 30.9c1.6.9 3.8.6 5.3-.8" stroke="#bfe7f2" strokeWidth=".9" strokeLinecap="round"/>
  {/* Sparkle: the "silk" sheen. */}
  <path d="M13 13.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1Z" fill="#a8ecff"/>
 </svg>;
});
