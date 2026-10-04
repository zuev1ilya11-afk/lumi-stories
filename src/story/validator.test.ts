// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseEpisode, type Episode, type StoryState } from './schema';
import { enumeratePaths, validateEpisode } from './validator';

const initial: StoryState = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };

function validMini(): Episode {
  return parseEpisode({
    id: 'ep-mini', title: 'Mini', startSceneId: 'start', requiredSceneIds: ['end'],
    scenes: [
      { id: 'start', kind: 'narrative', text: 'Начало', choices: [{ id: 'go', text: 'Дальше', nextSceneId: 'end' }] },
      { id: 'end', kind: 'terminal', text: 'Конец' },
    ],
  });
}

describe('parseEpisode', () => {
  it('rejects unknown scene kind', () => {
    expect(() => parseEpisode({ id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'video', text: 'x' }] })).toThrow();
  });
  it('rejects choice without nextSceneId', () => {
    expect(() => parseEpisode({ id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'dialogue', text: 'x', choices: [{ id: 'c', text: 'x' }] }] })).toThrow();
  });
  it('rejects inc effect for an unknown score', () => {
    expect(() => parseEpisode({ id: 'x', title: 'x', startSceneId: 's', scenes: [{ id: 's', kind: 'dialogue', text: 'x', choices: [{ id: 'c', text: 'x', nextSceneId: 'e', effects: [{ kind: 'inc', score: 'money', by: 1 }] }] }, { id: 'e', kind: 'terminal', text: 'e' }] })).toThrow();
  });
  it('rejects an empty scene id', () => {
    expect(() => parseEpisode({ id: 'x', title: 'x', startSceneId: '', scenes: [{ id: '', kind: 'terminal', text: 'x' }] })).toThrow();
  });
});

describe('validateEpisode', () => {
  it('reports a reference to a missing scene', () => {
    const episode = validMini();
    episode.scenes[0].choices![0].nextSceneId = 'missing';
    expect(validateEpisode(episode).some((issue) => issue.code === 'MISSING_SCENE_REFERENCE')).toBe(true);
  });
  it('reports a required unreachable scene', () => {
    const episode = validMini();
    episode.scenes.push({ id: 'secret', kind: 'terminal', text: 'secret' });
    episode.requiredSceneIds = ['secret'];
    expect(validateEpisode(episode).some((issue) => issue.code === 'UNREACHABLE_REQUIRED_SCENE')).toBe(true);
  });
  it('reports a route with no terminal', () => {
    const episode = parseEpisode({ id: 'loop', title: 'loop', startSceneId: 'a', scenes: [{ id: 'a', kind: 'narrative', text: 'a', nextSceneId: 'b' }, { id: 'b', kind: 'narrative', text: 'b', nextSceneId: 'a' }] });
    expect(validateEpisode(episode).some((issue) => issue.code === 'NON_TERMINATING_PATH')).toBe(true);
  });
  it('accepts a correct mini episode and enumerates its terminal path', () => {
    const episode = validMini();
    expect(validateEpisode(episode)).toEqual([]);
    const paths = enumeratePaths(episode, initial);
    expect(paths).toHaveLength(1);
    expect(paths[0].terminal).toBe(true);
    expect(paths[0].sceneIds).toEqual(['start', 'end']);
  });
});

import { readFileSync } from 'node:fs';

function loadEpisodeOne(): Episode {
  const raw = JSON.parse(readFileSync(new URL('../content/last-online/season-1/episode-1.json', import.meta.url), 'utf8')) as unknown;
  return parseEpisode(raw);
}

describe('Last Online Episode 1 content', () => {
  it('contains all five required meaningful choice nodes', () => {
    const episode = loadEpisodeOne();
    const ids = [
      'ep1_choice_first_impression',
      'ep1_choice_search_scandal',
      'ep1_choice_soa_message',
      'ep1_choice_junho_confrontation',
      'ep1_choice_photo_response',
    ];
    for (const id of ids) {
      const scene = episode.scenes.find((candidate) => candidate.id === id);
      expect(scene, id).toBeDefined();
      expect(scene?.choices?.length ?? 0, id).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives the SOA message choice exactly three distinct flag effects', () => {
    const episode = loadEpisodeOne();
    const scene = episode.scenes.find((candidate) => candidate.id === 'ep1_choice_soa_message');
    expect(scene?.choices).toHaveLength(3);
    const flags = scene!.choices!
      .flatMap((choice) => (choice.effects ?? []).filter((effect) => effect.kind === 'setFlag').map((effect) => effect.flag))
      .sort();
    expect(flags).toEqual(['hid_soa_message', 'replied_soa', 'told_junho_soa']);
  });

  it('terminates every complete route at the episode paywall', () => {
    const paths = enumeratePaths(loadEpisodeOne(), initial);
    expect(paths.length).toBeGreaterThan(1);
    expect(paths.every((path) => path.terminal && path.sceneIds.at(-1) === 'ep1_end_paywall')).toBe(true);
  });

  it('reaches materially different Junho and truth states by the cliffhanger', () => {
    const paths = enumeratePaths(loadEpisodeOne(), initial);
    const states = new Set(paths.map((path) => `${path.state.junhoScore}:${path.state.truthScore}`));
    expect(states.size).toBeGreaterThanOrEqual(2);
  });

  it('has no validation issues or unreachable required scenes', () => {
    expect(validateEpisode(loadEpisodeOne())).toEqual([]);
  });
});
