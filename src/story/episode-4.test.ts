// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { episodes, getNextEpisode } from './episodes';
import { enumeratePaths, validateEpisode } from './validator';
import { createProgressMachine } from '../progress/model';

it('continues a completed Episode 3 into Episode 4 without resetting decisions or scores', async () => {
  const next = getNextEpisode('last-online-s1-e3');
  expect(next, 'Episode 4 must be registered after Episode 3').toBeDefined();
  if (!next) return;
  const storyState = { junhoScore: 9, taeyunScore: 5, truthScore: 7, riskScore: -1, flags: { photo_saved: true, ep2_card_response: 'send' } };
  const machine = createProgressMachine({ episode: episodes[2], episodes, initial: { episodeId: episodes[2].id, sceneId: 'ep3_end', storyState }, save: async dto => dto });
  expect(await machine.nextEpisode()).toEqual({ episodeId: 'last-online-s1-e4', sceneId: 'ep4_morning', storyState });
});

it('all Episode 4 choices finish, preserve inherited flags and have working artwork', () => {
  const episode = getNextEpisode('last-online-s1-e3');
  expect(episode).toBeDefined();
  if (!episode) return;
  expect(validateEpisode(episode)).toEqual([]);
  const reached = new Set<string>();
  const chosen = new Set<string>();
  for (const response of ['proof', 'boundary', 'silent']) {
    for (const partner of ['taeyun', 'junho', 'mina']) {
      const inherited = { junhoScore: partner === 'junho' ? 12 : 0, taeyunScore: partner === 'taeyun' ? 12 : 0, truthScore: 4, riskScore: -1, flags: { ep3_soa_response: response, ep3_closeness: partner, photo_saved: true } };
      const before = JSON.stringify(inherited);
      const paths = enumeratePaths(episode, inherited);
      expect(paths).toHaveLength(243);
      for (const path of paths) {
        expect(path.terminal, path.reason).toBe(true);
        expect(path.sceneIds.at(-1)).toBe('ep4_end');
        expect(path.state.flags).toMatchObject(inherited.flags);
        for (const id of path.sceneIds) reached.add(id);
        for (let i = 0; i < path.sceneIds.length - 1; i++) {
          const choice = episode.scenes.find(s => s.id === path.sceneIds[i])?.choices?.find(c => c.nextSceneId === path.sceneIds[i + 1]);
          if (choice) chosen.add(choice.id);
        }
      }
      expect(JSON.stringify(inherited)).toBe(before);
    }
  }
  expect(reached).toEqual(new Set(episode.scenes.map(s => s.id)));
  expect(chosen).toEqual(new Set(episode.scenes.flatMap(s => s.choices ?? []).map(c => c.id)));
  const assets = new Set<string>();
  for (const scene of episode.scenes) {
    expect(scene.beats?.length, scene.id).toBeGreaterThanOrEqual(2);
    for (const shot of [scene, ...(scene.beats ?? [])]) {
      if (shot.background) assets.add(shot.background);
      if (shot.presentation?.cg) assets.add(shot.presentation.cg);
      shot.presentation?.characters?.forEach(c => assets.add(c.src));
    }
    if (scene.attachment) assets.add(scene.attachment);
    for (const beat of scene.beats ?? []) expect(beat.text.length, scene.id).toBeLessThanOrEqual(220);
  }
  for (const asset of assets) {
    expect(existsSync(`public/${asset}`), asset).toBe(true);
    expect(readFileSync(`public/${asset}`).subarray(8, 12).toString(), asset).toBe('WEBP');
  }
});
