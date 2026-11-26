export function activeBrush(page){
 return page.getByRole('button',{name:'Choose brush',exact:true});
}

export async function openBrushPicker(page){
 const picker=page.getByRole('dialog',{name:'Brush picker',exact:true});
 if(!await picker.isVisible())await activeBrush(page).click();
 return picker;
}

export async function openBrushSelection(page){
 const picker=await openBrushPicker(page);
 const summary=picker.getByText('Keyboard selection',{exact:true});
 if(!await picker.getByLabel('Brush category',{exact:true}).isVisible())await summary.click();
 return picker;
}

export async function selectBrushOption(page,label,value){
 const picker=await openBrushSelection(page);
 const select=picker.getByLabel(label,{exact:true});
 if(label!=='Brush family'||await select.isVisible())await select.selectOption(value);
 await activeBrush(page).click();
}

export async function openBrushSettings(page){
 await page.getByRole('button',{name:'Brush quick settings',exact:true}).click();
 await page.getByRole('button',{name:/^Full Brush Settings/}).click();
}

export async function openBrushImports(page){
 const picker=await openBrushPicker(page);
 const add=picker.getByRole('button',{name:'Add brushes',exact:true});
 if(await add.getAttribute('aria-expanded')!=='true')await add.click();
 return picker;
}

export async function setBrushSize(page,value){
 await page.getByRole('toolbar',{name:'Brush toolbar'}).getByRole('button',{name:/^Size:/}).click();
 const input=page.getByRole('spinbutton',{name:'Size exact value',exact:true});
 await input.fill(String(value));
 await input.press('Enter');
}
