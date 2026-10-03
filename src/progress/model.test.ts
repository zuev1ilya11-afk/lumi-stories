import { describe, expect, it, vi } from 'vitest';
import type { ProgressDto } from '../api/types';
import type { Episode } from '../story/schema';
import { createProgressMachine, progressFromDto, type ProgressState } from './model';

const first: Episode = {
  id: 'episode-1', title: 'One', startSceneId: 'start', scenes: [
    { id: 'start', kind: 'dialogue', text: 'Start', choices: [{ id: 'yes', text: 'Yes', nextSceneId: 'end', effects: [{ kind: 'inc', score: 'truthScore', by: 1 }] }] },
    { id: 'end', kind: 'terminal', text: 'End' },
  ],
};
const second: Episode = { id: 'last-online-s1-e2', title: 'Two', startSceneId: 'ep2_morning', scenes: [{ id: 'ep2_morning', kind: 'narrative', text: 'Morning', nextSceneId: 'ep2_end' }, { id: 'ep2_end', kind: 'terminal', text: 'End' }] };
const initial: ProgressState = { episodeId: first.id, sceneId: 'end', storyState: { junhoScore: 5, taeyunScore: 2, truthScore: 4, riskScore: 3, flags: { evidence: true, first_impression: 'warm', count: 2, denied: false } } };
const echo = async (dto: ProgressDto) => dto;

describe('episode progress machine', () => {
  it('saves the next episode start with every score and flag intact', async () => {
    const save = vi.fn(echo);
    const machine = createProgressMachine({ episode: first, episodes: [first, second], initial, save });
    const next = await machine.nextEpisode();
    expect(next).toEqual({ ...initial, episodeId: second.id, sceneId: second.startSceneId });
    expect(save).toHaveBeenCalledExactlyOnceWith({ storyId: 'last-online', seasonId: 'season-1', episodeId: second.id, sceneId: second.startSceneId, ...initial.storyState });
  });

  it('does not permit jumping episodes before the terminal or save after the last episode', async () => {
    const save = vi.fn(echo);
    const machine = createProgressMachine({ episode: first, episodes: [first, second], initial: { ...initial, sceneId: 'start' }, save });
    await expect(machine.nextEpisode()).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
    const last = createProgressMachine({ episode: first, episodes: [first, second], initial: { ...initial, episodeId: second.id, sceneId: 'ep2_end' }, save });
    expect(await last.nextEpisode()).toEqual(last.current());
    expect(save).not.toHaveBeenCalled();
  });

  it('retains a failed next-episode candidate and deduplicates concurrent transition and retry requests', async () => {
    let resolve!: (dto: ProgressDto) => void;
    const save = vi.fn<(dto: ProgressDto) => Promise<ProgressDto>>().mockRejectedValueOnce(new Error('offline')).mockImplementation(() => new Promise(done => { resolve = done; }));
    const machine = createProgressMachine({ episode: first, episodes: [first, second], initial, save });
    await expect(machine.nextEpisode()).rejects.toThrow('offline');
    expect(machine.current()).toEqual(initial);
    expect(machine.pending()).toEqual({ ...initial, episodeId: second.id, sceneId: second.startSceneId });
    const retry = machine.retry();
    const duplicate = machine.retry();
    const overlap = machine.nextEpisode();
    expect(save).toHaveBeenCalledTimes(2);
    resolve(save.mock.calls[1][0]);
    await Promise.all([retry, duplicate, overlap]);
    expect(machine.pending()).toBeNull();
    expect(machine.current().episodeId).toBe(second.id);
  });

  it('retries choice effects once and does not replace the pending candidate', async () => {
    const save = vi.fn(echo).mockRejectedValueOnce(new Error('offline'));
    const start = { ...initial, sceneId: 'start' };
    const machine = createProgressMachine({ episode: first, episodes: [first, second], initial: start, save });
    await expect(machine.choose('yes')).rejects.toThrow('offline');
    await expect(machine.choose('yes')).rejects.toThrow();
    expect(save).toHaveBeenCalledTimes(1);
    const next = await machine.retry();
    expect(next.storyState.truthScore).toBe(initial.storyState.truthScore + 1);
    expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]);
  });

  it('restores an episode-aware DTO and rejects mismatched episodes', () => {
    const dto: ProgressDto = { storyId: 'last-online', seasonId: 'season-1', episodeId: second.id, sceneId: second.startSceneId, ...initial.storyState };
    expect(progressFromDto(dto, second)).toEqual({ ...initial, episodeId: second.id, sceneId: second.startSceneId });
    expect(() => progressFromDto(dto, first)).toThrow();
  });
});
