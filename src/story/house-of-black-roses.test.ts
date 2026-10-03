// @vitest-environment node
import { expect, it } from 'vitest';
import { validateEpisode, enumeratePaths } from './validator';
import { getStoryRuntime } from './stories';

it('registers House of Black Roses as an independent playable story', () => {
  const story = getStoryRuntime('house-of-black-roses');
  expect(story.seasonId).toBe('season-1');
  expect(story.free).toBe(true);
  expect(story.episodes).toHaveLength(1);
  expect(story.firstEpisode.id).toBe('house-of-black-roses-s1-e1');
  expect(validateEpisode(story.firstEpisode)).toEqual([]);
});

it('all Episode 1 gothic choices end on the portrait cliffhanger', () => {
  const episode = getStoryRuntime('house-of-black-roses').firstEpisode;
  const paths = enumeratePaths(episode, { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} });
  expect(paths.length).toBe(12);
  for (const path of paths) {
    expect(path.terminal, path.reason).toBe(true);
    expect(path.sceneIds.at(-1)).toBe('gothic_ep1_end');
    expect(path.sceneIds).toContain('gothic_ep1_portrait');
    expect(path.sceneIds).toContain('gothic_ep1_adrian_portrait');
  }
});
