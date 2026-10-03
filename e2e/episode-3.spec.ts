import { expect, test } from '@playwright/test';
import raw from '../src/content/last-online/season-1/episode-3.json' with { type: 'json' };
import { parseEpisode } from '../src/story/schema';
import { enumeratePaths } from '../src/story/validator';
import { enterStory, episodeTwo, inheritedState, marker, seed, step } from './fixtures/story';

const episode = parseEpisode(raw);
const routes = [
  { name: 'Junho', choices: [2, 0, 0, 0, 0], state: { ep2_card_response: 'take', ep2_archive_partner: 'mina' }, junhoScore: 8, taeyunScore: 0 },
  { name: 'Taeyun', choices: [1, 1, 1, 1, 1], state: { ep2_card_response: 'send', ep2_archive_partner: 'taeyun' }, junhoScore: 0, taeyunScore: 8 },
  { name: 'Independent', choices: [0, 2, 2, 2, 2], state: { ep2_card_response: 'refuse', ep2_archive_partner: 'soa' }, junhoScore: 0, taeyunScore: 0 },
];
for (const route of routes) {
  test(`Episode 2 → 3: ${route.name}, choices, reload, final recap`, async ({ page }) => {
    test.setTimeout(120_000);
    const initial = { ...inheritedState(), junhoScore: route.junhoScore, taeyunScore: route.taeyunScore, flags: { ...inheritedState().flags, ...route.state } };
    const paths = enumeratePaths(episode, initial);
    const decisions = episode.scenes.filter(s => s.choices?.length);
    const expected = paths.find(p => decisions.every((s, i) => p.sceneIds.includes(s.choices![route.choices[i]].nextSceneId)))!;
    const store = seed('ep2_end', episodeTwo, initial);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().includes('/assets/last-online/') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await enterStory(page, store);
    while (await marker(page) !== 'offer') await step(page, [], episodeTwo);
    store.failNextSave = true;
    await page.getByRole('button', { name: 'Продолжить — Эпизод 3', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
    expect(store.progress?.episodeId).toBe('last-online-s1-e2');
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep3_elevator');
    expect(store.progress).toMatchObject({ ...initial, episodeId: episode.id });
    const visited = new Set<string>();
    let reloaded = false;
    let retried = false;
    for (let i = 0; i < 300 && await marker(page) !== 'offer'; i++) {
      const id = (await page.locator('[data-scene-id]').getAttribute('data-scene-id'))!;
      visited.add(id);
      if (id === 'ep3_soa_final') await expect(page.locator('.lumi-soa__thread')).toContainText('Ты уже выбрала не того.');
      if (id === 'ep3_restored' && !reloaded) {
        const before = structuredClone(store.progress);
        await page.reload();
        await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
        await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
        await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', id);
        expect(store.progress).toEqual(before);
        reloaded = true;
      }
      if (id === 'ep3_evidence_choice' && await page.locator('.lumi-choice').count() && !retried) {
        const before = structuredClone(store.progress);
        store.failNextSave = true;
        await page.locator('.lumi-choice').nth(route.choices[2]).click();
        await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
        expect(store.progress).toEqual(before);
        await page.getByRole('button', { name: 'Повторить', exact: true }).click();
        await expect(page.locator('[data-scene-id]')).not.toHaveAttribute('data-scene-id', id);
        retried = true;
      } else await step(page, route.choices, episode);
    }
    await expect(page.getByText('Эпизод 3 завершён', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Эпизод 4 в разработке' })).toBeVisible();
    expect([...visited]).toEqual(expected.sceneIds);
    expect(store.progress).toMatchObject({ ...expected.state, episodeId: episode.id, sceneId: 'ep3_end' });
    const saved = structuredClone(store.progress);
    const saveCount = store.saves.length;
    await page.getByRole('button', { name: 'К сезону', exact: true }).click();
    await page.getByRole('button', { name: /Эпизод 3:.*Краткая сводка/ }).click();
    await expect(page.getByRole('main', { name: 'Краткая сводка эпизода 3' })).toBeVisible();
    await expect(page.locator('.lumi-recap__events li')).toHaveCount(5);
    await page.getByRole('button', { name: 'Назад к эпизодам' }).click();
    expect(store.progress).toEqual(saved);
    expect(store.saves).toHaveLength(saveCount);
    expect(errors).toEqual([]);
  });
}

for (const [width, height] of [[320, 568], [390, 844]]) {
  test(`Episode 3 mobile artwork and choices at ${width}px`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    for (const id of ['ep3_public_choice', 'ep3_restored', 'ep3_evidence_choice', 'ep3_junho_close', 'ep3_taeyun_close', 'ep3_reply_choice', 'ep3_soa_final', 'ep3_end']) {
      const page = await context.newPage();
      await enterStory(page, seed(id, episode, inheritedState()));
      const scene = episode.scenes.find(s => s.id === id)!;
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
      await page.screenshot({ path: `docs/visual-qa/screenshots/episode-3/${width}/${id}.png` });
      await page.close();
    }
    await context.close();
  });
}
