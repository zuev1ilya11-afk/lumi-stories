import { expect, it } from 'vitest';
import raw from '../content/last-online/season-1/episode-1.json';
import { parseEpisode } from './schema';
import { enumeratePaths } from './validator';
import { nearbyAssets } from '../features/story/presentation';
const episode = parseEpisode(raw);
it('gives every reachable scene short beats and explicit scene direction', () => {
  expect(episode.scenes).toHaveLength(44);
  for (const scene of episode.scenes) {
    expect(scene.beats?.length, scene.id).toBeGreaterThan(0);
    expect(scene.presentation?.camera, scene.id).toBeTruthy();
    expect(scene.presentation?.location, scene.id).toBeTruthy();
    for (const beat of scene.beats ?? []) expect(beat.text.length, `${scene.id}: ${beat.text}`).toBeLessThanOrEqual(220);
  }
});
it('all 162 actual stateful paths terminate at the existing paywall and reach all 44 scenes', () => {
  const paths = enumeratePaths(episode, { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} });
  expect(paths).toHaveLength(162);
  expect(paths.every(p => p.terminal && p.sceneIds.at(-1) === 'ep1_end_paywall')).toBe(true);
  expect(new Set(paths.flatMap(p => p.sceneIds)).size).toBe(44);
});
it('preloads only current and immediate next shots rather than distant reveals', () => {
  const urls = nearbyAssets(episode, episode.scenes[0], 0);
  expect(urls.some(p => p.includes('arrival'))).toBe(true);
  expect(urls.some(p => p.includes('old-photo'))).toBe(false);
  expect(urls.length).toBeLessThan(10);
});
