// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
    expect(art, scene.id).toMatch(/^assets\/house-of-black-roses\/(?:v1|v2|ep2)\//);
    expect(existsSync(`public/${art}`), art).toBe(true);
    arts.add(art);
    for (const beat of scene.beats ?? []) {
      expect(beat.text.length).toBeLessThanOrEqual(320);
      const shot = getScenePresentation(scene, beat).cg!;
      expect(shot, scene.id).toMatch(/\.webp$/);
      expect(existsSync(`public/${shot}`), shot).toBe(true);
      arts.add(shot);
    }
  }
  for (const art of [
    ...['isabel-arrival', 'isabel-confide', 'isabel-guarded', 'adrian-photos',
      'west-door', 'west-opening', 'west-corridor', 'first-evelyn-room', 'letters',
      'diary', 'chapel', 'lucian-entrance', 'lucian-evidence', 'adrian-conflict',
      'adrian-grief', 'mirror-empty', 'mirror-reflection'].map(name => `assets/house-of-black-roses/ep2/${name}.webp`)
  ]) expect(arts.has(art), art).toBe(true);
  const manifest = JSON.parse(readFileSync('docs/house-of-black-roses/art-manifest.json', 'utf8')) as { file: string; bytes?: number; sha256?: string }[];
  const accepted = manifest.filter(item => item.file.includes('/ep2/') && item.file.endsWith('.webp'));
  expect(accepted).toHaveLength(19);
  for (const item of accepted) {
    const bytes = readFileSync(item.file);
    expect(bytes.length, item.file).toBe(item.bytes);
    expect(createHash('sha256').update(bytes).digest('hex'), item.file).toBe(item.sha256);
  }
});

it('stages the mirror apparition before the warning without revealing it early', () => {
  const scenes = getStoryRuntime('house-of-black-roses').episodes[1].scenes;
  const mirror = scenes.find(s => s.id === 'gothic_ep2_mirror')!;
  expect(getScenePresentation(mirror, mirror.beats![0]).cg).toContain('mirror-empty');
  expect(getScenePresentation(mirror, mirror.beats![2]).cg).toContain('mirror-reflection');
  expect(getScenePresentation(mirror, mirror.beats![3]).cg).toContain('mirror-empty');
  expect(mirror.beats?.some(b => b.text.includes('НЕ ВЕРЬ ЕМУ'))).toBe(false);
  expect(scenes.find(s => s.id === 'gothic_ep2_end')!.beats!.at(-1)!.text).toBe('НЕ ВЕРЬ ЕМУ.');
});
