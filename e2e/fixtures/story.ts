import { expect, type Page } from '@playwright/test';
import episode from '../../src/content/last-online/season-1/episode-1.json' with { type: 'json' };
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './telegram';
export { episode };
export async function enterStory(page: Page, store = createMockApiStore(), reduced = true) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, store);
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать историю', exact: true }).click();
  await page.getByRole('button', { name: store.progress && store.progress.sceneId !== episode.startSceneId ? 'Продолжить' : 'Начать', exact: true }).click();
  await expect(page.locator('[data-scene-id]')).toBeVisible();
  return store;
}
export async function marker(page: Page) {
  return page.evaluate(() => {
    if (document.querySelector('.lumi-paywall')) return 'offer';
    const s = document.querySelector('[data-scene-id]');
    return [s?.getAttribute('data-scene-id'), s?.getAttribute('data-beat-index'), document.querySelector('[data-complete]')?.getAttribute('data-complete'), document.querySelector('[data-chat-complete]')?.getAttribute('data-chat-complete')].join(':');
  });
}
export async function step(page: Page, route: number[] = [0, 0, 0, 0, 0]) {
  const before = await marker(page);
  const sceneId = await page.locator('[data-scene-id]').getAttribute('data-scene-id');
  const choices = page.locator('.lumi-choice, .lumi-soa__replies button:not(.lumi-soa__skip):not(.lumi-soa__advance)');
  if (await choices.count()) {
    const branch = episode.scenes.filter(s => 'choices' in s).findIndex(s => s.id === sceneId);
    await choices.nth(route[branch] ?? 0).click();
  } else {
    const skip = page.getByRole('button', { name: 'Показать сообщения', exact: true });
    if (await skip.isVisible()) await skip.click();
    else await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  }
  await expect.poll(() => marker(page)).not.toBe(before);
}
export function seed(sceneId: string) {
  const store = createMockApiStore();
  store.progress = { storyId: 'last-online', seasonId: 'season-1', episodeId: episode.id, sceneId, junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
  return store;
}
