import { expect, test } from '@playwright/test';
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './fixtures/telegram';

async function enterStory(page: import('@playwright/test').Page, initData: string, store: ReturnType<typeof createMockApiStore>) {
  await installTelegram(page, initData);
  await installMockLumiApi(page, store);
  await page.goto('/');
  await page.waitForTimeout(250);
  console.log('LUMI_E2E_BODY', await page.locator('body').innerText());
  console.log('LUMI_E2E_CONTEXT', await page.evaluate(() => ({
    href: location.href,
    initDataLength: window.Telegram?.WebApp?.initData?.length ?? 0,
    hasTelegram: Boolean(window.Telegram?.WebApp),
  })));
  await page.getByRole('button', { name: 'Начать историю' }).click({ timeout: 5_000 });
  await page.getByRole('button', { name: store.progress ? 'Продолжить' : 'Начать' }).click();
}

test('reopens the same Telegram player at saved server scene', async ({ browser }: { browser: any }) => {
  const store = createMockApiStore();
  const initData = await signTelegramInitData(700001);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let page = await context.newPage();
  await enterStory(page, initData, store);

  await page.locator('.lumi-dialogue__advance').click();
  await page.locator('.lumi-dialogue__advance').click();
  await expect(page.getByText('Чья-то рука удержала чемодан прежде, чем тот рухнул набок.')).toBeVisible();
  const savedScene = store.progress?.sceneId;
  expect(savedScene).toBe('ep1_first_meet');
  await page.close();

  page = await context.newPage();
  await enterStory(page, initData, store);
  await expect(page.getByText('Чья-то рука удержала чемодан прежде, чем тот рухнул набок.')).toBeVisible();
  expect(store.progress?.sceneId).toBe(savedScene);
  await context.close();
});

test('failed progress save keeps current scene and retry advances once', async ({ page }: { page: import('@playwright/test').Page }) => {
  const store = createMockApiStore();
  const initData = await signTelegramInitData(700002);
  await enterStory(page, initData, store);
  const initialText = 'Хансу встретил Леру дождём, светом рекламных экранов';
  await expect(page.getByText(new RegExp(initialText))).toBeVisible();

  store.failNextSave = true;
  await page.locator('.lumi-dialogue__advance').click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.getByText(new RegExp(initialText))).toBeVisible();
  expect(store.progress).toBeNull();

  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(store.progress?.sceneId).toBe('ep1_building');
  await expect(page.getByText(/Дом оказался тише улицы/)).toBeVisible();
});
