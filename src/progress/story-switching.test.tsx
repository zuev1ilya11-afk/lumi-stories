import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ProgressDto } from '../api/types';
import { useProgress } from './useProgress';
const { bootstrap, loadProgress, saveProgress } = vi.hoisted(() => ({ bootstrap: vi.fn(), loadProgress: vi.fn(), saveProgress: vi.fn() }));
vi.mock('../api/client', async () => ({ ...await vi.importActual('../api/client'), bootstrap, loadProgress, saveProgress }));
vi.mock('../analytics/events', () => ({ trackEvent: vi.fn() }));
const old: ProgressDto = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e1', sceneId: 'ep1_first_meet', junhoScore: 4, taeyunScore: 2, truthScore: 3, riskScore: 1, flags: { first_impression: 'warm' } };
const gothic: ProgressDto = { storyId: 'house-of-black-roses', seasonId: 'season-1', episodeId: 'house-of-black-roses-s1-e1', sceneId: 'gothic_ep1_rules_choice', junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };
const payload = { playerId: 'p', telegramUserId: 42, season1Owned: false, progress: old };
beforeEach(() => { vi.clearAllMocks(); bootstrap.mockResolvedValue(payload); loadProgress.mockResolvedValue(gothic); saveProgress.mockImplementation(async (_: string, dto: ProgressDto) => dto); });

it('switches last-online → roses → last-online without changing scores, flags or episode', async () => {
  const { result, rerender } = renderHook(({ story }) => useProgress('signed', story), { initialProps: { story: 'last-online' } });
  await waitFor(() => expect(result.current.state?.sceneId).toBe(old.sceneId));
  rerender({ story: gothic.storyId });
  expect(result.current.state).toBeNull();
  await waitFor(() => expect(result.current.state?.sceneId).toBe(gothic.sceneId));
  expect(result.current.season1Owned).toBe(true);
  expect(result.current.season1PriceStars).toBe(0);
  await act(async () => { await result.current.choose('gothic_ep1_rules_accept'); });
  expect(result.current.state?.storyState.flags.gothic_rules_response).toBe('accept');
  rerender({ story: old.storyId });
  await waitFor(() => expect(result.current.state?.sceneId).toBe(old.sceneId));
  expect(result.current.state?.storyState).toEqual({ junhoScore: 4, taeyunScore: 2, truthScore: 3, riskScore: 1, flags: old.flags });
});

it('rejects mismatched loaded story identity even if the episode happens to match', async () => {
  loadProgress.mockResolvedValue({ ...gothic, storyId: 'last-online' });
  const { result } = renderHook(() => useProgress('signed', gothic.storyId));
  await waitFor(() => expect(result.current.status).not.toBe('loading'));
  expect(result.current.status).toBe('error');
  expect(result.current.state).toBeNull();
});

it('ignores an old reload that completes after switching to another story', async () => {
  const { result, rerender } = renderHook(({ story }) => useProgress('signed', story), { initialProps: { story: old.storyId } });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  let release!: (p: typeof payload) => void;
  bootstrap.mockImplementationOnce(() => new Promise(r => { release = r; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.reload(); });
  rerender({ story: gothic.storyId });
  await waitFor(() => expect(result.current.state?.sceneId).toBe(gothic.sceneId));
  await act(async () => { release(payload); await pending; });
  expect(result.current.state?.sceneId).toBe(gothic.sceneId);
  expect(result.current.state?.episodeId).toBe(gothic.episodeId);
});

it('reloads the committed decision after a round trip while its save is pending', async () => {
  let serverProgress = structuredClone(gothic);
  loadProgress.mockImplementation(async () => structuredClone(serverProgress));
  let release!: () => void;
  saveProgress.mockImplementationOnce((_: string, dto: ProgressDto) => new Promise(resolve => {
    release = () => { serverProgress = structuredClone(dto); resolve(dto); };
  }));
  const { result, rerender } = renderHook(({ story }) => useProgress('signed', story), { initialProps: { story: gothic.storyId } });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  let pending!: Promise<void>;
  act(() => { pending = result.current.choose('gothic_ep1_rules_question'); });
  await act(async () => { rerender({ story: old.storyId }); });
  await act(async () => { rerender({ story: gothic.storyId }); });
  await act(async () => { release(); await pending; });
  await waitFor(() => expect(result.current.state?.sceneId).toBe('gothic_ep1_question_rules'));
  expect(result.current.state?.storyState).toMatchObject({ junhoScore: 1, truthScore: 1, flags: { gothic_rules_response: 'question' } });
  expect(saveProgress).toHaveBeenCalledTimes(1);
  expect(payload.progress).toEqual(old);
});
