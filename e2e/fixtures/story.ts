import { expect, type Page } from '@playwright/test';
import episode from '../../src/content/last-online/season-1/episode-1.json' with { type: 'json' };
import episodeTwoRaw from '../../src/content/last-online/season-1/episode-2.json' with { type: 'json' };
import { parseEpisode, type Episode, type StoryState } from '../../src/story/schema';
import { enumeratePaths } from '../../src/story/validator';
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './telegram';
export { episode };
export const episodeOne = parseEpisode(episode);
export const episodeTwo = parseEpisode(episodeTwoRaw);
export const zeroState: StoryState = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
const episodeOneFinals = enumeratePaths(episodeOne, zeroState);
export function inheritedState(route: 'trust' | 'investigation' | 'risk' = 'trust'): StoryState {
  const flags = {
    trust: { first_impression: 'warm', avoided_gossip: true, told_junho_soa: true, trusted_junho_warning: true, photo_called_junho: true },
    investigation: { first_impression: 'guarded', deep_scandal_search: true, hid_soa_message: true, evaded_junho: true, photo_saved: true },
    risk: { first_impression: 'cold', basic_scandal_search: true, replied_soa: true, evaded_junho: true, photo_replied_soa: true },
  }[route];
  const path = episodeOneFinals.find(candidate => candidate.terminal && candidate.sceneIds.at(-1) === 'ep1_end_paywall' && Object.entries(flags).every(([key, value]) => candidate.state.flags[key] === value));
  if (!path) throw new Error(`No actual Episode 1 ending for ${route}`);
  return structuredClone(path.state);
}
export async function enterStory(page: Page, store = createMockApiStore(), reduced = true) {
  if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, store);
  await page.goto('/');
  await page.getByRole('button', { name: /(?:Начать|Продолжить) историю/ }).click();
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
export async function step(page: Page, route: number[] = [0, 0, 0, 0, 0], storyEpisode: Episode = episodeOne) {
  const before = await marker(page);
  const sceneId = await page.locator('[data-scene-id]').getAttribute('data-scene-id');
  const choices = page.locator('.lumi-choice, .lumi-soa__replies button:not(.lumi-soa__skip):not(.lumi-soa__advance)');
  if (await choices.count()) {
    const branch = storyEpisode.scenes.filter(s => s.choices?.length).findIndex(s => s.id === sceneId);
    await choices.nth(route[branch] ?? 0).click();
  } else {
    const skip = page.getByRole('button', { name: 'Показать сообщения', exact: true });
    if (await skip.isVisible()) await skip.click();
    else await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  }
  await expect.poll(() => marker(page)).not.toBe(before);
}
export function seed(sceneId: string, storyEpisode: Episode = episodeOne, state: StoryState = zeroState) {
  const store = createMockApiStore();
  store.progress = { storyId: 'last-online', seasonId: 'season-1', episodeId: storyEpisode.id, sceneId, ...structuredClone(state) };
  return store;
}
