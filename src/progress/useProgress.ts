import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrap, getPaymentStatus, loadProgress, saveProgress } from '../api/client';
import { trackEvent } from '../analytics/events';
import { getStoryEpisode, getStoryRuntime } from '../story/stories';
import { createProgressMachine, progressFromDto, type ProgressState } from './model';
import { normalizeEpisode2Progress } from './legacyEpisode2';

type ProgressStatus = 'loading' | 'ready' | 'saving' | 'error';
type Operation = 'advance' | 'choose' | 'nextEpisode';

export function useProgress(initData: string, storyId = 'last-online'): {
  status: ProgressStatus;
  state: ProgressState | null;
  season1Owned: boolean;
  season1PriceStars: number;
  episodeRewindPriceStars: number;
  reload(): Promise<void>;
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  nextEpisode(): Promise<void>;
  retry(): Promise<void>;
  refreshOwnership(): Promise<boolean>;
} {
  const story = getStoryRuntime(storyId);
  const [status, setStatus] = useState<ProgressStatus>('loading');
  const [state, setState] = useState<ProgressState | null>(null);
  const [loadedStoryId, setLoadedStoryId] = useState<string | null>(null);
  const [season1Owned, setSeason1Owned] = useState(false);
  const [season1PriceStars, setSeason1PriceStars] = useState(149);
  const [episodeRewindPriceStars, setEpisodeRewindPriceStars] = useState(49);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const machineRef = useRef<ReturnType<typeof createProgressMachine> | null>(null);
  const bootstrapBusy = useRef(true);
  const generationRef = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingAnalyticsRef = useRef<{ operation: Operation; episodeId: string; sceneId: string; choiceId?: string } | null>(null);

  function configureAccess(payload: { season1Owned: boolean; season1PriceStars?: number; priceStars?: number; episodeRewindPriceStars?: number }) {
    setSeason1Owned(payload.season1Owned);
    setSeason1PriceStars(payload.season1PriceStars ?? payload.priceStars ?? 149);
    setEpisodeRewindPriceStars(story.id === 'last-online' ? (payload.episodeRewindPriceStars ?? 49) : 0);
  }

  function normalizeProgress(progress: Awaited<ReturnType<typeof loadProgress>> | null, episode: ReturnType<typeof getStoryEpisode>) {
    if (progress && (progress.storyId !== story.id || progress.seasonId !== story.seasonId)) {
      throw new Error('Progress identity mismatch');
    }
    return story.id === 'last-online' ? normalizeEpisode2Progress(progress, episode) : progress;
  }

  useEffect(() => {
    let active = true;
    generationRef.current += 1;
    bootstrapBusy.current = true;
    machineRef.current = null;
    pendingAnalyticsRef.current = null;
    setLoadedStoryId(null);
    setState(null);
    setStatus('loading');

    void (async () => {
      try {
        // A round trip must read after the previous story's scene-boundary write.
        // Failed writes leave the server's last committed checkpoint authoritative.
        if (inFlight.current) await inFlight.current.catch(() => undefined);
        if (!active) return;
        const payload = await bootstrap(initData);
        const [rawProgress, access] = story.id === 'last-online'
          ? [payload.progress, payload] as const
          : await Promise.all([
              loadProgress(initData, story.id, story.seasonId),
              getPaymentStatus(initData, story.id, story.seasonId),
            ]);
        if (!active) return;
        const episode = getStoryEpisode(story.id, rawProgress?.episodeId);
        const initial = progressFromDto(normalizeProgress(rawProgress, episode), episode);
        machineRef.current = createProgressMachine({
          episode: story.firstEpisode,
          episodes: story.episodes,
          storyId: story.id,
          seasonId: story.seasonId,
          initial,
          save: (progress) => saveProgress(initData, progress),
        });
        configureAccess(access);
        setState(initial);
        setLoadedStoryId(story.id);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      } finally {
        if (active) bootstrapBusy.current = false;
      }
    })();

    return () => { active = false; generationRef.current += 1; };
  }, [initData, storyId, bootstrapAttempt]);

  const refreshOwnership = useCallback(async (): Promise<boolean> => {
    const generation = generationRef.current;
    const payment = await getPaymentStatus(initData, story.id, story.seasonId);
    if (generation !== generationRef.current) return false;
    setSeason1Owned(payment.season1Owned);
    setSeason1PriceStars(payment.priceStars);
    setEpisodeRewindPriceStars(payment.episodeRewindPriceStars ?? 49);
    return payment.season1Owned;
  }, [initData, storyId]);

  const run = useCallback((operation: Operation | 'retry', choiceId?: string): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const machine = machineRef.current;
    if (!machine) {
      if (operation === 'retry' && !bootstrapBusy.current) {
        bootstrapBusy.current = true;
        setBootstrapAttempt(attempt => attempt + 1);
      }
      return Promise.resolve();
    }
    if (operation !== 'retry' && machine.pending()) return Promise.reject(new Error('Retry the pending save before continuing'));
    if (operation === 'retry' && !machine.pending()) return Promise.resolve();
    if (operation !== 'retry') {
      const current = machine.current();
      pendingAnalyticsRef.current = { operation, episodeId: current.episodeId ?? story.firstEpisode.id, sceneId: current.sceneId, ...(choiceId ? { choiceId } : {}) };
    }
    setStatus('saving');
    inFlight.current = (async () => {
      try {
        const before = machine.current();
        const next = operation === 'choose'
          ? await machine.choose(choiceId ?? '')
          : operation === 'advance'
            ? await machine.advance()
            : operation === 'nextEpisode'
              ? await machine.nextEpisode()
              : await machine.retry();
        if (machineRef.current !== machine) return;
        setState(next);
        setStatus('ready');
        const pending = pendingAnalyticsRef.current;
        const episodeId = next.episodeId ?? story.firstEpisode.id;
        if (pending && next !== before) {
          if (pending.operation === 'choose') void trackEvent('choice_selected', { episodeId: pending.episodeId, sceneId: pending.sceneId, choiceId: pending.choiceId });
          if (pending.operation === 'nextEpisode') void trackEvent('episode_started', { episodeId, sceneId: next.sceneId });
          void trackEvent('scene_reached', { episodeId, sceneId: next.sceneId });
        }
        pendingAnalyticsRef.current = null;
      } catch (error) {
        if (machineRef.current === machine) {
          setStatus(machine.pending() ? 'error' : 'ready');
          if (!machine.pending()) pendingAnalyticsRef.current = null;
        }
        throw error;
      } finally {
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [storyId]);

  const reload = useCallback(async (): Promise<void> => {
    const generation = generationRef.current;
    if (inFlight.current) await inFlight.current;
    if (generation !== generationRef.current) return;
    setStatus('loading');
    try {
      const payload = await bootstrap(initData);
      const [rawProgress, access] = story.id === 'last-online'
        ? [payload.progress, payload] as const
        : await Promise.all([
            loadProgress(initData, story.id, story.seasonId),
            getPaymentStatus(initData, story.id, story.seasonId),
          ]);
      if (generation !== generationRef.current) return;
      const episode = getStoryEpisode(story.id, rawProgress?.episodeId);
      const initial = progressFromDto(normalizeProgress(rawProgress, episode), episode);
      machineRef.current = createProgressMachine({
        episode: story.firstEpisode,
        episodes: story.episodes,
        storyId: story.id,
        seasonId: story.seasonId,
        initial,
        save: (progress) => saveProgress(initData, progress),
      });
      pendingAnalyticsRef.current = null;
      configureAccess(access);
      setState(initial);
      setLoadedStoryId(story.id);
      setStatus('ready');
    } catch (error) {
      if (generation !== generationRef.current) return;
      setStatus('error');
      throw error;
    }
  }, [initData, storyId]);

  return {
    status,
    state: loadedStoryId === storyId ? state : null,
    season1Owned,
    season1PriceStars,
    episodeRewindPriceStars,
    reload,
    choose: choiceId => run('choose', choiceId),
    advance: () => run('advance'),
    nextEpisode: () => run('nextEpisode'),
    retry: () => run('retry'),
    refreshOwnership,
  };
}
