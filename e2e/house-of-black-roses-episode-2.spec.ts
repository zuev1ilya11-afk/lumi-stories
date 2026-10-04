import { expect, test, type Page } from '@playwright/test';
import raw from '../src/content/house-of-black-roses/season-1/episode-2.json' with { type: 'json' };
import firstRaw from '../src/content/house-of-black-roses/season-1/episode-1.json' with { type: 'json' };
import { parseEpisode } from '../src/story/schema';
import { enumeratePaths } from '../src/story/validator';
import type { ProgressDto } from '../src/api/types';
import { installTelegram, signTelegramInitData } from './fixtures/telegram';
import { marker, step } from './fixtures/story';
const episode = parseEpisode(raw);
const storyId = 'house-of-black-roses';
const inherited = { junhoScore:2, taeyunScore:0, truthScore:4, riskScore:2, flags:{ gothic_rules_response:'question', gothic_opened_midnight_door:true, gothic_gallery_choice:'alone' } };
type Store = { progress: ProgressDto; saves: ProgressDto[]; fail: boolean };
function makeStore(sceneId=episode.startSceneId): Store { return { progress:{ storyId, seasonId:'season-1', episodeId:episode.id, sceneId, ...structuredClone(inherited) }, saves:[], fail:false }; }
async function setup(page: Page, store: Store, reduced=true) {
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await installTelegram(page, await signTelegramInitData());
  await page.route('http://lumi.test/**', async route => {
    const request=route.request(); const url=new URL(request.url());
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Content-Type':'application/json'};
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers,body:''});
    if(url.pathname.endsWith('/bootstrap')) return route.fulfill({status:200,headers,body:JSON.stringify({playerId:'p',telegramUserId:555111,season1Owned:true,season1PriceStars:149,progress:null})});
    if(url.pathname.endsWith('/progress')) {
      if(request.method()==='PUT') {
        const dto=request.postDataJSON() as ProgressDto;
        if(store.fail) { store.fail=false; return route.fulfill({status:503,headers,body:JSON.stringify({error:'OFFLINE'})}); }
        store.progress=dto; store.saves.push(structuredClone(dto));
      }
      return route.fulfill({status:200,headers,body:JSON.stringify({progress:store.progress})});
    }
    if(url.pathname.endsWith('/payments/status')) return route.fulfill({status:200,headers,body:JSON.stringify({season1Owned:true,priceStars:249,episodeRewindPriceStars:49,storyId,seasonId:'season-1'})});
    if(url.pathname.endsWith('/analytics')) return route.fulfill({status:204,headers,body:''});
    return route.fulfill({status:404,headers,body:'{}'});
  });
}
async function open(page: Page, store: Store) {
  await page.goto('/');
  await page.getByRole('button',{name:'Истории',exact:true}).click();
  await page.getByRole('button',{name:'Открыть историю «Дом чёрных роз»',exact:true}).click();
  await expect(page.locator('.lumi-episode').nth(1)).not.toContainText('В разработке');
  await page.locator('.lumi-season').getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id',store.progress.sceneId);
}
async function layout(page: Page, height: number) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.lumi-dialogue__copy').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  for(const button of await page.locator('button:not(.lumi-stage-tap)').all()) {
    if(!await button.isVisible()) continue;
    const box=(await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(height);
  }
}
const routes = [
  {name:'A trust', route:[2,0,1,2,0,1], scores:{junhoScore:6,taeyunScore:1,truthScore:8,riskScore:2}},
  {name:'B suspicious and high risk', route:[1,2,0,1,1,0], scores:{junhoScore:1,taeyunScore:0,truthScore:8,riskScore:9}},
  {name:'C independent investigation', route:[0,1,2,0,2,0], scores:{junhoScore:4,taeyunScore:1,truthScore:10,riskScore:4}},
];
for(const {name,route,scores} of routes) {
  test(`Ravenhall Episode 2 ${name} preserves exact decisions and saves`,async({page})=>{
    test.setTimeout(180_000); const store=makeStore(); const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/assets/house-of-black-roses/')&&r.status()>=400) errors.push(r.url());});
    await setup(page,store); await open(page,store);
    const decisions=episode.scenes.filter(s=>s.choices?.length);
    const expected=enumeratePaths(episode,inherited).find(p=>decisions.every((s,i)=>p.sceneIds.includes(s.choices![route[i]].nextSceneId)))!;
    const visited=new Set<string>(); let reloaded=false, retried=false;
    for(let i=0;i<460&&await marker(page)!=='offer';i++){
      const id=(await page.locator('[data-scene-id]').getAttribute('data-scene-id'))!;
      if(!visited.has(id)) await expect(page.locator('.lumi-story__backdrop.is-loaded')).toBeVisible();
      visited.add(id);
      if(name.startsWith('A')&&id==='gothic_ep2_isabel_choice'&&await page.locator('.lumi-choice').count()&&!retried){
        const before=structuredClone(store.progress); const count=store.saves.length; store.fail=true;
        await page.locator('.lumi-choice').nth(route[1]).click();
        await expect(page.getByRole('alert')).toBeVisible();
        expect(store.progress).toEqual(before); expect(store.saves).toHaveLength(count);
        const retry=page.getByRole('button',{name:'Повторить',exact:true});
        if(await retry.isVisible()) await retry.click(); else await page.locator('.lumi-choice').nth(route[1]).click();
        await expect(page.locator('[data-scene-id]')).not.toHaveAttribute('data-scene-id',id); retried=true;
      } else if(name.startsWith('A')&&id==='gothic_ep2_diary_core'&&!reloaded){
        const before=structuredClone(store.progress), count=store.saves.length;
        await open(page,store);
        expect(store.progress).toEqual(before); expect(store.saves).toHaveLength(count); reloaded=true;
      } else {
        const index=await page.locator('[data-scene-id]').getAttribute('data-beat-index');
        const count=store.saves.length;
        await step(page,route,episode);
        if(await marker(page)!=='offer'&&await page.locator('[data-scene-id]').getAttribute('data-scene-id')===id){
          expect(await page.locator('[data-scene-id]').getAttribute('data-beat-index')).not.toBe(index);
          expect(store.saves).toHaveLength(count); // beats never save
        }
      }
    }
    await expect(page.getByText('Эпизод 2 завершён',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Эпизод 3 в разработке'})).toBeVisible();
    expect([...visited]).toEqual(expected.sceneIds);
    expect(store.progress).toMatchObject({...expected.state,...scores,sceneId:'gothic_ep2_end',episodeId:episode.id});
    expect(store.progress.flags).toMatchObject(inherited.flags);
    expect(store.saves).toHaveLength(expected.sceneIds.length-1);
    expect(errors).toEqual([]);
  });
}

test('Ravenhall Episode 1 → 2 saves once and reloads without losing inherited choices',async({page})=>{
  const store=makeStore('gothic_ep1_end');
  const first=parseEpisode(firstRaw);
  store.progress.episodeId=first.id;
  await setup(page,store); await open(page,store);
  for(let i=0;i<30&&await marker(page)!=='offer';i++) await step(page,[],first);
  const before=structuredClone(store.progress);
  await page.getByRole('button',{name:'Продолжить — Эпизод 2',exact:true}).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id',episode.startSceneId);
  expect(store.saves).toHaveLength(1);
  expect(store.progress).toEqual({...before,episodeId:episode.id,sceneId:episode.startSceneId});
  await open(page,store); expect(store.saves).toHaveLength(1);
});

const samples=[['after_portrait',0],['isabel_arrival',0],['photos_reveal',1],['west_alone',0],['diary_core',2],['lucian_meet',0],['mirror',2],['end',1]] as const;
for(const [width,height] of [[320,568],[390,844],[430,932]]) {
  test(`Ravenhall E2 key art, choices and mirror at ${width}×${height}`,async({page})=>{
    test.setTimeout(120_000); await page.setViewportSize({width,height});
    const store=makeStore(); await setup(page,store);
    const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
    for(const [name,index] of samples){
      store.progress.sceneId='gothic_ep2_'+name;
      await open(page,store);
      for(let i=0;i<index;i++) await step(page,[],episode);
      await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode())));
      await layout(page,height);
      // Selected key scenes only; extra small-screen evidence checks keep clues readable.
      if(width===390 || (width===320&&['end','photos_reveal','diary_core'].includes(name)) || (width===430&&name==='lucian_meet'))
        await page.screenshot({path:`test-results/roses-e2-${width}-${name}.png`});
    }
    for(const scene of episode.scenes.filter(s=>s.choices?.length)){
      store.progress.sceneId=scene.id; await open(page,store);
      for(let i=1;i<scene.beats!.length;i++) await step(page,[],episode);
      await expect(page.locator('.lumi-choice')).toHaveCount(scene.choices!.length);
      await layout(page,height);
    }
    expect(errors).toEqual([]);
  });
}

test('Ravenhall mirror animates gently and reduced motion reveals text on the next beat',async({page})=>{
  const store=makeStore('gothic_ep2_end'); await setup(page,store,false); await open(page,store);
  const warning=page.locator('.lumi-rose-mirror-warning');
  await expect(warning).toHaveCSS('animation-name','lumi-rose-writing');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(warning).toBeHidden();
  await expect(warning).toHaveCSS('animation-name','none');
  await page.getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(warning).toHaveAttribute('data-revealed','true');
  await expect(warning).toBeVisible();
  expect(store.saves).toHaveLength(0);
});
