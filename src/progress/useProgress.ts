import { useCallback, useEffect, useRef, useState } from 'react';
import episodeRaw from '../content/last-online/season-1/episode-1.json';
import { bootstrap, saveProgress } from '../api/client';
import { trackEvent } from '../analytics/events';
import { parseEpisode } from '../story/schema';
import { createProgressMachine, progressFromDto, type ProgressState } from './model';

const episode = parseEpisode(episodeRaw);
type ProgressStatus = 'loading' | 'ready' | 'saving' | 'error';

export function useProgress(initData: string): {
  status: ProgressStatus;
  state: ProgressState | null;
  choose(choiceId: string): Promise<void>;
  advance(): Promise<void>;
  retry(): Promise<void>;
} {
  const [status, setStatus] = useState<ProgressStatus>('loading');
  const [state, setState] = useState<ProgressState | null>(null);
  const machineRef = useRef<ReturnType<typeof createProgressMachine> | null>(null);
  const pendingAnalyticsRef = useRef<{ operation: 'advance' | 'choose'; sceneId: string; choiceId?: string } | null>(null);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    bootstrap(initData)
      .then((payload) => {
        if (!active) return;
        const initial = progressFromDto(payload.progress, episode);
        machineRef.current = createProgressMachine({
          episode,
          initial,
          save: (progress) => saveProgress(initData, progress),
        });
        setState(initial);
        setStatus('ready');
      })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [initData]);

  const run = useCallback(async (operation: 'advance' | 'retry' | 'choose', choiceId?: string) => {
    const machine = machineRef.current;
    if (!machine) return;
    if (operation !== 'retry') {
      pendingAnalyticsRef.current = { operation, sceneId: machine.current().sceneId, ...(choiceId ? { choiceId } : {}) };
    }
    setStatus('saving');
    try {
      const next = operation === 'choose'
        ? await machine.choose(choiceId ?? '')
        : operation === 'advance'
          ? await machine.advance()
          : await machine.retry();
      setState(next);
      setStatus('ready');
      const pendingAnalytics = pendingAnalyticsRef.current;
      if (pendingAnalytics?.operation === 'choose') {
        void trackEvent('choice_selected', { episodeId: episode.id, sceneId: pendingAnalytics.sceneId, choiceId: pendingAnalytics.choiceId });
      }
      if (pendingAnalytics) void trackEvent('scene_reached', { episodeId: episode.id, sceneId: next.sceneId });
      pendingAnalyticsRef.current = null;
    } catch {
      setStatus('error');
    }
  }, []);

  return {
    status,
    state,
    choose: (choiceId) => run('choose', choiceId),
    advance: () => run('advance'),
    retry: () => run('retry'),
  };
}
