import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrap, saveProgress } from '../api/client';
import { trackEvent } from '../analytics/events';
import { episodes, firstEpisode, getEpisode } from '../story/episodes';
import { createProgressMachine, progressFromDto, type ProgressState } from './model';
import { normalizeEpisode2Progress } from './legacyEpisode2';

type ProgressStatus = 'loading' | 'ready' | 'saving' | 'error';
type Operation = 'advance' | 'choose' | 'nextEpisode';

export function useProgress(initData: string): {
  status: ProgressStatus;
  state: ProgressState | null;
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  nextEpisode(): Promise<void>;
  retry(): Promise<void>;
} {
  const [status, setStatus] = useState<ProgressStatus>('loading');
  const [state, setState] = useState<ProgressState | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const machineRef = useRef<ReturnType<typeof createProgressMachine> | null>(null);
  const bootstrapBusy = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);
  const pendingAnalyticsRef = useRef<{ operation: Operation; episodeId: string; sceneId: string; choiceId?: string } | null>(null);

  useEffect(() => {
    let active = true;
    bootstrapBusy.current = true;
    machineRef.current = null;
    pendingAnalyticsRef.current = null;
    setState(null);
    setStatus('loading');
    bootstrap(initData)
      .then((payload) => {
        if (!active) return;
        const episode = getEpisode(payload.progress?.episodeId);
        const initial = progressFromDto(normalizeEpisode2Progress(payload.progress, episode), episode);
        machineRef.current = createProgressMachine({
          episode: firstEpisode,
          episodes,
          initial,
          save: (progress) => saveProgress(initData, progress),
        });
        setState(initial);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); })
      .finally(() => { if (active) bootstrapBusy.current = false; });
    return () => { active = false; };
  }, [initData, bootstrapAttempt]);

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
      pendingAnalyticsRef.current = { operation, episodeId: current.episodeId ?? firstEpisode.id, sceneId: current.sceneId, ...(choiceId ? { choiceId } : {}) };
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
        const episodeId = next.episodeId ?? firstEpisode.id;
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
  }, []);

  return { status, state, choose: choiceId => run('choose', choiceId), advance: () => run('advance'), nextEpisode: () => run('nextEpisode'), retry: () => run('retry') };
}
