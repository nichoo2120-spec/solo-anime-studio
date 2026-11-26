import {expect,it} from 'vitest';
import {importBrushFile} from '../src/core/brushImport';

it('converts a MyPaint MYB into a bitmap dab with diameter, spacing, opacity and pressure',async()=>{
 const data={version:3,name:'Brush · 薄墨',settings:{
  radius_logarithmic:{base_value:Math.log(40),inputs:{pressure:[[0,-1],[1,0]]}},
  dabs_per_actual_radius:{base_value:2},dabs_per_basic_radius:{base_value:.5},
  hardness:{base_value:.85},elliptical_dab_ratio:{base_value:2},elliptical_dab_angle:{base_value:30},
  opaque:{base_value:.7},offset_by_random:{base_value:.6},
 }};
 const result=await importBrushFile(new File([JSON.stringify(data)],'Ink.myb'),'auto',()=>{});
 expect(result).toHaveLength(1);
 expect(result[0]).toMatchObject({name:'Brush · 薄墨',angle:30,roundness:.5,opacity:.7,pressureWidth:true,tips:[{width:112,height:112}],settings:{spacing:.2,scatter:.3}});
 expect(result[0].size).toBeCloseTo(80,6);
 await expect(importBrushFile(new File(['{}'],'Broken.myb'),'auto',()=>{})).rejects.toThrow(/MyPaint/);
});
