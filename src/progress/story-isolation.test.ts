// @vitest-environment node
import { expect, it } from 'vitest';
import type { ProgressDto } from '../api/types';
import { getStoryRuntime } from '../story/stories';
import { createProgressMachine, progressFromDto } from './model';

it('rejects a save response with another story identity without committing it', async () => {
  const story = getStoryRuntime('house-of-black-roses');
  const initial = progressFromDto(null, story.firstEpisode);
  const machine = createProgressMachine({ episode: story.firstEpisode, storyId: story.id, seasonId: story.seasonId, initial, save: async dto => ({ ...dto, storyId: 'last-online' }) });
  await expect(machine.advance()).rejects.toThrow(/identity/i);
  expect(machine.current()).toBe(initial);
  expect(machine.pending()).not.toBeNull();
});

it('persists and restores two independent campaigns including different scores and flags', async () => {
  const saved = new Map<string, ProgressDto>();
  const make = (id: string) => {
    const s = getStoryRuntime(id);
    return createProgressMachine({ episode: s.firstEpisode, episodes: s.episodes, storyId: id, seasonId: s.seasonId, initial: progressFromDto(saved.get(id) ?? null, s.firstEpisode), save: async dto => { saved.set(dto.storyId, structuredClone(dto)); return dto; } });
  };
  const first = make('last-online');
  await first.advance();
  const before = structuredClone(saved.get('last-online'));
  const second = make('house-of-black-roses');
  await second.advance();
  expect(saved.get('last-online')).toEqual(before);
  expect(saved.get('house-of-black-roses')?.episodeId).toBe('house-of-black-roses-s1-e1');
  expect(make('last-online').current()).toEqual(first.current());
  expect(make('house-of-black-roses').current()).toEqual(second.current());
});
