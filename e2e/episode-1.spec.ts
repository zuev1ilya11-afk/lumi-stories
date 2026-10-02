import { expect, test } from '@playwright/test';
import { createMockApiStore, installMockLumiApi, installTelegram, signTelegramInitData } from './fixtures/telegram';

test('plays Episode 1 through SOA route to prototype paywall without unlocking paid chapters', async ({ page }: { page: import('@playwright/test').Page }) => {
  const store = createMockApiStore();
  const initData = await signTelegramInitData();
  await installTelegram(page, initData);
  await installMockLumiApi(page, store);
  await page.goto('/');

  await page.getByRole('button', { name: 'Начать историю' }).click();
  await page.getByRole('button', { name: 'Начать' }).click();

  let choseHide = false;
  let sawAttachment = false;
  for (let step = 0; step < 100; step += 1) {
    if (await page.getByText('История только начинается').isVisible().catch(() => false)) break;
    if (await page.getByRole('img', { name: 'Вложение от SOA' }).isVisible().catch(() => false)) sawAttachment = true;

    const hide = page.getByRole('button', { name: 'Скрыть сообщение' });
    if (await hide.isVisible().catch(() => false)) {
      choseHide = true;
      await hide.click();
    } else if (await page.locator('.lumi-choice:not(:disabled)').count()) {
      await page.locator('.lumi-choice:not(:disabled)').first().click();
    } else if (await page.locator('.lumi-soa__replies button:not(:disabled)').count()) {
      await page.locator('.lumi-soa__replies button:not(:disabled)').first().click();
    } else if (await page.locator('.lumi-dialogue__advance').count()) {
      await page.locator('.lumi-dialogue__advance').click();
    } else {
      throw new Error(`No actionable story control at step ${step}`);
    }
    await page.waitForTimeout(10);
  }

  await expect(page.getByText('История только начинается')).toBeVisible();
  expect(choseHide).toBe(true);
  expect(sawAttachment).toBe(true);
  await expect(page.getByText(/Эпизоды 2–5/)).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Покупка появится в полной версии')).toBeVisible();
  expect(store.analytics).toContain('purchase_clicked');
  expect(store.progress?.sceneId).toBe('ep1_end_paywall');
});
