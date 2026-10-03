import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapResponse, ProgressDto } from '../api/types';
import { useProgress } from './useProgress';

const saved: ProgressDto = {
  storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e1',
  sceneId: 'ep1_first_meet', junhoScore: 2, taeyunScore: 0, truthScore: 1, riskScore: 0,
  flags: { first_impression: 'warm' },
};
const bootstrapPayload: BootstrapResponse = { playerId: 'p1', telegramUserId: 42, season1Owned: false, progress: saved };
const { bootstrap, saveProgress } = vi.hoisted(() => ({ bootstrap: vi.fn(), saveProgress: vi.fn() }));
vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client') as typeof import('../api/client');
  return { ...actual, bootstrap, saveProgress };
});

describe('useProgress', () => {
  beforeEach(() => { bootstrap.mockReset(); saveProgress.mockReset(); bootstrap.mockResolvedValue(bootstrapPayload); });
  it('boots from server progress instead of episode start', async () => {
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.episode.id).toBe('last-online-s1-e1');
    expect(result.current.state?.sceneId).toBe('ep1_first_meet');
    expect(result.current.state?.storyState.junhoScore).toBe(2);
  });
  it('does not advance visible state when save fails and retry commits exactly once', async () => {
    saveProgress.mockRejectedValueOnce(new Error('offline')).mockImplementation(async (_init: string, dto: ProgressDto) => dto);
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.state?.sceneId;
    await act(async () => { await result.current.advance(); });
    expect(result.current.status).toBe('error');
    expect(result.current.state?.sceneId).toBe(before);
    await act(async () => { await result.current.retry(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.state?.sceneId).not.toBe(before);
    expect(saveProgress).toHaveBeenCalledTimes(2);
  });
  it('starts Episode 2 while preserving accumulated story state', async () => {
    saveProgress.mockImplementation(async (_init: string, dto: ProgressDto) => dto);
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.startEpisode('last-online-s1-e2'); });
    expect(result.current.episode.id).toBe('last-online-s1-e2');
    expect(result.current.state?.sceneId).toBe('ep2_morning_after');
    expect(result.current.state?.storyState.junhoScore).toBe(2);
    expect(saveProgress).toHaveBeenCalledWith('signed', expect.objectContaining({
      episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning_after', junhoScore: 2, flags: { first_impression: 'warm' },
    }));
  });
});
