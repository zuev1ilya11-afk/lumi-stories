import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import raw from '../content/last-online/season-1/episode-2.json';
import { parseEpisode } from './schema';

const episode = parseEpisode(raw);
it('delivers every authored Episode 2 image as a real optimized asset', () => {
  const assets = new Set<string>();
  for (const scene of episode.scenes) {
    for (const shot of [scene, ...(scene.beats ?? [])]) {
      if (shot.background) assets.add(shot.background);
      if (shot.presentation?.cg) assets.add(shot.presentation.cg);
      shot.presentation?.characters?.forEach(c => assets.add(c.src));
    }
    if (scene.attachment) assets.add(scene.attachment);
  }
  for (const asset of assets) {
    expect(existsSync(`public/${asset}`), asset).toBe(true);
    const bytes = readFileSync(`public/${asset}`);
    expect(bytes.length, asset).toBeGreaterThan(1000);
    expect(bytes.subarray(8, 12).toString(), asset).toBe('WEBP');
  }
  const states = [...assets].filter(a => a.includes('/ep2/characters/taeyun/'));
  expect(states).toHaveLength(7);
  expect(new Set(states.map(a => createHash('sha256').update(readFileSync(`public/${a}`)).digest('hex'))).size).toBe(7);
});

it('reveals the blocked elevator hand before the full confrontation and limits haptics to story impacts', () => {
  const blocked = episode.scenes.find(s => s.id === 'ep2_blocked')!;
  expect(blocked.presentation?.cg).toContain('elevator-hand');
  expect(blocked.beats?.[2].presentation?.cg).toContain('elevator-cliffhanger');
  const haptics = episode.scenes.flatMap(s => [s.presentation, ...(s.beats ?? []).map(b => b.presentation)]).filter(p => p?.haptic);
  expect(haptics.length).toBeGreaterThanOrEqual(3);
  expect(haptics.length).toBeLessThanOrEqual(5);
});
