import { expect, test, type Page } from '@playwright/test';
import { enterStory, episodeTwo, inheritedState, seed, step } from './fixtures/story';

test.describe.configure({ mode: 'parallel' });

// Capture authored frames, while validating every beat in every Episode 2 scene.
// A screenshot does not establish face composition: the contact sheets are also
// inspected by a person at the four supported phone sizes.
const shots: { name: string; scene: string; beat: number | 'completion' }[] = [
  { name: 'morning', scene: 'ep2_morning', beat: 0 },
  { name: 'event-hall', scene: 'ep2_event', beat: 0 },
  { name: 'taeyun-stage', scene: 'ep2_event', beat: 1 },
  { name: 'taeyun-amused', scene: 'ep2_event', beat: 2 },
  { name: 'backstage-taeyun-neutral', scene: 'ep2_call', beat: 0 },
  { name: 'taeyun-surprised', scene: 'ep2_call', beat: 3 },
  { name: 'cg-recognized-number', scene: 'ep2_recognized', beat: 0 },
  { name: 'choice-phone', scene: 'ep2_recognized', beat: 2 },
  { name: 'taeyun-guarded', scene: 'ep2_phone_demand', beat: 0 },
  { name: 'practice-room-taeyun-serious', scene: 'ep2_last_call', beat: 0 },
  { name: 'choice-photo', scene: 'ep2_photo_choice', beat: 2 },
  { name: 'soa-incoming', scene: 'ep2_soa_incoming', beat: 0 },
  { name: 'soa-outgoing', scene: 'ep2_soa_outgoing', beat: 0 },
  { name: 'choice-archive', scene: 'ep2_archive_choice', beat: 3 },
  { name: 'soa-archive', scene: 'ep2_archive_soa', beat: 0 },
  { name: 'archive', scene: 'ep2_archive_permission', beat: 0 },
  { name: 'cg-archive-0226', scene: 'ep2_archive_0226', beat: 0 },
  { name: 'archive-reflection', scene: 'ep2_archive_reflection', beat: 4 },
  { name: 'rooftop', scene: 'ep2_rooftop', beat: 0 },
  { name: 'taeyun-vulnerable', scene: 'ep2_rooftop_choice', beat: 0 },
  { name: 'choice-rooftop', scene: 'ep2_rooftop_choice', beat: 2 },
  { name: 'soa-door', scene: 'ep2_soa_door', beat: 0 },
  { name: 'cg-night-access', scene: 'ep2_card_intro', beat: 0 },
  { name: 'choice-card', scene: 'ep2_card_choice', beat: 3 },
  { name: 'service-lift', scene: 'ep2_lift_checkpoint', beat: 0 },
  { name: 'cg-elevator-hand', scene: 'ep2_blocked', beat: 0 },
  { name: 'cg-elevator-cliffhanger', scene: 'ep2_confrontation', beat: 0 },
  { name: 'confrontation-final-line', scene: 'ep2_confrontation', beat: 3 },
  { name: 'completion', scene: 'ep2_end', beat: 'completion' },
];

async function assertMobileFrame(page: Page, width: number, height: number, label: string) {
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)), { message: `${label}: images loaded` }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no horizontal scroll`).toBe(true);
  const dialogue = page.locator('.lumi-dialogue');
  if (await dialogue.count()) {
    const bounds = (await dialogue.boundingBox())!;
    expect(bounds.height, `${label}: dialogue height`).toBeLessThanOrEqual(height * .35);
    expect(bounds.y, `${label}: dialogue onscreen`).toBeGreaterThanOrEqual(24);
    expect(bounds.y + bounds.height, `${label}: bottom safe area`).toBeLessThanOrEqual(height - 16);
    expect(await page.locator('.lumi-dialogue__copy').evaluate(element => element.scrollHeight <= element.clientHeight + 1), `${label}: complete authored beat fits without inner scrolling`).toBe(true);
  }
  for (const button of await page.locator('button:not(.lumi-stage-tap)').all()) {
    if (!await button.isVisible()) continue;
    const box = (await button.boundingBox())!;
    const name = await button.getAttribute('aria-label') ?? await button.innerText();
    expect(box.height, `${label}: ${name} tap height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `${label}: ${name} tap width`).toBeGreaterThanOrEqual(44);
    expect(box.x, `${label}: ${name} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${label}: ${name} right edge`).toBeLessThanOrEqual(width);
    expect(box.y, `${label}: ${name} top safe area`).toBeGreaterThanOrEqual(24);
    expect(box.y + box.height, `${label}: ${name} bottom safe area`).toBeLessThanOrEqual(height - 16);
  }
  const header = page.locator('.lumi-story__topbar, .lumi-soa__header');
  if (await header.count()) {
    const box = (await header.boundingBox())!;
    expect(box.y + box.height, `${label}: header visible`).toBeLessThan(height);
    expect(box.x + box.width, `${label}: header width`).toBeLessThanOrEqual(width);
  }
}

for (const [width, height] of [[320, 568], [360, 740], [390, 844], [430, 932]]) {
  test(`Episode 2 mobile composition ${width}px: every scene/beat and 29 authored frames`, async ({ browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors: string[] = [];
    const captured = new Set<string>();
    let checkedBeats = 0;
    for (const scene of episodeTwo.scenes) {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.url().includes('/assets/last-online/') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', '24px');
        document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', '16px');
      }));
      const store = seed(scene.id, episodeTwo, inheritedState());
      await enterStory(page, store);
      const beatCount = scene.kind === 'message' ? 1 : scene.beats?.length ?? 1;
      for (let beat = 0; beat < beatCount; beat++) {
        if (scene.kind === 'message') await expect(page.locator('.lumi-soa')).toHaveAttribute('data-chat-complete', 'true');
        else await expect(page.locator('.lumi-dialogue')).toHaveAttribute('data-complete', 'true');
        await assertMobileFrame(page, width, height, `${scene.id}:${beat}`);
        checkedBeats++;
        for (const shot of shots.filter(shot => shot.scene === scene.id && shot.beat === beat)) {
          await page.screenshot({ path: `docs/visual-qa/screenshots/episode-2/${width}/${shot.name}.png` });
          captured.add(shot.name);
        }
        if (beat < beatCount - 1) await step(page, [], episodeTwo);
      }
      if (scene.kind === 'terminal') {
        await step(page, [], episodeTwo);
        await expect(page.getByRole('heading', { name: 'Эпизод 3 в разработке' })).toBeVisible();
        await assertMobileFrame(page, width, height, 'completion');
        await page.screenshot({ path: `docs/visual-qa/screenshots/episode-2/${width}/completion.png` });
        captured.add('completion');
      }
      expect(store.saves, `${scene.id}: presentation beats do not save`).toEqual([]);
      await page.close();
    }
    expect(captured.size).toBe(shots.length);
    expect(checkedBeats).toBe(episodeTwo.scenes.reduce((total, scene) => total + (scene.kind === 'message' ? 1 : scene.beats?.length ?? 1), 0));
    expect(errors).toEqual([]);
    await context.close();
  });
}
