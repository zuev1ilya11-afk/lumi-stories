// @vitest-environment node
import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getStoryRuntime } from './stories';
import { enumeratePaths } from './validator';
import { getScenePresentation } from '../features/story/presentation';

const episode = getStoryRuntime('house-of-black-roses').firstEpisode;
const paths = enumeratePaths(episode, { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} });

it('provides a full reading episode on every route, in short beats', () => {
  for (const path of paths) {
    const beats = path.sceneIds.flatMap(id => episode.scenes.find(s => s.id === id)!.beats ?? []);
    const words = beats.map(b => b.text).join(' ').match(/[\p{L}\p{N}]+/gu)!.length;
    expect(words).toBeGreaterThanOrEqual(1600);
    expect(words).toBeLessThanOrEqual(2800);
    expect(beats.every(b => b.text.length <= 320)).toBe(true);
  }
});

it('gives every beat a real story-owned image and delays the double portrait until the reveal', () => {
  const unique = new Set<string>();
  for (const scene of episode.scenes) {
    for (const beat of scene.beats ?? []) {
      const p = getScenePresentation(scene, beat);
      const art = p.cg ?? beat.background ?? scene.background;
      expect(art, scene.id).toMatch(/^assets\/house-of-black-roses\/v1\//);
      expect(existsSync(`public/${art}`), art).toBe(true);
      unique.add(art!);
      if (!['gothic_ep1_adrian_portrait', 'gothic_ep1_end'].includes(scene.id)) {
        expect(art).not.toContain('portrait-full');
      }
    }
  }
  expect(unique.size).toBeGreaterThanOrEqual(29);
});

it('covers every scene and choice across twelve terminating paths without repeating scenes', () => {
  expect(paths).toHaveLength(12);
  const reached = new Set(paths.flatMap(p => p.sceneIds));
  expect([...reached].sort()).toEqual(episode.scenes.map(s => s.id).sort());
  for (const path of paths) {
    expect(new Set(path.sceneIds).size).toBe(path.sceneIds.length);
    for (const id of path.sceneIds) {
      const scene = episode.scenes.find(s => s.id === id)!;
      for (const choice of scene.choices ?? []) expect(reached.has(choice.nextSceneId)).toBe(true);
    }
    expect(path.state.flags).toHaveProperty('gothic_rules_response');
    expect(path.state.flags).toHaveProperty('gothic_opened_midnight_door');
    expect(path.state.flags).toHaveProperty('gothic_gallery_choice');
  }
});

it('Episode 2 keeps every scene visually staged and all v2 assets present', () => {
  const episodeTwo = getStoryRuntime('house-of-black-roses').episodes[1];
  const arts = new Set<string>();
  for (const scene of episodeTwo.scenes) {
    expect(scene.presentation?.cg, scene.id).toBeTruthy();
    const art = scene.presentation?.cg!;
    expect(art, scene.id).toMatch(/^assets\/house-of-black-roses\/(?:v1|v2)\//);
    expect(existsSync(`public/${art}`), art).toBe(true);
    arts.add(art);
    for (const beat of scene.beats ?? []) expect(beat.text.length).toBeLessThanOrEqual(320);
  }
  for (const art of [
    'assets/house-of-black-roses/v2/isabel-portrait.svg',
    'assets/house-of-black-roses/v2/lucian-portrait.svg',
    'assets/house-of-black-roses/v2/adrian-photos.svg',
    'assets/house-of-black-roses/v2/diary-page.svg',
    'assets/house-of-black-roses/v2/mirror-warning.svg'
  ]) expect(arts.has(art), art).toBe(true);
});
