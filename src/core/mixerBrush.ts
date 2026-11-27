export const mixerPresets = [
 ['Dry',0,.5,0,.8],['Dry Light Load',0,.15,0,.55],['Dry Heavy Load',0,.95,0,1],
 ['Moist',.32,.48,.48,.68],['Moist Light Mix',.32,.52,.25,.66],
 ['Wet',.65,.42,.65,.62],['Wet Light Mix',.65,.48,.32,.68],['Wet Heavy Mix',.72,.38,.85,.6],
 ['Very Wet',.9,.24,.72,.57],['Very Wet Heavy Mix',1,.18,.94,.52],
] as const;
export function mixerRecipe(name:string){
 const row=mixerPresets.find(p=>p[0]===name);
 return row?{bbWetness:row[1],bbCapacity:row[2],bbMix:row[3],bbFlow:row[4]}:undefined;
}
