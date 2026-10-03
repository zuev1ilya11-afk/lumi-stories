import { expect, it } from 'vitest';
import raw from '../content/last-online/season-1/episode-2.json';
import firstRaw from '../content/last-online/season-1/episode-1.json';
import { parseEpisode, type StoryState } from './schema';
import { enumeratePaths } from './validator';

const episode = parseEpisode(raw);
const initial: StoryState = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
const states = enumeratePaths(parseEpisode(firstRaw), initial).map(path => path.state);

it('directs every Episode 2 scene with short paced beats', () => {
  expect(episode.scenes).toHaveLength(53);
  for (const scene of episode.scenes) {
    expect(scene.beats?.length, scene.id).toBeGreaterThan(0);
    expect(scene.presentation?.camera, scene.id).toBeTruthy();
    expect(scene.presentation?.location, scene.id).toBeTruthy();
    for (const beat of scene.beats ?? []) expect(beat.text.length, `${scene.id}: ${beat.text}`).toBeLessThanOrEqual(220);
  }
});
it('preserves Episode 1 flags and terminates all Episode 2 choice routes', () => {
  const reached = new Set<string>();
  for (const state of states) {
    const paths = enumeratePaths(episode, state);
    expect(paths).toHaveLength(243);
    expect(paths.every((path) => path.terminal && path.sceneIds.at(-1) === 'ep2_end')).toBe(true);
    paths.forEach((path) => path.sceneIds.forEach((id) => reached.add(id)));
  }
  expect(reached.size).toBe(53);
});
