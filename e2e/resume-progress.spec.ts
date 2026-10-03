import { expect, test } from '@playwright/test';
import { createMockApiStore } from './fixtures/telegram';
import { enterStory, step } from './fixtures/story';

test('resumes the saved logical scene with local beat zero', async ({ browser }) => {
  const store = createMockApiStore();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  let page = await context.newPage();
  await enterStory(page, store);
  while (await page.locator('[data-scene-id]').getAttribute('data-scene-id') !== 'ep1_first_meet') await step(page);
  await step(page); // Beat 1 remains client-side.
  expect(store.progress?.sceneId).toBe('ep1_first_meet');
  await page.close();
  page = await context.newPage();
  await enterStory(page, store);
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep1_first_meet');
  await expect(page.locator('[data-beat-index]')).toHaveAttribute('data-beat-index', '0');
  await context.close();
});

test('failed save preserves final beat and retry advances exactly once', async ({ page }) => {
  const store = await enterStory(page);
  const stage = page.locator('[data-scene-id]');
  const count = Number(await stage.getAttribute('data-beat-count'));
  for (let i = 1; i < count; i++) await step(page);
  const text = await page.locator('.lumi-dialogue__copy').innerText();
  store.failNextSave = true;
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(stage).toHaveAttribute('data-scene-id', 'ep1_arrival');
  expect(await page.locator('.lumi-dialogue__copy').innerText()).toBe(text);
  expect(store.progress).toBeNull();
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(stage).toHaveAttribute('data-scene-id', 'ep1_building');
  expect(store.saves).toEqual(['ep1_building']);
});
