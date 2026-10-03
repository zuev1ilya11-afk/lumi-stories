import { expect, test } from '@playwright/test';
import { enterStory, seed, step } from './fixtures/story';

const shots = [
  ['arrival', 'ep1_arrival'], ['first-meet', 'ep1_first_meet'], ['reveal-junho', 'ep1_reveal_junho'],
  ['soa-chat', 'ep1_soa_first_message'], ['pendant', 'ep1_after_soa_choice'], ['pendant-shock', 'ep1_noise_hall'],
  ['old-photo', 'ep1_old_photo'], ['photo-chat', 'ep1_soa_photo_intro'], ['junho-warning', 'ep1_junho_warning'], ['lera-choice', 'ep1_choice_first_impression'],
  ['mina', 'ep1_meet_mina'], ['junho-frightened', 'ep1_noise_hall'], ['paywall', 'ep1_end_paywall'],
];
for (const [width, height] of [[320, 568], [360, 740], [390, 844], [430, 932]]) {
  test(`mobile composition ${width}px`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    for (const [name, sceneId] of shots) {
      const page = await context.newPage();
      await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', '24px');
        document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', '16px');
      }));
      await enterStory(page, seed(sceneId));
      if (name === 'junho-warning' || name === 'junho-frightened') {
        await step(page); await step(page);
      }
      if (name === 'paywall') {
        while (!await page.locator('.lumi-paywall').count()) await step(page);
      } else if (name === 'lera-choice') {
        while (!await page.locator('.lumi-choice').count()) await step(page);
      }
      await page.locator('img').evaluateAll(images => Promise.all(images.map(img => (img as HTMLImageElement).decode())));
      await expect.poll(() => page.locator('img').evaluateAll(images => images.every(img => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const dialogue = page.locator('.lumi-dialogue');
      if (await dialogue.count()) {
        const bounds = (await dialogue.boundingBox())!;
        expect(bounds.height).toBeLessThanOrEqual(height * .35);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - 16);
        expect(await page.locator('.lumi-dialogue__copy').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      }
      for (const button of await page.locator('.lumi-choice, .lumi-soa__replies button, .lumi-primary').all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      await page.screenshot({ path: `docs/visual-qa/screenshots/${width}/${name}.png` });
      if (name === 'photo-chat') {
        await page.getByRole('button', { name: 'Открыть IMG_0317_old.jpg' }).click();
        await page.screenshot({ path: `docs/visual-qa/screenshots/${width}/photo-viewer.png` });
        await page.getByRole('button', { name: 'Увеличить фотографию' }).click();
        await expect(page.locator('.lumi-photo-viewer__image')).toHaveAttribute('data-zoom', 'true');
        await page.getByRole('button', { name: 'Закрыть фотографию' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      await page.close();
    }
    await context.close();
  });
}

test('normal motion allows instant line completion and chat delay skip', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await enterStory(page, seed('ep1_arrival'), false);
  await expect(page.locator('.lumi-dialogue')).toHaveAttribute('data-complete', 'false');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('.lumi-dialogue')).toHaveAttribute('data-complete', 'true');
  await expect(page.locator('[data-beat-index]')).toHaveAttribute('data-beat-index', '0');
  await step(page);
  await expect(page.locator('[data-beat-index]')).toHaveAttribute('data-beat-index', '1');
});
