import { expect, test } from '@playwright/test';
import { episodeOne, episodeTwo, inheritedState, marker, seed, step, zeroState } from './fixtures/story';
import { installMockLumiApi, installTelegram, signTelegramInitData } from './fixtures/telegram';

test('free public season continues without Stars and preserves earlier decisions', async ({ page }) => {
  const store = seed('ep1_end_paywall', episodeOne, inheritedState());
  store.season1PriceStars = 0;
  store.episodeRewindPriceStars = 49;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, store);
  await page.goto('/');
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await expect(page.getByText('Эпизоды 1–5 бесплатно')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
  await expect(page.getByText('Первый сезон — бесплатно. Эпизоды 1–5 открываются по мере выхода.')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  while (await marker(page) !== 'offer') await step(page);
  await expect(page.getByRole('button', { name: /Купить/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Продолжить — Эпизод 2' }).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep2_morning');
  expect(store.progress).toMatchObject({ ...inheritedState(), episodeId: 'last-online-s1-e2' });
});

test('personal free replay confirms before changing progress and opens without invoice UI', async ({ page }) => {
  const store = seed('ep2_end', episodeTwo, inheritedState());
  store.season1PriceStars = 0;
  store.episodeRewindPriceStars = 0;
  const before = structuredClone(store.progress);
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, store);
  let rewinds = 0;
  let failedFirstStatus = false;
  await page.route('http://lumi.test/payments/rewind/*', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ episodeId: 'last-online-s1-e1', allowFreeRewind: true });
      rewinds++;
      store.progress = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e1', sceneId: 'ep1_arrival', ...zeroState };
    } else if (!failedFirstStatus) {
      failedFirstStatus = true;
      await route.fulfill({ status: 503, headers, json: { error: 'TEMPORARY_FAILURE' } });
      return;
    }
    await route.fulfill({ headers, json: { episodeId: 'last-online-s1-e1', priceStars: 0, applied: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
  await page.getByRole('button', { name: /Эпизод 1:.*Краткая сводка/ }).click();
  await page.getByRole('button', { name: 'Изменить события — бесплатно' }).click();
  expect(store.progress).toEqual(before);
  expect(rewinds).toBe(0);
  await page.getByRole('button', { name: 'Начать заново бесплатно' }).click();
  await expect.poll(() => rewinds).toBe(1);
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep1_arrival');
  expect(rewinds).toBe(1);
  expect(store.progress).toMatchObject({ episodeId: 'last-online-s1-e1', sceneId: 'ep1_arrival', ...zeroState });
});
