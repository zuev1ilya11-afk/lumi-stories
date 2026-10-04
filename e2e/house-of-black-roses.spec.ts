import { expect, test, type Page } from '@playwright/test';
import raw from '../src/content/house-of-black-roses/season-1/episode-1.json' with { type: 'json' };
import { parseEpisode } from '../src/story/schema';
import { enumeratePaths } from '../src/story/validator';
import { getScenePresentation } from '../src/features/story/presentation';
import type { ProgressDto } from '../src/api/types';
import { installTelegram, signTelegramInitData } from './fixtures/telegram';
import { marker, step, zeroState } from './fixtures/story';
const episode = parseEpisode(raw);
const storyId = 'house-of-black-roses';
const paths = enumeratePaths(episode, zeroState);
const old: ProgressDto = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning', junhoScore: 5, taeyunScore: 2, truthScore: 4, riskScore: 1, flags: { first_impression: 'warm' } };
const seed = (sceneId = episode.startSceneId): ProgressDto => ({ storyId, seasonId: 'season-1', episodeId: episode.id, sceneId, ...structuredClone(zeroState) });
function stateStore() { return { progress: new Map<string, ProgressDto>([['last-online', structuredClone(old)]]), saves: [] as ProgressDto[], fail: false }; }
type Store = ReturnType<typeof stateStore>;
async function setup(page: Page, store: Store) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegram(page, await signTelegramInitData());
  await page.route('http://lumi.test/**', async route => {
    const r = route.request(); const url = new URL(r.url());
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS', 'Content-Type': 'application/json' };
    if (r.method() === 'OPTIONS') return route.fulfill({status:204,headers,body:''});
    let data: unknown;
    if (url.pathname.endsWith('/bootstrap')) data = { playerId:'p', telegramUserId:555111, season1Owned:false, season1PriceStars:149, progress:store.progress.get('last-online') };
    else if (url.pathname.endsWith('/progress')) {
      if (r.method() === 'PUT') {
        const dto = r.postDataJSON() as ProgressDto;
        store.saves.push(structuredClone(dto));
        if (store.fail) { store.fail=false; return route.fulfill({status:503,headers,body:JSON.stringify({error:'OFFLINE'})}); }
        store.progress.set(dto.storyId, structuredClone(dto));
        data={progress:dto};
      } else data={progress:store.progress.get(url.searchParams.get('storyId')!) ?? null};
    } else if(url.pathname.endsWith('/payments/status')) data = { season1Owned:false, priceStars:149, episodeRewindPriceStars:49, storyId, seasonId:'season-1' };
    else if(url.pathname.endsWith('/analytics')) return route.fulfill({status:204,headers,body:''});
    else return route.fulfill({status:404,headers,body:'{}'});
    return route.fulfill({status:200,headers,body:JSON.stringify(data)});
  });
}
async function library(page: Page, title='Дом чёрных роз') {
  await page.getByRole('button', {name:'Истории',exact:true}).click();
  await page.getByRole('button', {name:`Открыть историю «${title}»`,exact:true}).click();
}
async function open(page: Page) {
  await page.goto('/'); await library(page);
  await page.locator('.lumi-season').getByRole('button', {name:/^(Начать|Продолжить)$/}).click();
  await expect(page.locator('[data-scene-id]')).toBeVisible();
}
for(const a of [0,1,2]) for(const b of [0,1]) for(const c of [0,1]) {
  test(`Ravenhall complete path ${a}${b}${c} preserves separate saves`, async({page})=>{
    test.setTimeout(180_000);
    const route=[a,b,c]; const store=stateStore(); await setup(page,store);
    const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/assets/house-of-black-roses/')&&r.status()>=400)errors.push(r.url());});
    await open(page);
    const decisions=episode.scenes.filter(s=>s.choices?.length);
    const expected=paths.find(p=>decisions.every((s,i)=>p.sceneIds.includes(s.choices![route[i]].nextSceneId)))!;
    const visited=new Set<string>(); let retried=false; let reloaded=false;
    for(let i=0;i<260 && await marker(page)!=='offer';i++) {
      const id=(await page.locator('[data-scene-id]').getAttribute('data-scene-id'))!; visited.add(id);
      if(a===0&&b===0&&c===0&&id==='gothic_ep1_rules_choice'&&await page.locator('.lumi-choice').count()&&!retried){
        const before=structuredClone(store.progress.get(storyId));store.fail=true;
        await page.locator('.lumi-choice').nth(a).click();
        await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
        expect(store.progress.get(storyId)).toEqual(before);
        await page.getByRole('button',{name:'Повторить',exact:true}).click();
        await expect(page.locator('[data-scene-id]')).not.toHaveAttribute('data-scene-id',id);retried=true;
      } else if(a===0&&b===0&&c===0&&id==='gothic_ep1_room'&&!reloaded){
        const before=structuredClone(store.progress.get(storyId)); const count=store.saves.length;
        await page.reload(); await library(page); await page.locator('.lumi-season').getByRole('button',{name:'Продолжить',exact:true}).click();
        await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id',id);
        expect(store.progress.get(storyId)).toEqual(before);expect(store.saves).toHaveLength(count);reloaded=true;
      } else await step(page,route,episode);
    }
    await expect(page.getByText('Эпизод 1 завершён',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Продолжить: Западное крыло'})).toBeVisible();
    expect([...visited]).toEqual(expected.sceneIds);
    expect(store.progress.get(storyId)).toMatchObject({...expected.state,episodeId:episode.id,sceneId:'gothic_ep1_end'});
    expect(store.progress.get('last-online')).toEqual(old);
    expect(store.saves.every(s=>s.storyId===storyId&&s.seasonId==='season-1')).toBe(true);
    expect(store.saves.length).toBe(expected.sceneIds.length-1+(retried?1:0));
    expect(errors).toEqual([]);
    if(a===0&&b===0&&c===0){
      await page.getByRole('button',{name:'К сезону',exact:true}).click();
      await page.getByRole('button',{name:'Назад',exact:true}).click();
      await library(page,'Последний онлайн');
      await page.locator('.lumi-season').getByRole('button',{name:'Продолжить',exact:true}).click();
      await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id',old.sceneId);
      expect(store.progress.get('last-online')).toEqual(old);
      await page.getByRole('button',{name:'Меню',exact:true}).click();await page.getByRole('button',{name:'Назад',exact:true}).click();await library(page);
      await expect(page.locator('.lumi-episode').first()).toContainText('Завершён');
      expect(store.progress.get(storyId)?.sceneId).toBe('gothic_ep1_end');
    }
  });
}
const shots=new Map<string,{sceneId:string;index:number}>();
for(const s of episode.scenes) (s.beats??[]).forEach((b,index)=>{
  const art=getScenePresentation(s,b).cg!;
  if(!shots.has(art))shots.set(art,{sceneId:s.id,index});
});
for(const [width,height] of [[320,568],[360,740],[390,844],[430,932]]) {
 test(`Ravenhall every art and choice at ${width} with Telegram safe areas`,async({page})=>{
  test.setTimeout(240_000);
  await page.setViewportSize({width,height});
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.style.setProperty('--tg-content-safe-area-inset-top','24px');
    document.documentElement.style.setProperty('--tg-safe-area-inset-bottom','16px');
  }));
  const store=stateStore();await setup(page,store);
  await page.goto('/');
  await page.getByRole('button',{name:'Истории',exact:true}).click();
  for(const button of await page.locator('.lumi-start__nav button').all()){
    const box=(await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const card=page.getByRole('button',{name:'Открыть историю «Дом чёрных роз»',exact:true});
  await card.scrollIntoViewIfNeeded();
  const cardBox=(await card.boundingBox())!;
  const navBox=(await page.locator('.lumi-start__nav').boundingBox())!;
  expect(cardBox.y+cardBox.height).toBeLessThanOrEqual(navBox.y);
  await page.screenshot({path:`docs/visual-qa/screenshots/black-roses/${width}/library.png`});
  await card.click();
  await expect(page.locator('.lumi-episode')).toHaveCount(5);
  await expect(page.locator('.lumi-episode').first()).toContainText('Бесплатно');
  for(const future of await page.locator('.lumi-episode').all()){
    if(await future.getAttribute('disabled')!==null)await expect(future).toContainText('В разработке');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`docs/visual-qa/screenshots/black-roses/${width}/season.png`,fullPage:true});
  const samples=[...shots.entries()].map(([art,v])=>({...v,name:art.split('/').at(-1)!.replace('.webp','')}));
  const longest=episode.scenes.flatMap(s=>s.beats!.map((b,index)=>({sceneId:s.id,index,text:b.text}))).sort((a,b)=>b.text.length-a.text.length)[0];
  samples.push({...longest,name:'longest-text'});
  for(const s of episode.scenes.filter(s=>s.choices?.length))samples.push({sceneId:s.id,index:s.beats!.length-1,name:s.id+'-choices'});
  for(const {sceneId,index,name} of samples){
    store.progress.set(storyId,seed(sceneId)); await open(page);
    for(let i=0;i<index;i++)await step(page,[],episode);
    await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>(i as HTMLImageElement).decode())));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(await page.locator('.lumi-dialogue__copy').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    for(const button of await page.locator('button:not(.lumi-stage-tap)').all()){
      if(!await button.isVisible())continue;const box=(await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(24);expect(box.y+box.height).toBeLessThanOrEqual(height-16);
    }
    await page.screenshot({path:`docs/visual-qa/screenshots/black-roses/${width}/${name}.png`});
  }
 });
}
