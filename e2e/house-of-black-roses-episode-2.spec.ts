import { expect, test, type Page } from '@playwright/test';
import raw from '../src/content/house-of-black-roses/season-1/episode-2.json' with { type: 'json' };
import { parseEpisode } from '../src/story/schema';
import type { ProgressDto } from '../src/api/types';
import { installTelegram, signTelegramInitData } from './fixtures/telegram';
import { marker, step } from './fixtures/story';
const episode = parseEpisode(raw);
const storyId = 'house-of-black-roses';
const inherited = { junhoScore:2, taeyunScore:0, truthScore:4, riskScore:2, flags:{ gothic_rules_response:'question', gothic_opened_midnight_door:true, gothic_gallery_choice:'alone' } };
type Store = { progress: ProgressDto; saves: ProgressDto[] };
function makeStore(): Store { return { progress:{ storyId, seasonId:'season-1', episodeId:episode.id, sceneId:episode.startSceneId, ...structuredClone(inherited) }, saves:[] }; }
async function setup(page: Page, store: Store) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await installTelegram(page, await signTelegramInitData());
  await page.route('http://lumi.test/**', async route => {
    const request=route.request(); const url=new URL(request.url());
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Content-Type':'application/json'};
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers,body:''});
    if(url.pathname.endsWith('/bootstrap')) return route.fulfill({status:200,headers,body:JSON.stringify({playerId:'p',telegramUserId:555111,season1Owned:true,season1PriceStars:149,progress:null})});
    if(url.pathname.endsWith('/progress')) {
      if(request.method()==='PUT'){ store.progress=request.postDataJSON() as ProgressDto; store.saves.push(structuredClone(store.progress)); }
      return route.fulfill({status:200,headers,body:JSON.stringify({progress:store.progress})});
    }
    if(url.pathname.endsWith('/payments/status')) return route.fulfill({status:200,headers,body:JSON.stringify({season1Owned:true,priceStars:149,episodeRewindPriceStars:49,storyId,seasonId:'season-1'})});
    if(url.pathname.endsWith('/analytics')) return route.fulfill({status:204,headers,body:''});
    return route.fulfill({status:404,headers,body:'{}'});
  });
}
async function open(page: Page, store: Store) {
  await setup(page,store); await page.goto('/');
  await page.getByRole('button',{name:'Истории',exact:true}).click();
  await page.getByRole('button',{name:'Открыть историю «Дом чёрных роз»',exact:true}).click();
  await page.locator('.lumi-season').getByRole('button',{name:'Продолжить',exact:true}).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id',episode.startSceneId);
}
for(const route of [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,0]]) {
  test(`Ravenhall Episode 2 route ${route.join('')} reaches mirror warning with visible art`,async({page})=>{
    test.setTimeout(180_000); const store=makeStore(); const errors:string[]=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().includes('/assets/house-of-black-roses/')&&r.status()>=400) errors.push(r.url());});
    await open(page,store); const visited=new Set<string>();
    for(let i=0;i<360&&await marker(page)!=='offer';i++){
      const id=await page.locator('[data-scene-id]').getAttribute('data-scene-id');
      if(id){visited.add(id);await expect(page.locator('.lumi-story__backdrop')).toBeVisible();}
      await step(page,route,episode);
    }
    await expect(page.getByText('Эпизод 2 завершён',{exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Эпизод 3 в разработке'})).toBeVisible();
    for(const id of ['gothic_ep2_isabel_arrival','gothic_ep2_photos_reveal','gothic_ep2_lucian_meet','gothic_ep2_mirror']) expect(visited).toContain(id);
    expect(store.progress.sceneId).toBe('gothic_ep2_end'); expect(store.progress.episodeId).toBe(episode.id);
    expect(store.saves.length).toBeGreaterThan(20); expect(errors).toEqual([]);
  });
}
