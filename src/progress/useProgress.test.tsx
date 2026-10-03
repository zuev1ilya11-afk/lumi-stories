import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BootstrapResponse, ProgressDto } from '../api/types';
import { useProgress } from './useProgress';

const saved: ProgressDto = {
  storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e1',
  sceneId: 'ep1_first_meet', junhoScore: 2, taeyunScore: 0, truthScore: 1, riskScore: 0,
  flags: { first_impression: 'warm' },
};

const bootstrapPayload: BootstrapResponse = {
  playerId: 'p1', telegramUserId: 42, season1Owned: false, progress: saved,
};

const { bootstrap, saveProgress, trackEvent } = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  saveProgress: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('../analytics/events', () => ({ trackEvent }));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client') as typeof import('../api/client');
  return { ...actual, bootstrap, saveProgress };
});

describe('useProgress', () => {
  beforeEach(() => {
    bootstrap.mockReset();
    saveProgress.mockReset();
    trackEvent.mockReset();
    bootstrap.mockResolvedValue(bootstrapPayload);
  });

  it('boots from server progress instead of episode start', async () => {
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.state?.sceneId).toBe('ep1_first_meet');
    expect(result.current.state?.storyState.junhoScore).toBe(2);
  });

  it('does not advance visible state when save fails and retry commits exactly once', async () => {
    saveProgress.mockRejectedValueOnce(new Error('offline')).mockImplementation(async (_init: string, dto: ProgressDto) => dto);
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.state?.sceneId;

    await act(async () => { await expect(result.current.advance()).rejects.toThrow('offline'); });
    expect(result.current.status).toBe('error');
    expect(result.current.state?.sceneId).toBe(before);

    await act(async () => { await result.current.retry(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.state?.sceneId).not.toBe(before);
    expect(saveProgress).toHaveBeenCalledTimes(2);
  });

  it('restores episode 2 from its saved DTO', async () => {
    bootstrap.mockResolvedValue({ ...bootstrapPayload, progress: { ...saved, episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' } });
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.state).toMatchObject({ episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning', storyState: { junhoScore: saved.junhoScore, flags: saved.flags } });
  });

  it('deduplicates next-episode taps and sends analytics with the new episode id', async () => {
    bootstrap.mockResolvedValue({ ...bootstrapPayload, progress: { ...saved, sceneId: 'ep1_end_paywall' } });
    let release!: () => void;
    saveProgress.mockImplementation((_init: string, dto: ProgressDto) => new Promise<ProgressDto>(resolve => { release = () => resolve(dto); }));
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => { first = result.current.nextEpisode(); duplicate = result.current.nextEpisode(); });
    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saving');
    expect(result.current.state?.sceneId).toBe('ep1_end_paywall');
    await act(async () => { release(); await Promise.all([first, duplicate]); });
    expect(result.current.state).toMatchObject({ episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning', storyState: { junhoScore: saved.junhoScore, flags: saved.flags } });
    expect(trackEvent).toHaveBeenCalledWith('episode_started', { episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' });
    expect(trackEvent.mock.calls.filter(([name]) => name === 'scene_reached')).toEqual([['scene_reached', { episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' }]]);
  });

  it('keeps the failed next episode candidate and deduplicates retry taps', async () => {
    bootstrap.mockResolvedValue({ ...bootstrapPayload, progress: { ...saved, sceneId: 'ep1_end_paywall' } });
    let release!: () => void;
    saveProgress.mockRejectedValueOnce(new Error('offline')).mockImplementation((_init: string, dto: ProgressDto) => new Promise<ProgressDto>(resolve => { release = () => resolve(dto); }));
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await expect(result.current.nextEpisode()).rejects.toThrow('offline'); });
    expect(result.current.state?.episodeId).toBe('last-online-s1-e1');
    expect(trackEvent).not.toHaveBeenCalled();
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => { first = result.current.retry(); duplicate = result.current.retry(); });
    expect(saveProgress).toHaveBeenCalledTimes(2);
    expect(saveProgress.mock.calls[1]).toEqual(saveProgress.mock.calls[0]);
    await act(async () => { release(); await Promise.all([first, duplicate]); });
    expect(result.current.state?.episodeId).toBe('last-online-s1-e2');
    expect(trackEvent.mock.calls.filter(([name]) => name === 'episode_started')).toHaveLength(1);
  });

  it('retries bootstrap after unsupported progress instead of leaving a loading screen', async () => {
    bootstrap.mockResolvedValueOnce({ ...bootstrapPayload, progress: { ...saved, episodeId: 'missing' } }).mockResolvedValue(bootstrapPayload);
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.state).toBeNull();
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it('recovers from an invalid choice without entering an unretryable save error', async () => {
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.state;
    await act(async () => { await expect(result.current.choose('missing-choice')).rejects.toThrow(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.state).toBe(before);
    expect(saveProgress).not.toHaveBeenCalled();
    saveProgress.mockImplementation(async (_init: string, dto: ProgressDto) => dto);
    await act(async () => { await result.current.advance(); });
    expect(result.current.state?.sceneId).not.toBe(before?.sceneId);
  });

  it('recovers from a premature episode transition without disabling valid progress actions', async () => {
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const before = result.current.state;
    await act(async () => { await expect(result.current.nextEpisode()).rejects.toThrow(); });
    expect(result.current.status).toBe('ready');
    expect(result.current.state).toBe(before);
    expect(saveProgress).not.toHaveBeenCalled();
    await act(async () => { await result.current.retry(); });
    expect(result.current.status).toBe('ready');
  });

  it('normalizes published episode 2 progress in memory and saves it only on an actual scene transition', async () => {
    const legacy: ProgressDto = { ...saved, episodeId: 'last-online-s1-e2', sceneId: 'ep2_last_call', flags: { ...saved.flags, showed_taeyun_photo: true, taeyun_told_sim: true } };
    bootstrap.mockResolvedValue({ ...bootstrapPayload, progress: legacy });
    saveProgress.mockImplementation(async (_init: string, dto: ProgressDto) => dto);
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.state).toMatchObject({ episodeId: 'last-online-s1-e2', sceneId: 'ep2_soa_incoming', storyState: { junhoScore: saved.junhoScore, taeyunScore: saved.taeyunScore, truthScore: saved.truthScore, riskScore: saved.riskScore, flags: { ...legacy.flags, ep2_phone_response: 'truth', ep2_photo_evidence: 'full', ep2_legacy_normalized: true } } });
    expect(saveProgress).not.toHaveBeenCalled();
    await act(async () => { await result.current.advance(); });
    expect(saveProgress).toHaveBeenCalledExactlyOnceWith('signed', { ...legacy, sceneId: 'ep2_soa_outgoing', flags: { ...legacy.flags, ep2_phone_response: 'truth', ep2_photo_evidence: 'full', ep2_legacy_normalized: true } });
  });

  it('boots the provisional episode alias as canonical current progress', async () => {
    bootstrap.mockResolvedValue({ ...bootstrapPayload, progress: { ...saved, episodeId: 'episode-2', sceneId: 'ep2_morning' } });
    const { result } = renderHook(() => useProgress('signed'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.state).toMatchObject({ episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning', storyState: { flags: saved.flags } });
    expect(saveProgress).not.toHaveBeenCalled();
  });
});
