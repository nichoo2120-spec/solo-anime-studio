/** Small, modifier-aware list selection shared by frames and layer rows.
 * Uses stable IDs, so a drawing commit never rebuilds selected sets.
 * Shift selects one contiguous range; Alt/Option toggles separate items.
 */
export type ItemSelection={ids:string[];anchor:string|null};
export function pickItems(items:readonly string[],current:ItemSelection,id:string,shift=false,alt=false):ItemSelection{
 if(!items.includes(id))return current;
 const valid=current.ids.filter(value=>items.includes(value));
 const anchor=current.anchor&&items.includes(current.anchor)?current.anchor:id;
 if(shift){
  const a=items.indexOf(anchor),b=items.indexOf(id);
  return {ids:items.slice(Math.min(a,b),Math.max(a,b)+1),anchor};
 }
 if(alt){
  return {ids:valid.includes(id)?valid.filter(value=>value!==id):[...valid,id],anchor:current.anchor&&items.includes(current.anchor)?current.anchor:id};
 }
 return {ids:[id],anchor:id};
}
