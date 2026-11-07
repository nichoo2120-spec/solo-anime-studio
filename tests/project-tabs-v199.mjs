import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {chromium} from '@playwright/test';
async function main(){
 const url='http://127.0.0.1:5797',server=await createServer({server:{host:'127.0.0.1',port:5797,strictPort:true}});await server.listen();let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-gpu']});
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.addInitScript(()=>{
   window.soloDesktop={checkForUpdates:async()=>'Up to date',onSaveBeforeClose:fn=>{window.saveBeforeClose=fn;return()=>{};},closeAfterSave:()=>{window.closedAfterSave=(window.closedAfterSave??0)+1;}};
   const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(window.failSaves)throw new DOMException('Test full disk','QuotaExceededError');return put.apply(this,args);};
   // Hold automatic saves so close prompts exercise genuinely unsaved documents.
   const timeout=window.setTimeout;window.setTimeout=function(fn,ms,...args){return timeout(fn,ms===2500?60000:ms,...args);};
  });
  await page.goto(url);
  assert(await page.getByRole('heading',{name:'Project workspace',exact:true}).isVisible());
  const fixtures=await page.evaluate(async()=>{const {newProject}=await import('/src/core/model.ts');return ['Tab A','Tab B'].map(name=>newProject(name,640,480));});
  await page.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles(fixtures.map((p,i)=>({name:'tab-'+i+'.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})));
  const tabs=page.getByRole('tablist',{name:'Open projects'});
  await page.getByRole('tab',{name:'Tab B (unsaved changes)',exact:true}).waitFor();
  assert.equal(await tabs.getByRole('tab').count(),2);
  async function select(name){await page.getByRole('tab',{name:new RegExp('^'+name+'( \\(unsaved changes\\))?$')}).click();await page.waitForFunction(n=>document.querySelector('[role=tab][aria-selected=true]')?.textContent.includes(n),name);}
  async function draw(k){const b=await page.locator('canvas.drawing-canvas').boundingBox();await page.mouse.move(b.x+b.width*.45,b.y+b.height*.4+k*12);await page.mouse.down();for(let i=0;i<18;i++)await page.mouse.move(b.x+b.width*.45+i*3,b.y+b.height*.4+k*12+12*Math.sin(i*.2));await page.mouse.up();}
  async function backup(){await page.getByRole('button',{name:'File',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download editable backup',exact:true}).click();return JSON.parse(fs.readFileSync(await (await wait).path(),'utf8'));}
  async function png(){await page.getByRole('button',{name:'Export PNG',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Download PNG',exact:true}).click();const bytes=fs.readFileSync(await (await wait).path());if(await page.getByLabel('Close dialog',{exact:true}).count())await page.getByLabel('Close dialog',{exact:true}).click();return bytes;}
  const ops=p=>p.layers.reduce((n,l)=>n+l.operations.length,0);
  await select('Tab A');await page.getByLabel('Canvas zoom',{exact:true}).selectOption('100');await draw(0);await draw(1);
  assert.equal(ops(await backup()),2);const originalPixels=await png();
  await page.keyboard.press('Control+z');assert.equal(ops(await backup()),1);
  await select('Tab B');await page.getByRole('button',{name:'Select Rough',exact:true}).click();await draw(2);assert.equal(ops(await backup()),1);await page.keyboard.press('Control+z');assert.equal(ops(await backup()),0);
  await select('Tab A');assert.equal(await page.getByRole('button',{name:'Select Line',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByLabel('Canvas zoom',{exact:true}).inputValue(),'100');
  await page.keyboard.press('Control+Shift+z');assert.equal(ops(await backup()),2);assert(originalPixels.equals(await png()),'Switching tabs changed rendered PNG pixels');
  console.log('PASS independent drawings, undo/redo, active layers and zoom');
  await page.getByLabel('Close project Tab B',{exact:true}).click();
  const prompt=page.getByRole('dialog',{name:'Save changes before closing?',exact:true});await prompt.waitFor();await prompt.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await tabs.getByRole('tab').count(),2);
  await page.getByLabel('Close project Tab B',{exact:true}).click();await prompt.getByRole('button',{name:'Don’t Save',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[role=tab]').length===1);
  assert.equal(await page.getByRole('tab',{selected:true}).textContent(),'Tab A');assert.equal(ops(await backup()),2);
  console.log('PASS inactive tab close, Cancel and Don’t Save preserve active document');
  await page.locator('input[type=file][accept=".json,.solo.json"]').setInputFiles({name:'already-open.solo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixtures[0]))});assert.equal(await tabs.getByRole('tab').count(),1);assert.equal(ops(await backup()),2);
  console.log('PASS opening the same ID preserves the existing dirty tab');
  await page.evaluate(()=>window.failSaves=true);await page.getByLabel('Close project Tab A',{exact:true}).click();await prompt.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByText(/Save failed for/).waitFor();assert(await prompt.isVisible());assert(await prompt.getByRole('alert').isVisible());assert.equal(await tabs.getByRole('tab').count(),1);
  await page.evaluate(()=>window.failSaves=false);await prompt.getByRole('button',{name:'Save',exact:true}).click();
  await page.getByRole('heading',{name:'Project workspace',exact:true}).waitFor();assert.equal(await tabs.getByRole('tab').count(),0);
  assert.equal(await page.getByLabel('Close dialog',{exact:true}).count(),0);
  await page.getByRole('button',{name:/^Tab A Standalone scene/}).click();await page.getByRole('tab',{name:'Tab A',exact:true}).waitFor();assert.equal(ops(await backup()),2);
  assert(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled());
  console.log('PASS failed save retains tab; successful save closes to Home; reopened pixels/operations retained');
  await page.getByLabel('New project tab',{exact:true}).click();await page.getByRole('textbox',{name:'Project name',exact:true}).fill('Tab C');await page.getByRole('button',{name:'Create project',exact:true}).click();
  await page.getByRole('tab',{name:'Tab C (unsaved changes)',exact:true}).waitFor();assert.equal(await tabs.getByRole('tab').count(),2);
  await draw(0);await select('Tab A');await draw(1);
  assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  await page.evaluate(()=>window.saveBeforeClose());await page.waitForFunction(()=>window.closedAfterSave===1);
  const saved=await page.evaluate(async()=>{const {repository}=await import('/src/core/persistence.ts');return (await repository.list()).map(r=>({name:r.project.name,count:r.project.layers.reduce((n,l)=>n+l.operations.length,0)}));});
  assert(saved.some(r=>r.name==='Tab C'&&r.count===1));assert(saved.some(r=>r.name==='Tab A'&&r.count===3));
  assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),false);
  console.log('PASS window-close Save includes inactive dirty tab');
  fs.mkdirSync('validation',{recursive:true});await page.screenshot({path:'validation/desktop-project-tabs-v199.png'});
  assert.deepEqual(errors,[]);console.log('ALL PROJECT TAB CHECKS PASSED');
 }finally{await browser?.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

