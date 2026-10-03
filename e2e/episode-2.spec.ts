import { expect, test, type Page } from '@playwright/test';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from '../src/story/engine';
import type { StoryState } from '../src/story/schema';
import type { ProgressDto } from '../src/api/types';
import { enterStory, episodeOne, episodeTwo, inheritedState, marker, seed, step } from './fixtures/story';
import type { MockApiStore } from './fixtures/telegram';

const routes = [
  { name: 'trust / romance', inheritance: 'trust', choices: [0, 0, 0, 0, 0] },
  { name: 'investigation', inheritance: 'investigation', choices: [1, 1, 1, 2, 2] },
  { name: 'risk / mystery', inheritance: 'risk', choices: [2, 2, 2, 1, 1] },
] as const;
const criticalScenes = ['ep2_morning', 'ep2_event', 'ep2_recognized', 'ep2_last_call', 'ep2_soa_incoming', 'ep2_soa_outgoing', 'ep2_archive_permission', 'ep2_archive_0226', 'ep2_archive_reflection', 'ep2_rooftop', 'ep2_soa_door', 'ep2_card_intro', 'ep2_card_choice', 'ep2_lift_checkpoint', 'ep2_confrontation', 'ep2_end'];

function expectedRoute(initial: StoryState, choices: readonly number[]) {
  let state = structuredClone(initial);
  let id: string | null = episodeTwo.startSceneId;
  const sceneIds: string[] = [];
  const choiceIds: string[] = [];
  while (id && sceneIds.length <= episodeTwo.scenes.length) {
    const scene = getScene(episodeTwo, id);
    sceneIds.push(id);
    if (scene.kind === 'terminal') return { sceneIds, choiceIds, state };
    if (scene.choices?.length) {
      const index = episodeTwo.scenes.filter(candidate => candidate.choices?.length).findIndex(candidate => candidate.id === id);
      const choice = getAvailableChoices(scene, state)[choices[index]];
      if (!choice) throw new Error(`Unavailable route choice in ${id}`);
      choiceIds.push(choice.id);
      state = applyChoice(state, choice);
      id = choice.nextSceneId;
    } else id = resolveNextScene(scene, state);
  }
  throw new Error('Episode 2 route did not terminate');
}

async function finishEpisodeOne(page: Page, store: MockApiStore) {
  await enterStory(page, store);
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep1_end_paywall');
  for (let i = 0; i < 10 && await marker(page) !== 'offer'; i++) await step(page);
  await expect(page.getByText('Эпизод 1 завершён', { exact: true })).toBeVisible();
  expect(store.saves).toEqual([]);
}

async function lastBeat(page: Page) {
  const stage = page.locator('[data-scene-id]');
  const count = Number(await stage.getAttribute('data-beat-count'));
  while (Number(await stage.getAttribute('data-beat-index')) < count - 1) await step(page, [], episodeTwo);
}

test('three full Episode 2 routes preserve real Episode 1 endings and cover all scenes/options', async ({ browser }) => {
  test.setTimeout(240_000);
  const reached = new Set<string>();
  const chosen = new Set<string>();
  for (const route of routes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [];
    const requests: ProgressDto[] = [];
    const events: { eventName: string; episodeId?: string; sceneId?: string; metadata?: { choiceId?: string } }[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/assets/last-online/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('request', request => {
      if (request.method() === 'PUT' && request.url().endsWith('/progress')) requests.push(request.postDataJSON());
      if (request.method() === 'POST' && request.url().endsWith('/analytics')) events.push(request.postDataJSON());
    });
    const initial = inheritedState(route.inheritance);
    const expected = expectedRoute(initial, route.choices);
    const store = seed('ep1_end_paywall', episodeOne, initial);
    await finishEpisodeOne(page, store);
    await page.getByRole('button', { name: 'Продолжить — Эпизод 2', exact: true }).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
    await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep2_morning');
    expect(store.progress).toMatchObject({ episodeId: episodeTwo.id, sceneId: 'ep2_morning', ...initial });
    expect(requests).toHaveLength(1);
    expect(store.saves).toEqual(['ep2_morning']);

    const actualScenes: string[] = [];
    const seenText: string[] = [];
    for (let i = 0; i < 320 && await marker(page) !== 'offer'; i++) {
      const id = (await page.locator('[data-scene-id]').getAttribute('data-scene-id'))!;
      const scene = getScene(episodeTwo, id);
      if (actualScenes.at(-1) !== id) actualScenes.push(id);
      reached.add(id);
      if (scene.kind === 'message') {
        await expect(page.locator('.lumi-soa')).toHaveAttribute('data-chat-complete', 'true');
        for (const message of scene.chat?.messages ?? []) await expect(page.locator('.lumi-soa__thread')).toContainText(message.text);
        seenText.push(await page.locator('.lumi-soa__thread').innerText());
      } else {
        const beat = Number(await page.locator('[data-beat-index]').getAttribute('data-beat-index'));
        await expect(page.locator('.lumi-dialogue__copy')).toHaveText(scene.beats?.[beat].text ?? scene.text);
        seenText.push(await page.locator('.lumi-dialogue__copy').innerText());
      }
      if (scene.choices?.length && await page.locator('.lumi-choice').count()) {
        const branch = episodeTwo.scenes.filter(candidate => candidate.choices?.length).findIndex(candidate => candidate.id === id);
        chosen.add(scene.choices[route.choices[branch]].id);
      }
      await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      const saveCount = store.saves.length;
      await step(page, [...route.choices], episodeTwo);
      const nextId = await page.locator('[data-scene-id]').count() ? await page.locator('[data-scene-id]').getAttribute('data-scene-id') : null;
      expect(store.saves.length - saveCount, `${route.name}: ${id} → ${nextId ?? 'completion'}`).toBe(nextId && nextId !== id ? 1 : 0);
    }
    await expect(page.getByText('Эпизод 2 завершён', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Эпизод 3 в разработке' })).toBeVisible();
    expect(actualScenes, route.name).toEqual(expected.sceneIds);
    expect(actualScenes).toEqual(expect.arrayContaining(criticalScenes));
    expect(seenText.join('\n')).toContain('02:26');
    expect(seenText.join('\n')).toContain('Ты опоздал на три года.');
    expect(store.progress).toMatchObject({ episodeId: episodeTwo.id, sceneId: 'ep2_end', ...expected.state });
    expect(store.progress?.flags).toMatchObject(initial.flags);
    expect(store.saves).toEqual(expected.sceneIds);
    expect(requests.map(request => request.sceneId)).toEqual(expected.sceneIds);
    await expect.poll(() => store.analytics.filter(event => event === 'episode_finished').length).toBe(2);
    expect(store.analytics).toEqual(expect.arrayContaining(['app_opened', 'episode_started', 'scene_reached', 'choice_selected', 'episode_finished']));
    expect(store.analytics.filter(event => event === 'choice_selected')).toHaveLength(5);
    expect(store.analytics).not.toContain('paywall_opened');
    expect(store.analytics).not.toContain('purchase_clicked');
    expect(events.filter(event => event.eventName === 'episode_started').map(event => event.episodeId)).toEqual([episodeOne.id, episodeTwo.id]);
    expect(events.filter(event => event.eventName === 'episode_finished').map(event => event.episodeId)).toEqual([episodeOne.id, episodeTwo.id]);
    expect(events.filter(event => event.eventName === 'scene_reached').map(event => event.sceneId)).toEqual(expected.sceneIds);
    expect(events.filter(event => event.eventName === 'choice_selected').map(event => event.metadata?.choiceId)).toEqual(expected.choiceIds);
    expect(errors, route.name).toEqual([]);
    await context.close();
  }
  expect([...reached].sort()).toEqual(episodeTwo.scenes.map(scene => scene.id).sort());
  expect(chosen.size).toBe(15);
});

test('reload during Episode 2 retains the episode, state and logical scene with beat zero', async ({ page }) => {
  const state = inheritedState('investigation');
  const store = seed('ep1_end_paywall', episodeOne, state);
  await finishEpisodeOne(page, store);
  await page.getByRole('button', { name: 'Продолжить — Эпизод 2', exact: true }).click();
  while (await page.locator('[data-scene-id]').getAttribute('data-scene-id') !== 'ep2_phone_demand') await step(page, [1, 1, 1, 2, 2], episodeTwo);
  await step(page, [], episodeTwo);
  await expect(page.locator('[data-beat-index]')).toHaveAttribute('data-beat-index', '1');
  const before = structuredClone(store.progress);
  const saveCount = store.saves.length;
  await page.reload();
  await page.getByRole('button', { name: 'Продолжить историю', exact: true }).click();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep2_phone_demand');
  await expect(page.locator('[data-beat-index]')).toHaveAttribute('data-beat-index', '0');
  expect(store.progress).toEqual(before);
  expect(store.progress).toMatchObject({ episodeId: episodeTwo.id, flags: { ...state.flags, ep2_phone_response: 'demand' } });
  expect(store.saves).toHaveLength(saveCount);
});

test('Episode 1 to 2 save failure retains completion; retry and rapid taps commit once', async ({ page }) => {
  const state = inheritedState();
  const store = seed('ep1_end_paywall', episodeOne, state);
  const requests: ProgressDto[] = [];
  page.on('request', request => { if (request.method() === 'PUT') requests.push(request.postDataJSON()); });
  await finishEpisodeOne(page, store);
  store.failNextSave = true;
  await page.getByRole('button', { name: 'Продолжить — Эпизод 2', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.getByText('Эпизод 1 завершён', { exact: true })).toBeVisible();
  expect(store.progress).toMatchObject({ episodeId: episodeOne.id, sceneId: 'ep1_end_paywall', ...state });
  expect(store.saves).toEqual([]);
  expect(requests).toHaveLength(1);
  await page.getByRole('button', { name: 'Повторить', exact: true }).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep2_morning');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(store.progress).toMatchObject({ episodeId: episodeTwo.id, sceneId: 'ep2_morning', ...state });
  expect(store.saves).toEqual(['ep2_morning']);
  expect(requests).toHaveLength(2);
});

test('Episode 2 choice failure preserves the final beat and applies effects once on retry', async ({ page }) => {
  const state = inheritedState('risk');
  const store = seed('ep2_recognized', episodeTwo, state);
  const requests: ProgressDto[] = [];
  page.on('request', request => { if (request.method() === 'PUT') requests.push(request.postDataJSON()); });
  await enterStory(page, store);
  await lastBeat(page);
  expect(store.saves).toEqual([]);
  const text = await page.locator('.lumi-dialogue__copy').innerText();
  const choice = getScene(episodeTwo, 'ep2_recognized').choices![2];
  store.failNextSave = true;
  await page.getByRole('button', { name: choice.text, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', 'ep2_recognized');
  await expect(page.locator('.lumi-dialogue__copy')).toHaveText(text);
  expect(store.progress).toMatchObject({ ...state, sceneId: 'ep2_recognized' });
  expect(store.saves).toEqual([]);
  await page.getByRole('button', { name: 'Повторить', exact: true }).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', choice.nextSceneId);
  expect(store.progress).toMatchObject({ ...applyChoice(state, choice), episodeId: episodeTwo.id, sceneId: choice.nextSceneId });
  expect(store.saves).toEqual([choice.nextSceneId]);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  await expect.poll(() => store.analytics.filter(event => event === 'choice_selected').length).toBe(1);
});

test('rapid Episode 2 choice and final-beat taps produce one transition each', async ({ page }) => {
  const state = inheritedState();
  const store = seed('ep2_recognized', episodeTwo, state);
  await enterStory(page, store);
  await lastBeat(page);
  const choice = getScene(episodeTwo, 'ep2_recognized').choices![0];
  await page.getByRole('button', { name: choice.text, exact: true }).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', choice.nextSceneId);
  expect(store.saves).toEqual([choice.nextSceneId]);
  expect(store.progress).toMatchObject(applyChoice(state, choice));
  await lastBeat(page);
  expect(store.saves).toHaveLength(1);
  const nextId = resolveNextScene(getScene(episodeTwo, choice.nextSceneId), applyChoice(state, choice));
  await page.getByRole('button', { name: 'Продолжить', exact: true }).evaluate(button => { for (let i = 0; i < 8; i++) (button as HTMLButtonElement).click(); });
  await expect(page.locator('[data-scene-id]')).toHaveAttribute('data-scene-id', nextId!);
  expect(store.saves).toEqual([choice.nextSceneId, nextId]);
});
