import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {parkWheel} from './workspace';
import {sequences,levels} from '../fixtures/drawingSequences';

test('browser mouse automation draws 30 circles, 20 S curves, 20 hair arcs and V/Z across control levels',async({page})=>{
 test.setTimeout(180000);await page.goto('/');await parkWheel(page);await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await page.evaluate(()=>(window as any).soloStrokeDiagnostics.start());
 const box=(await page.getByLabel('Drawing canvas',{exact:true}).boundingBox())!,zoom=Math.min((box.width-90)/1920,(box.height-90)/1080),at=(p:{x:number;y:number})=>({x:box.x+(box.width-1920*zoom)/2+p.x*zoom,y:box.y+(box.height-1080*zoom)/2+p.y*zoom}),evidence:any[]=[];
 for(const [name,count] of [['circle13',30],['fastS',20],['hair5',20],['v3',5],['z4',5]] as const){
  for(let run=0;run<count;run++){
   const level=levels[run%5];await page.getByRole('slider',{name:'Smoothness',exact:true}).fill(String(level));await page.getByRole('slider',{name:'Stabilization',exact:true}).fill(String(level));const points=sequences[name],start=at(points[0]);await page.mouse.move(start.x,start.y);await page.mouse.down();for(const p of points.slice(1)){const q=at(p);await page.mouse.move(q.x,q.y);}await page.mouse.up();
   const trace=await page.evaluate(()=>(window as any).soloStrokeDiagnostics.export().traces.at(-1));expect(trace.reason).toBe('release');expect(trace.source.length).toBeGreaterThanOrEqual(points.length);expect(trace.settings.smoothness).toBe(level);expect(trace.settings.stabilization).toBe(level/100);const end=trace.geometry.points.at(-1);expect(Math.hypot(end.x-points.at(-1)!.x,end.y-points.at(-1)!.y)).toBeLessThan(4);const xs=trace.geometry.points.map((p:any)=>p.x),ys=trace.geometry.points.map((p:any)=>p.y),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);expect(width).toBeGreaterThan(100);expect(height).toBeGreaterThan(100);evidence.push({name,run,level,samples:trace.source.length,width,height,reason:trace.reason});
  }
 }
 fs.writeFileSync('validation/correction2-mouse-automation.json',JSON.stringify({method:'Playwright browser mouse input; no physical human mouse or tablet test',cases:evidence},null,2));await page.screenshot({path:'validation/correction2-mouse-workspace.png'});
});
