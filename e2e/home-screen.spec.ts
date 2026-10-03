import { expect, test } from '@playwright/test';
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './fixtures/telegram';

test('approved LUMI home composition matches the art-backed mobile layout', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const store = createMockApiStore(true);

  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, store);

  const artResponse = page.waitForResponse(response =>
    response.url().includes('/assets/ui/lumi-home-bg-v2.webp') && response.ok(),
  );
  await page.goto('/');
  await artResponse;

  const home = page.locator('.lumi-start[data-tab="home"]');
  await expect(home).toBeVisible();
  await expect(page.locator('.lumi-start__hero-art')).toHaveCSS(
    'background-image',
    /lumi-home-bg-v2\.webp/,
  );

  const features = page.locator('.lumi-start__feature');
  await expect(features).toHaveCount(4);
  await expect(page.getByRole('button', { name: /(?:Начать|Продолжить) историю/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Навигация LUMI' })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const element of await page.locator('.lumi-start__feature, .lumi-start__cta, .lumi-start__nav').all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  }

  await page.screenshot({
    path: 'docs/visual-qa/screenshots/home/390x844.png',
    fullPage: false,
  });

  await context.close();
});
