import { expect, test } from '@playwright/test';
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './fixtures/telegram';

test('collapsed Telegram viewport keeps CTA and navigation separate while content scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, createMockApiStore());
  await page.goto('/');
  await expect(page.locator('.lumi-start__cta')).toBeVisible();
  await page.evaluate(() => {
    const style = document.documentElement.style;
    style.setProperty('--tg-viewport-stable-height', '340px');
    style.setProperty('--tg-safe-area-inset-top', '24px');
    style.setProperty('--tg-content-safe-area-inset-top', '32px');
    style.setProperty('--tg-safe-area-inset-bottom', '34px');
  });
  const cta = (await page.locator('.lumi-start__cta').boundingBox())!;
  const nav = (await page.locator('.lumi-start__nav').boundingBox())!;
  expect(cta.y + cta.height + 10).toBeLessThanOrEqual(nav.y);
  expect(nav.y + nav.height).toBeLessThanOrEqual(306);
  const scroll = page.getByRole('region', { name: 'Главный экран LUMI' });
  await scroll.focus();
  await expect(scroll).toBeFocused();
  await page.keyboard.press('End');
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const last = page.locator('.lumi-start__feature').last();
  await last.scrollIntoViewIfNeeded();
  const box = (await last.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(cta.y - 10);
  expect(box.y).toBeGreaterThanOrEqual(56);
});

for (const [width, height] of [[320, 568], [360, 740], [390, 844], [430, 932]]) {
  for (const safe of [false, true]) {
    test(`home, tabs and safe navigation at ${width}x${height}${safe ? ' Telegram' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await installTelegram(page, await signTelegramInitData());
      const store = createMockApiStore(); store.season1PriceStars = 0;
      await installMockLumiApi(page, store);
      await page.goto('/');
      await expect(page.locator('.lumi-start__cta')).toBeVisible();
      if (safe) await page.evaluate(() => {
        document.documentElement.style.setProperty('--tg-safe-area-inset-top', '24px');
        document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', '32px');
        document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', '34px');
      });
      const cta = page.locator('.lumi-start__cta');
      const nav = page.getByRole('navigation', { name: 'Навигация LUMI' });
      const ctaBox = (await cta.boundingBox())!;
      const navBox = (await nav.boundingBox())!;
      expect(ctaBox.height).toBeGreaterThanOrEqual(52);
      expect(ctaBox.y + ctaBox.height + 10).toBeLessThanOrEqual(navBox.y);
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(height - (safe ? 34 : 0));
      const heights: number[] = [];
      for (const card of await page.locator('.lumi-start__feature').all()) {
        await expect(card.locator('small')).toBeVisible();
        heights.push((await card.boundingBox())!.height);
        if (!safe || width >= 360) {
          const box = (await card.boundingBox())!;
          const scroll = (await page.locator('.lumi-start__home-scroll').boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(scroll.y + scroll.height);
        }
      }
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
      for (const button of await nav.getByRole('button').all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
      await page.screenshot({ path: `docs/visual-qa/screenshots/home/${width}x${height}${safe ? '-telegram' : ''}.png` });
      if (safe && width === 320) {
        const last = page.locator('.lumi-start__feature').last();
        await last.scrollIntoViewIfNeeded();
        const box = (await last.boundingBox())!;
        expect(box.y + box.height + 10).toBeLessThanOrEqual(ctaBox.y);
        expect(await cta.boundingBox()).toEqual(ctaBox);
        await page.screenshot({ path: 'docs/visual-qa/screenshots/home/320x568-telegram-scrolled.png' });
      }
      for (const tab of ['Истории', 'Профиль', 'Настройки']) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        await expect(page.getByRole('region', { name: tab, exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await nav.boundingBox())!.y).toBe(navBox.y);
        if (tab === 'Истории') {
          const roses = page.getByRole('button', { name: 'Открыть историю «Дом чёрных роз»' });
          await roses.scrollIntoViewIfNeeded();
          const box = (await roses.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(navBox.y);
        }
        if (width === 390 || width === 320) await page.screenshot({ path: `docs/visual-qa/screenshots/home/${width}-${tab}${safe ? '-telegram' : ''}.png` });
        await page.getByRole('button', { name: 'На главный экран' }).click();
        await expect(cta).toBeVisible();
      }
      expect(store.saves).toEqual([]);
    });
  }
}

test('motion really stops including pseudo-elements and persists across season navigation', async ({ page }) => {
  await installTelegram(page, await signTelegramInitData());
  await installMockLumiApi(page, createMockApiStore());
  await page.goto('/');
  const home = page.locator('.lumi-start');
  await expect(home).toBeVisible();
  expect(await home.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  const before = await page.locator('.lumi-start__cta').boundingBox();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: /Анимации интерфейса/ }).click();
  await page.getByRole('button', { name: 'На главный экран' }).click();
  expect(await home.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  expect(await page.locator('.lumi-start__cta').boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Начать историю' }).click();
  await expect(page.locator('.lumi-season')).toHaveAttribute('data-story-id', 'last-online');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  expect(await home.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  await page.reload();
  await expect(home).toHaveClass(/is-calm/);
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: /Анимации интерфейса/ }).click();
  await page.getByRole('button', { name: 'На главный экран' }).click();
  expect(await home.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await home.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test('home and profile resume the saved episode without a write, and both catalog stories open', async ({ page }) => {
  await installTelegram(page, await signTelegramInitData());
  const store = createMockApiStore();
  store.progress = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning', junhoScore: 2, taeyunScore: 1, truthScore: 3, riskScore: 0, flags: { first_impression: 'warm' } };
  const saved = structuredClone(store.progress);
  await installMockLumiApi(page, store);
  // The second story has no saved progress; its read must remain story-scoped.
  await page.route('http://lumi.test/progress?**', async route => {
    if (new URL(route.request().url()).searchParams.get('storyId') !== 'house-of-black-roses') return route.fallback();
    await route.fulfill({ json: { progress: null }, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
  await expect(page.locator('.lumi-season')).toHaveAttribute('data-story-id', 'last-online');
  await expect(page.locator('[data-episode-id="last-online-s1-e2"]')).toContainText('Текущий эпизод');
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Лера' })).toBeVisible();
  await expect(page.getByText('Эпизод 2 · в процессе')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('[data-scene-id="ep2_morning"]')).toBeVisible();
  await page.getByRole('button', { name: 'Меню', exact: true }).click();
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  for (const [title, id] of [['Дом чёрных роз', 'house-of-black-roses'], ['Последний онлайн', 'last-online']]) {
    await page.getByRole('button', { name: 'Истории', exact: true }).click();
    await page.getByRole('button', { name: `Открыть историю «${title}»`, exact: true }).click();
    await expect(page.locator('.lumi-season')).toHaveAttribute('data-story-id', id);
    await page.getByRole('button', { name: 'Назад', exact: true }).click();
  }
  expect(store.progress).toEqual(saved);
  expect(store.saves).toEqual([]);
});

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
