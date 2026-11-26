import {expect,test} from '@playwright/test';
import {activeBrush,openBrushPicker,openBrushSettings,setBrushSize} from '../brush-workspace.mjs';

test('brush toolbar, picker and per-brush quick settings remain usable after docking',async({page})=>{
 await page.goto('/');
 const toolbar=page.getByRole('toolbar',{name:'Brush toolbar',exact:true});
 const brush=activeBrush(page);
 const picker=await openBrushPicker(page);
 const search=picker.getByRole('searchbox',{name:'Search brushes'});
 await expect(search).toBeFocused();
 for(const name of ['Ink','Pencil','Paint','Watercolor','Airbrush','Blend','Texture / Nature','Imported','My brushes ★']){
  await expect(picker.getByRole('button',{name,exact:true})).toBeVisible();
 }
 await picker.getByRole('button',{name:'Grid view'}).click();
 await expect(picker.getByRole('button',{name:'List view'})).toBeVisible();
 await picker.getByRole('button',{name:'Texture / Nature',exact:true}).click();
 await search.fill('Foliage clump');
 await picker.getByRole('button',{name:'Use Foliage clump',exact:true}).click();
 await expect(brush).toHaveAttribute('data-current-brush-id','nature-foliage-clump');
 await setBrushSize(page,235);
 await expect(toolbar.getByRole('button',{name:'Size: 235 px',exact:true})).toBeVisible();
 const more=toolbar.getByRole('button',{name:'Brush quick settings',exact:true});
 await openBrushSettings(page);
 const panel=page.getByRole('region',{name:'Brush Settings',exact:true});
 const nav=panel.getByRole('navigation');
 for(const section of ['Brush size','Ink','Brush tip','Tip shape','Stroke','Texture','Dual brush','Blend settings','Nature','Pressure','Correction','Advanced','Cursor','My brushes']){
  const control=nav.getByRole('button',{name:section,exact:true});
  await control.click();
  await expect(control).toHaveAttribute('aria-current','location');
  await expect(panel.locator('.brush-settings-section:visible h3').first()).toBeVisible();
 }
 await nav.getByRole('button',{name:'Nature',exact:true}).click();
 await expect(panel.getByLabel('Seed',{exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Hide Density from quick menu',exact:true}).click();
 await panel.getByRole('button',{name:'Switch Brush Settings dock',exact:true}).click();
 expect((await panel.boundingBox())!.x).toBeLessThan(20);
 await page.keyboard.press('Escape');
 await expect(panel).toBeHidden();
 await more.click();
 await expect(page.getByRole('region',{name:'Brush quick settings'}).getByRole('button',{name:/^Density:/})).toHaveCount(0);
 await page.keyboard.press('F4');
 await expect(panel).toBeVisible();
 await panel.getByRole('button',{name:'Done',exact:true}).click();
 await toolbar.getByRole('button',{name:'Dock brush toolbar left',exact:true}).click();
 await expect(toolbar.getByRole('button',{name:'Dock brush toolbar top',exact:true})).toBeVisible();
 await page.reload();
 await expect(toolbar.getByRole('button',{name:'Dock brush toolbar top',exact:true})).toBeVisible();
});
