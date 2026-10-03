// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { episodes, getNextEpisode } from './episodes';
import { enumeratePaths, validateEpisode } from './validator';
import { createProgressMachine } from '../progress/model';

it('continues a completed Episode 4 into Episode 5 without resetting decisions or scores', async () => {
  const next = getNextEpisode('last-online-s1-e4');
  expect(next, 'Episode 5 must be registered after Episode 4').toBeDefined();
  if (!next) return;
  const storyState = {
    junhoScore: 11,
    taeyunScore: 4,
    truthScore: 12,
    riskScore: -2,
    flags: { ep4_trust: 'junho', ep4_soa_response: 'proof', ep4_evidence_focus: 'copy' },
  };
  const machine = createProgressMachine({
    episode: episodes[3],
    episodes,
    initial: { episodeId: episodes[3].id, sceneId: 'ep4_end', storyState },
    save: async dto => dto,
  });
  expect(await machine.nextEpisode()).toEqual({ episodeId: 'last-online-s1-e5', sceneId: 'ep5_morning', storyState });
});

it('all Episode 5 routes terminate in one of the three season endings and preserve inherited state', () => {
  const episode = getNextEpisode('last-online-s1-e4');
  expect(episode).toBeDefined();
  if (!episode) return;
  expect(validateEpisode(episode)).toEqual([]);
  const reached = new Set<string>();
  const terminals = new Set<string>();
  const initialStates = [
    { junhoScore: 12, taeyunScore: 2, truthScore: 11, riskScore: -1, flags: { ep4_trust: 'junho', ep4_soa_response: 'proof' } },
    { junhoScore: 2, taeyunScore: 12, truthScore: 11, riskScore: 0, flags: { ep4_trust: 'taeyun', ep4_soa_response: 'limit' } },
    { junhoScore: 4, taeyunScore: 4, truthScore: 15, riskScore: -2, flags: { ep4_trust: 'none', ep4_soa_response: 'silent' } },
  ];
  for (const inherited of initialStates) {
    const before = JSON.stringify(inherited);
    const paths = enumeratePaths(episode, inherited);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.terminal, path.reason).toBe(true);
      expect(['ep5_end_junho', 'ep5_end_taeyun', 'ep5_end_self']).toContain(path.sceneIds.at(-1));
      expect(path.state.flags).toMatchObject(inherited.flags);
      path.sceneIds.forEach(id => reached.add(id));
      terminals.add(path.sceneIds.at(-1)!);
    }
    expect(JSON.stringify(inherited)).toBe(before);
  }
  expect(terminals).toEqual(new Set(['ep5_end_junho', 'ep5_end_taeyun', 'ep5_end_self']));
  expect(reached).toEqual(new Set(episode.scenes.map(scene => scene.id)));
});

it('Episode 5 keeps every visual asset real and every beat short enough for mobile dialogue', () => {
  const episode = getNextEpisode('last-online-s1-e4');
  expect(episode).toBeDefined();
  if (!episode) return;
  const assets = new Set<string>();
  for (const scene of episode.scenes) {
    expect(scene.beats?.length, scene.id).toBeGreaterThanOrEqual(1);
    for (const shot of [scene, ...(scene.beats ?? [])]) {
      if (shot.background) assets.add(shot.background);
      if (shot.presentation?.cg) assets.add(shot.presentation.cg);
      shot.presentation?.characters?.forEach(character => assets.add(character.src));
    }
    for (const beat of scene.beats ?? []) expect(beat.text.length, scene.id).toBeLessThanOrEqual(220);
  }
  for (const asset of assets) {
    expect(existsSync(`public/${asset}`), asset).toBe(true);
    expect(readFileSync(`public/${asset}`).subarray(8, 12).toString(), asset).toBe('WEBP');
  }
});
