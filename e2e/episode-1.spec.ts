import { expect, test } from '@playwright/test';
import { enterStory, episode, marker, step } from './fixtures/story';
const routes = [
  { name: 'romance / trust', choices: [0,2,0,0,0] },
  { name: 'truth / risk', choices: [1,0,2,1,2] },
  { name: 'mixed', choices: [2,1,1,0,1] },
];
test('three complete routes cover all 44 scenes and every choice; all continue into Episode 2', async ({ page }) => {
  test.setTimeout(180_000);
  const reached=new Set<string>(); const chosen=new Set<string>(); const errors:string[]=[];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of routes) {
    const context=await page.context().browser()!.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const routePage=await context.newPage();
    routePage.on('pageerror', error => errors.push(error.message));
    routePage.on('response', response => { if (response.url().includes('/assets/last-online/') && response.status() >= 400) errors.push(response.url()); });
    const store=await enterStory(routePage);
    let attachment=false;
    for (let i=0;i<260 && await marker(routePage)!=='offer';i++) {
      const id=(await routePage.locator('[data-scene-id]').getAttribute('data-scene-id'))!;
      reached.add(id);
      const scene=episode.scenes.find(s=>s.id===id)!;
      if ('choices' in scene && await routePage.locator('.lumi-choice, .lumi-soa__replies button:not(.lumi-soa__skip):not(.lumi-soa__advance)').count()) {
        const branch=episode.scenes.filter(s=>'choices' in s).findIndex(s=>s.id===id);
        chosen.add(scene.choices![route.choices[branch]].id);
      }
      if (await routePage.getByRole('button',{name:'Открыть IMG_0317_old.jpg'}).isVisible()) {
        attachment=true; await routePage.getByRole('button',{name:'Открыть IMG_0317_old.jpg'}).click();
        await expect(routePage.getByRole('dialog')).toBeVisible();
        await routePage.getByRole('button',{name:'Закрыть фотографию'}).click();
      }
      await step(routePage,route.choices);
    }
    await expect(routePage.getByText('Эпизод 1 завершён'),route.name).toBeVisible();
    expect(store.progress?.sceneId).toBe('ep1_end_paywall');
    expect(attachment).toBe(true);
    expect(store.saves.length).toBeLessThan(45);
    await routePage.getByRole('button',{name:'Продолжить',exact:true}).click();
    await expect(routePage.locator('[data-scene-id]')).toHaveAttribute('data-scene-id','ep2_morning_after');
    expect(store.progress?.episodeId).toBe('last-online-s1-e2');
    expect(store.analytics).toEqual(expect.arrayContaining(['episode_started','scene_reached','choice_selected','episode_finished']));
    await context.close();
  }
  expect([...reached].sort()).toEqual(episode.scenes.map(s=>s.id).sort());
  expect(chosen.size).toBe(14);
  expect(errors).toEqual([]);
});
