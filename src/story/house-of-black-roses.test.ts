// @vitest-environment node
import { expect, it } from 'vitest';
import { validateEpisode, enumeratePaths } from './validator';
import { getStoryRuntime, getNextStoryEpisode } from './stories';
const zero = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };

it('legacy Isabelle invitation preserves whether the player actually disclosed the voice', () => {
  const episode = { ...getStoryRuntime('house-of-black-roses').episodes[1], startSceneId: 'gothic_ep2_west_isabel' };
  for (const disclosed of [false, true]) {
    const paths = enumeratePaths(episode, { ...zero, flags: {
      gothic_isabel_trust: 3, gothic_ep2_west_companion: 'isabel', gothic_ep2_told_isabel_everything: disclosed,
    } });
    for (const path of paths) {
      expect(path.sceneIds).toContain(disclosed ? 'gothic_ep2_isabel_support' : 'gothic_ep2_isabel_reserve');
      expect(path.sceneIds).not.toContain(disclosed ? 'gothic_ep2_isabel_reserve' : 'gothic_ep2_isabel_support');
      expect(path.terminal).toBe(true);
    }
  }
});

it('registers House of Black Roses as an independent playable two-episode story', () => {
  const story = getStoryRuntime('house-of-black-roses');
  expect(story.seasonId).toBe('season-1');
  expect(story.free).toBe(false);
  expect(story.episodes).toHaveLength(2);
  expect(story.firstEpisode.id).toBe('house-of-black-roses-s1-e1');
  expect(story.episodes[1].id).toBe('house-of-black-roses-s1-e2');
  for (const episode of story.episodes) expect(validateEpisode(episode)).toEqual([]);
});

it('preserves every real Episode 1 outcome and carries trust into later Episode 2 scenes', () => {
  const runtime = getStoryRuntime('house-of-black-roses');
  const episode = getNextStoryEpisode(runtime.id, runtime.firstEpisode.id)!;
  expect(episode.id).toBe('house-of-black-roses-s1-e2');
  for (const inherited of enumeratePaths(runtime.firstEpisode, zero)) {
    for (const path of enumeratePaths(episode, inherited.state)) {
      expect(path.terminal).toBe(true);
      expect(path.sceneIds.at(-1)).toBe('gothic_ep2_end');
      for (const [key, value] of Object.entries(inherited.state.flags)) expect(path.state.flags[key]).toBe(value);
      if (path.state.flags.gothic_ep2_west_companion === 'isabel') {
        expect(path.sceneIds).toContain('gothic_ep2_isabel_departure');
        expect(path.sceneIds).toContain(path.state.flags.gothic_isabel_trust === 2
          ? 'gothic_ep2_isabel_support' : 'gothic_ep2_isabel_reserve');
      } else expect(path.sceneIds).not.toContain('gothic_ep2_isabel_departure');
      expect(path.sceneIds).toContain(path.state.flags.gothic_ep2_lucian_approach === 'suspicious'
        ? 'gothic_ep2_lucian_distance' : 'gothic_ep2_lucian_offer');
      expect(path.sceneIds.includes('gothic_ep2_return_warned')).toBe(path.state.flags.gothic_ep2_west_companion === 'note');
    }
  }
});

it('all Episode 1 gothic choices end on the portrait cliffhanger', () => {
  const episode = getStoryRuntime('house-of-black-roses').firstEpisode;
  const paths = enumeratePaths(episode, zero);
  expect(paths.length).toBe(12);
  for (const path of paths) {
    expect(path.terminal, path.reason).toBe(true);
    expect(path.sceneIds.at(-1)).toBe('gothic_ep1_end');
  }
});

it('Episode 2 keeps every decision route playable and converges on the mirror warning', () => {
  const episode = getStoryRuntime('house-of-black-roses').episodes[1];
  const defaultPaths = enumeratePaths(episode, zero);
  const inheritedPaths = enumeratePaths(episode, {
    ...zero,
    flags: {
      gothic_gallery_choice: 'adrian',
      gothic_opened_midnight_door: true,
    },
  });
  expect(defaultPaths.length).toBe(486);
  expect(inheritedPaths.length).toBe(486);
  const paths = [...defaultPaths, ...inheritedPaths];
  const reached = new Set(paths.flatMap(path => path.sceneIds));
  expect(reached).toEqual(new Set(episode.scenes.map(scene => scene.id)));
  for (const path of paths) {
    expect(path.terminal, path.reason).toBe(true);
    expect(path.sceneIds.at(-1)).toBe('gothic_ep2_end');
    expect(path.sceneIds).toContain('gothic_ep2_photos_reveal');
    expect(path.sceneIds).toContain('gothic_ep2_diary_core');
    expect(path.sceneIds).toContain('gothic_ep2_lucian_meet');
    expect(path.sceneIds).toContain('gothic_ep2_mirror');
  }
});
