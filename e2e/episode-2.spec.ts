import { expect, test } from '@playwright/test';
import { enterStory, episode2, marker, seed, step } from './fixtures/story';
const routes=[
  {name:'trust Taeyun',choices:[0,0,0,0,0],flags:{photo_called_junho:true}},
  {name:'truth first',choices:[1,1,1,1,1],flags:{photo_replied_soa:true}},
  {name:'high risk',choices:[2,2,2,2,2],flags:{}},
];
test('Episode 2 carries Episode 1 state through all authored branches and reaches its cliffhanger', async ({ page }) => {
  test.setTimeout(180_000);
  const reached=new Set<string>(); const chosen=new Set<string>(); const errors:string[]=[];
  for (const route of routes) {
    const context=await page.context().browser()!.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const routePage=await context.newPage();
    routePage.on('pageerror', error=>errors.push(error.message));
    routePage.on('response', response=>{ if(response.url().includes('/assets/last-online/')&&response.status()>=400) errors.push(response.url()); });
    const store=await enterStory(routePage,seed('ep2_morning_after',{junhoScore:2,truthScore:2,riskScore:1,flags:route.flags}));
    for(let i=0;i<260 && await marker(routePage)!=='offer';i++){
      const id=(await routePage.locator('[data-scene-id]').getAttribute('data-scene-id'))!;
      reached.add(id);
      const scene=episode2.scenes.find(candidate=>candidate.id===id)!;
      if('choices' in scene && await routePage.locator('.lumi-choice, .lumi-soa__replies button:not(.lumi-soa__skip):not(.lumi-soa__advance)').count()){
        const branch=episode2.scenes.filter(candidate=>'choices' in candidate).findIndex(candidate=>candidate.id===id);
        chosen.add(scene.choices![route.choices[branch]].id);
      }
      await step(routePage,route.choices);
    }
    await expect(routePage.getByText('История только начинается')).toBeVisible();
    expect(store.progress?.sceneId).toBe('ep2_end');
    expect(store.progress?.junhoScore).toBeGreaterThanOrEqual(2);
    expect(store.saves.length).toBeLessThan(45);
    await context.close();
  }
  expect([...reached].sort()).toEqual(episode2.scenes.map(scene=>scene.id).sort());
  expect(chosen.size).toBe(15);
  expect(errors).toEqual([]);
});
