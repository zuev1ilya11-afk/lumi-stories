import { useEffect, useState } from 'react';
import { trackEvent } from './analytics/events';
import { SeasonScreen } from './features/shell/SeasonScreen';
import { StartScreen } from './features/shell/StartScreen';
import { StoryScreen } from './features/story/StoryScreen';
import { useProgress } from './progress/useProgress';
import { advanceTransition, choiceTransition, createProgressMachine, progressFromDto, type ProgressState } from './progress/model';
import { getScene } from './story/engine';
import { episodes, firstEpisode, getEpisode, getNextEpisode } from './story/episodes';
import { getTelegramContext, TelegramContextError, type TelegramContext } from './telegram/telegram';

function isProductionBuild(): boolean {
  return import.meta.env.PROD;
}

type StoryFrameProps = {
  progress: ProgressState;
  status?: string;
  season1Owned: boolean;
  season1PriceStars: number;
  onChoose(id: string): Promise<void>;
  onAdvance(): Promise<void>;
  onNextEpisode(): Promise<void>;
  onRefreshOwnership?(): Promise<boolean>;
  onRetry?(): Promise<void>;
  analytics?: boolean;
  userDisplayName?: string;
};

function StoryFrame(props: StoryFrameProps) {
  const [screen, setScreen] = useState<'start' | 'season' | 'story'>('start');
  const [replayProgress, setReplayProgress] = useState<ProgressState | null>(null);
  const savedEpisode = getEpisode(props.progress.episodeId);
  const hasProgress = savedEpisode.id !== firstEpisode.id || props.progress.sceneId !== firstEpisode.startSceneId;
  const activeProgress = replayProgress ?? props.progress;
  const episode = getEpisode(activeProgress.episodeId);
  const replaying = replayProgress !== null;

  function openSavedEpisode() {
    setReplayProgress(null);
    setScreen('story');
    if (props.analytics) void trackEvent('episode_started', { episodeId: savedEpisode.id, sceneId: props.progress.sceneId });
  }

  function openEpisode(episodeId: string) {
    const selected = getEpisode(episodeId);
    const selectedIndex = episodes.findIndex(candidate => candidate.id === selected.id);
    const savedIndex = episodes.findIndex(candidate => candidate.id === savedEpisode.id);
    if (selectedIndex < 0 || selectedIndex > savedIndex) return;
    if (selected.id === savedEpisode.id) {
      openSavedEpisode();
      return;
    }
    setReplayProgress(progressFromDto(null, selected));
    setScreen('story');
    if (props.analytics) void trackEvent('replay_started', { episodeId: selected.id, sceneId: selected.startSceneId });
  }

  async function replayChoose(choiceId: string) {
    if (!replayProgress) return;
    setReplayProgress(choiceTransition(getEpisode(replayProgress.episodeId), replayProgress, choiceId));
  }

  async function replayAdvance() {
    if (!replayProgress) return;
    setReplayProgress(advanceTransition(getEpisode(replayProgress.episodeId), replayProgress));
  }

  if (screen === 'start') return <StartScreen
    onStart={() => setScreen('season')}
    userDisplayName={props.userDisplayName}
    hasProgress={hasProgress}
    currentEpisodeId={savedEpisode.id}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
  />;
  if (screen === 'season') return <SeasonScreen
    hasProgress={hasProgress}
    currentEpisodeId={savedEpisode.id}
    episodeCompleted={getScene(savedEpisode, props.progress.sceneId).kind === 'terminal'}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
    onPlay={openSavedEpisode}
    onSelectEpisode={openEpisode}
    onBack={() => setScreen('start')}
  />;
  return (
    <>
      <StoryScreen
        episode={episode}
        sceneId={activeProgress.sceneId}
        state={activeProgress.storyState}
        onChoose={replaying ? replayChoose : props.onChoose}
        onAdvance={replaying ? replayAdvance : props.onAdvance}
        nextEpisode={replaying ? undefined : getNextEpisode(episode.id)}
        onNextEpisode={replaying ? undefined : props.onNextEpisode}
        replayMode={replaying}
        onResumeCurrent={replaying ? openSavedEpisode : undefined}
        onMenu={() => { setReplayProgress(null); setScreen('season'); }}
        disabled={!replaying && (props.status === 'saving' || props.status === 'error')}
        analytics={props.analytics && !replaying}
        season1Owned={props.season1Owned}
        season1PriceStars={props.season1PriceStars}
        onRefreshOwnership={props.onRefreshOwnership}
      />
      {!replaying && props.status === 'error' && props.onRetry ? (
        <aside className="lumi-save-error" role="alert">Не удалось сохранить. <button type="button" onClick={() => void props.onRetry?.().catch(() => undefined)}>Повторить</button></aside>
      ) : null}
    </>
  );
}

function ConnectedPrototype({ context }: { context: TelegramContext }) {
  const progress = useProgress(context.initData);
  useEffect(() => { void trackEvent('app_opened'); }, []);
  if (progress.status === 'error' && !progress.state) return <main className="lumi-shell lumi-shell--error"><p role="alert">Не удалось загрузить историю.</p><button className="lumi-primary" type="button" onClick={() => void progress.retry().catch(() => undefined)}>Повторить</button></main>;
  if (progress.status === 'loading' || !progress.state) return <main className="lumi-shell"><p>Загружаем историю…</p></main>;
  return <StoryFrame progress={progress.state} status={progress.status} season1Owned={progress.season1Owned} season1PriceStars={progress.season1PriceStars} userDisplayName={context.userDisplayName} onChoose={progress.choose} onAdvance={progress.advance} onNextEpisode={progress.nextEpisode} onRefreshOwnership={progress.refreshOwnership} onRetry={progress.retry} analytics />;
}

function LocalPrototype() {
  const [machine] = useState(() => createProgressMachine({ episode: firstEpisode, episodes, initial: progressFromDto(null, firstEpisode), save: async progress => progress }));
  const [progress, setProgress] = useState(machine.current());
  return <StoryFrame progress={progress} season1Owned season1PriceStars={149} userDisplayName="Игрок LUMI" onChoose={async id => { setProgress(await machine.choose(id)); }} onAdvance={async () => { setProgress(await machine.advance()); }} onNextEpisode={async () => { setProgress(await machine.nextEpisode()); }} />;
}

export function App({ production = isProductionBuild() }: { production?: boolean } = {}) {
  let context: TelegramContext | null = null;
  try {
    context = getTelegramContext({ production });
  } catch (error) {
    if (!production && error instanceof TelegramContextError && error.code === 'TELEGRAM_DEV_CONTEXT_NOT_CONFIGURED') {
      return <LocalPrototype />;
    }
    if (error instanceof TelegramContextError && error.code === 'TELEGRAM_CONTEXT_REQUIRED') {
      return <main className="lumi-shell lumi-shell--error" aria-label="LUMI"><h1>LUMI</h1><p>Откройте LUMI из Telegram</p></main>;
    }
    throw error;
  }
  return context ? <ConnectedPrototype context={context} /> : <LocalPrototype />;
}
