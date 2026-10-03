import { expect, test } from '@playwright/test';
import raw from '../src/content/last-online/season-1/episode-5.json' with { type: 'json' };
import previousRaw from '../src/content/last-online/season-1/episode-4.json' with { type: 'json' };
import { parseEpisode } from '../src/story/schema';
import { enterStory, marker, seed, step } from './fixtures/story';

const episode = parseEpisode(raw);
const previous = parseEpisode(previousRaw);

const routes = [
  {
    name: 'Junho',
    choices: [0, 1, 0, 0, 0],
    state: { junhoScore: 12, taeyunScore: 3, truthScore: 12, riskScore: -1, flags: { ep4_trust: 'junho', ep4_soa_response: 'proof' } },
    terminal: 'ep5_end_junho',
  },
  {
    name: 'Taeyun',
    choices: [1, 1, 1, 1, 0],
    state: { junhoScore: 3, taeyunScore: 12, truthScore: 12, riskScore: 0, flags: { ep4_trust: 'taeyun', ep4_soa_response: 'limit' } },
    terminal: 'ep5_end_taeyun',
  },
  {
    name: 'Independent',
    choices: [2, 2, 2, 2, 0],
    state: { junhoScore: 4, taeyunScore: 4, truthScore: 15, riskScore: -2, flags: { ep4_trust: 'none', ep4_soa_response: 'silent' } },
    terminal: 'ep5_end_self',
  },
];

for (const route of routes) {
  test(`Episode 4 → 5 finale: ${route.name}`, async ({ page }) => {
    test.setTimeout(120_000);
    const store = seed('ep4_end', previous, route.state);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().includes('/assets/last-online/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await enterStory(page, store);
    while (await marker(page) !== 'offer') await step(page, [], previous);
    await page.getByRole('button', { name: 'Продолжить — Эпизод 5', exact: true }).click();
    await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep5_morning');

    let sawThanks = false;
    for (let i = 0; i < 400 && await marker(page) !== 'offer'; i += 1) {
      const sceneId = await page.locator('[data-scene-id]').getAttribute('data-scene-id');
      if (sceneId === 'ep5_last_message') {
        sawThanks = true;
        await expect(page.locator('.lumi-soa__thread')).toContainText('Спасибо.');
      }
      await step(page, route.choices, episode);
    }

    expect(sawThanks).toBe(true);
    expect(store.progress?.episodeId).toBe('last-online-s1-e5');
    expect(store.progress?.sceneId).toBe(route.terminal);
    await expect(page.getByText('Эпизод 5 завершён', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Сезон завершён' })).toBeVisible();

    const saved = structuredClone(store.progress);
    const saves = store.saves.length;
    await page.getByRole('button', { name: 'К сезону', exact: true }).click();
    await page.getByRole('button', { name: /Эпизод 5:.*Краткая сводка/ }).click();
    await expect(page.getByRole('main', { name: 'Краткая сводка эпизода 5' })).toBeVisible();
    await expect(page.locator('.lumi-recap__events li')).toHaveCount(5);
    await page.getByRole('button', { name: 'Назад к эпизодам' }).click();
    expect(store.progress).toEqual(saved);
    expect(store.saves).toHaveLength(saves);
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`Episode 5 key finale screens at ${width}px`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const state = { junhoScore: 12, taeyunScore: 3, truthScore: 12, riskScore: -1, flags: { ep4_trust: 'junho', ep4_soa_response: 'proof' } };
    for (const id of ['ep5_registry', 'ep5_han_question', 'ep5_sender_reveal', 'ep5_release_choice', 'ep5_last_message', 'ep5_future_choice', 'ep5_end_junho']) {
      const page = await context.newPage();
      await enterStory(page, seed(id, episode, state));
      const scene = episode.scenes.find(candidate => candidate.id === id)!;
      if (scene.choices) {
        while (!await page.locator('.lumi-choice').count()) await step(page, [], episode);
      }
      if (scene.kind === 'message') await expect(page.locator('.lumi-soa')).toHaveAttribute('data-chat-complete', 'true');
      await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const button of await page.locator('button:not(.lumi-stage-tap)').all()) {
        if (!await button.isVisible()) continue;
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      await page.close();
    }
    await context.close();
  });
}
