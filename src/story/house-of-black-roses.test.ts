// @vitest-environment node
import { expect, it } from 'vitest';
import { validateEpisode, enumeratePaths } from './validator';
import { getStoryRuntime } from './stories';
const zero = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };

it('registers House of Black Roses as an independent playable two-episode story', () => {
  const story = getStoryRuntime('house-of-black-roses');
  expect(story.seasonId).toBe('season-1');
  expect(story.free).toBe(false);
  expect(story.episodes).toHaveLength(2);
  expect(story.firstEpisode.id).toBe('house-of-black-roses-s1-e1');
  expect(story.episodes[1].id).toBe('house-of-black-roses-s1-e2');
  for (const episode of story.episodes) expect(validateEpisode(episode)).toEqual([]);
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
