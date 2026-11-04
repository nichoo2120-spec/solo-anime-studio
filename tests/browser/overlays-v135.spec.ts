import {test,expect} from '@playwright/test';

test('onion and flipbook zoom paints coalesce, remain aligned and clear when disabled',async({page})=>{
 await page.goto('/');const result=await page.evaluate(async()=>{
  const {newProject,newLayer}=await import('/src/core/model.ts'),{OnionSkinOverlay}=await import('/src/engine/OnionSkinOverlay.ts'),{FlipbookOverlay}=await import('/src/engine/FlipbookOverlay.ts'),{DEFAULT_ONION_SETTINGS}=await import('/src/animation/onionSkin.ts');
  const p=newProject('Overlay navigation',300,200),layer=newLayer('Paint');p.layers=[layer];p.activeLayerId=layer.id;
  const stroke:any={id:'ghost',kind:'stroke',tool:'brush',engineVersion:10,brushKind:'technical',size:20,pressure:false,opacity:1,color:'#446688',response:1,points:[{x:40,y:80,p:1},{x:200,y:80,p:1}]};
  p.animation={version:1,activeFrameId:'second',frames:[{id:'first',drawings:{[layer.id]:[stroke]}},{id:'second',drawings:{[layer.id]:[]}}]};
  const host=document.createElement('div');document.body.append(host);const onion:any=new OnionSkinOverlay(host,p,()=>false),flip:any=new FlipbookOverlay(host,p,()=>false),wait=()=>new Promise(requestAnimationFrame),view={x:0,y:0,zoom:1,rotation:0};
  onion.setView(view,400,300,1);flip.setView(view,400,300,1);flip.preview(-1);
  const hasAlpha=(canvas:HTMLCanvasElement)=>{const a=canvas.getContext('2d')!.getImageData(0,0,400,300).data;return a.some((v,i)=>i%4===3&&v>0);};
  const deadline=performance.now()+5000;while((!hasAlpha(onion.surface)||!hasAlpha(flip.surface))&&performance.now()<deadline)await wait();
  const visible=[hasAlpha(onion.surface),hasAlpha(flip.surface)],counts=[0,0];for(const [i,overlay]of [onion,flip].entries()){const ctx=overlay.surface.getContext('2d'),clear=ctx.clearRect.bind(ctx);ctx.clearRect=(...a:any[])=>{counts[i]++;clear(...a);};}
  for(let i=0;i<24;i++){const v={x:20,y:10,zoom:1.5,rotation:0};onion.setView(v,400,300,1);flip.setView(v,400,300,1);}const immediate=[...counts],current=onion.view.zoom===1.5&&flip.view.zoom===1.5;await wait();
  const coalesced=[...counts],aligned=onion.surface.getContext('2d').getImageData(140,130,1,1).data[3]>0;
  onion.setSettings({...DEFAULT_ONION_SETTINGS,enabled:false});flip.preview(null);const cleared=[!hasAlpha(onion.surface),!hasAlpha(flip.surface)],disabledCounts=[...counts];
  for(let i=0;i<24;i++){onion.setView({...view,x:i},400,300,1);flip.setView({...view,x:i},400,300,1);}await wait();const inactive=[...counts];
  // Default-enabled onions without neighboring drawings should also stay idle.
  const blank:any=new OnionSkinOverlay(host,newProject('Blank',300,200),()=>false);blank.setView(view,400,300,1);let blankClears=0;const ctx=blank.surface.getContext('2d'),clear=ctx.clearRect.bind(ctx);ctx.clearRect=(...a:any[])=>{blankClears++;clear(...a);};for(let i=0;i<24;i++)blank.setView({...view,x:i},400,300,1);await wait();
  onion.dispose();flip.dispose();blank.dispose();host.remove();return {visible,immediate,current,coalesced,aligned,cleared,disabledCounts,inactive,blankClears};
 });expect(result.visible).toEqual([true,true]);expect(result.immediate).toEqual([0,0]);expect(result.current).toBe(true);expect(result.coalesced).toEqual([1,1]);expect(result.aligned).toBe(true);expect(result.cleared).toEqual([true,true]);expect(result.inactive).toEqual(result.disabledCounts);expect(result.blankClears).toBe(0);
});
