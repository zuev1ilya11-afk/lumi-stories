import { useCallback, useEffect, useRef, useState } from 'react';
import { bootstrap, saveProgress } from '../api/client';
import { trackEvent } from '../analytics/events';
import { firstEpisode, getEpisodeById } from '../content/last-online/season-1/episodes';
import type { Episode } from '../story/schema';
import { createProgressMachine, progressFromDto, progressToDto, type ProgressState } from './model';

type ProgressStatus = 'loading' | 'ready' | 'saving' | 'error';

export function useProgress(initData: string): {
  status: ProgressStatus;
  state: ProgressState | null;
  episode: Episode;
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  retry(): Promise<void>;
  startEpisode(episodeId: string): Promise<void>;
} {
  const [status, setStatus] = useState<ProgressStatus>('loading');
  const [state, setState] = useState<ProgressState | null>(null);
  const [episode, setEpisode] = useState<Episode>(firstEpisode);
  const episodeRef = useRef<Episode>(firstEpisode);
  const machineRef = useRef<ReturnType<typeof createProgressMachine> | null>(null);
  const pendingEpisodeRef = useRef<string | null>(null);
  const pendingAnalyticsRef = useRef<{ operation: 'advance' | 'choose'; sceneId: string; choiceId?: string; episodeId: string } | null>(null);

  const makeMachine = useCallback((selected: Episode, initial: ProgressState) => createProgressMachine({
    episode: selected,
    initial,
    save: (progress) => saveProgress(initData, progress),
  }), [initData]);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    bootstrap(initData)
      .then((payload) => {
        if (!active) return;
        const selected = getEpisodeById(payload.progress?.episodeId);
        const initial = progressFromDto(payload.progress, selected);
        episodeRef.current = selected;
        setEpisode(selected);
        machineRef.current = makeMachine(selected, initial);
        setState(initial);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [initData, makeMachine]);

  const commitEpisodeStart = useCallback(async (episodeId: string) => {
    const machine = machineRef.current;
    if (!machine) return;
    const selected = getEpisodeById(episodeId);
    if (selected.id === episodeRef.current.id) return;
    pendingEpisodeRef.current = selected.id;
    setStatus('saving');
    try {
      const candidate: ProgressState = { sceneId: selected.startSceneId, storyState: machine.current().storyState };
      const saved = await saveProgress(initData, progressToDto(candidate, selected));
      const initial = progressFromDto(saved, selected);
      episodeRef.current = selected;
      setEpisode(selected);
      machineRef.current = makeMachine(selected, initial);
      pendingEpisodeRef.current = null;
      setState(initial);
      setStatus('ready');
      void trackEvent('episode_started', { episodeId: selected.id, sceneId: initial.sceneId });
    } catch {
      setStatus('error');
    }
  }, [initData, makeMachine]);

  const run = useCallback(async (operation: 'advance' | 'retry' | 'choose', choiceId?: string) => {
    if (operation === 'retry' && pendingEpisodeRef.current) {
      await commitEpisodeStart(pendingEpisodeRef.current);
      return;
    }
    const machine = machineRef.current;
    if (!machine) return;
    if (operation !== 'retry') {
      pendingAnalyticsRef.current = { operation, sceneId: machine.current().sceneId, episodeId: episodeRef.current.id, ...(choiceId ? { choiceId } : {}) };
    }
    setStatus('saving');
    try {
      const next = operation === 'choose' ? await machine.choose(choiceId ?? '') : operation === 'advance' ? await machine.advance() : await machine.retry();
      setState(next);
      setStatus('ready');
      const pendingAnalytics = pendingAnalyticsRef.current;
      if (pendingAnalytics?.operation === 'choose') void trackEvent('choice_selected', { episodeId: pendingAnalytics.episodeId, sceneId: pendingAnalytics.sceneId, choiceId: pendingAnalytics.choiceId });
      if (pendingAnalytics) void trackEvent('scene_reached', { episodeId: pendingAnalytics.episodeId, sceneId: next.sceneId });
      pendingAnalyticsRef.current = null;
    } catch {
      setStatus('error');
    }
  }, [commitEpisodeStart]);

  return { status, state, episode, choose: (choiceId) => run('choose', choiceId), advance: () => run('advance'), retry: () => run('retry'), startEpisode: commitEpisodeStart };
}
