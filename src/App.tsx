import { useEffect, useState } from 'react';
import { trackEvent } from './analytics/events';
import { EpisodeRecap } from './features/shell/EpisodeRecap';
import { SeasonScreen } from './features/shell/SeasonScreen';
import { StartScreen } from './features/shell/StartScreen';
import { StoryScreen } from './features/story/StoryScreen';
import { useProgress } from './progress/useProgress';
import { createProgressMachine, progressFromDto, type ProgressState } from './progress/model';
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
  episodeRewindPriceStars: number;
  onRewindComplete?(episodeId: string): Promise<void>;
  onChoose(id: string): Promise<void>;
  onAdvance(): Promise<void>;
  onNextEpisode(): Promise<void>;
  onRefreshOwnership?(): Promise<boolean>;
  onRetry?(): Promise<void>;
  analytics?: boolean;
  userDisplayName?: string;
};

function StoryFrame(props: StoryFrameProps) {
  const [screen, setScreen] = useState<'start' | 'season' | 'story' | 'recap'>('start');
  const [recapEpisodeId, setRecapEpisodeId] = useState<string>();
  const { sceneId, storyState } = props.progress;
  const episode = getEpisode(props.progress.episodeId);
  const hasProgress = episode.id !== firstEpisode.id || sceneId !== firstEpisode.startSceneId;
  const episodeCompleted = getScene(episode, sceneId).kind === 'terminal';

  function openSavedEpisode() {
    setScreen('story');
    if (props.analytics) void trackEvent('episode_started', { episodeId: episode.id, sceneId });
  }

  function openRecap(episodeId: string) {
    const selectedIndex = episodes.findIndex(candidate => candidate.id === episodeId);
    const currentIndex = episodes.findIndex(candidate => candidate.id === episode.id);
    const completed = selectedIndex >= 0 && (selectedIndex < currentIndex || (selectedIndex === currentIndex && episodeCompleted));
    if (!completed) return;
    setRecapEpisodeId(episodeId);
    setScreen('recap');
  }

  if (screen === 'start') return <StartScreen
    onStart={() => setScreen('season')}
    userDisplayName={props.userDisplayName}
    hasProgress={hasProgress}
    currentEpisodeId={episode.id}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
  />;
  if (screen === 'season') return <SeasonScreen
    hasProgress={hasProgress}
    currentEpisodeId={episode.id}
    episodeCompleted={episodeCompleted}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
    onPlay={openSavedEpisode}
    onOpenRecap={openRecap}
    onBack={() => setScreen('start')}
  />;
  if (screen === 'recap' && recapEpisodeId) return <EpisodeRecap
    episodeId={recapEpisodeId}
    rewindPriceStars={props.episodeRewindPriceStars}
    onRewindComplete={props.onRewindComplete ? async (episodeId) => {
      await props.onRewindComplete?.(episodeId);
      setRecapEpisodeId(undefined);
      setScreen('story');
    } : undefined}
    onBack={() => setScreen('season')}
  />;
  return (
    <>
      <StoryScreen
        episode={episode}
        sceneId={sceneId}
        state={storyState}
        onChoose={props.onChoose}
        onAdvance={props.onAdvance}
        nextEpisode={getNextEpisode(episode.id)}
        onNextEpisode={props.onNextEpisode}
        onMenu={() => setScreen('season')}
        disabled={props.status === 'loading' || props.status === 'saving' || props.status === 'error'}
        analytics={props.analytics}
        season1Owned={props.season1Owned}
        season1PriceStars={props.season1PriceStars}
        onRefreshOwnership={props.onRefreshOwnership}
      />
      {props.status === 'error' && props.onRetry ? (
        <aside className="lumi-save-error" role="alert">Не удалось сохранить. <button type="button" onClick={() => void props.onRetry?.().catch(() => undefined)}>Повторить</button></aside>
      ) : null}
    </>
  );
}
function ConnectedPrototype({ context }: { context: TelegramContext }) {
  const progress = useProgress(context.initData);
  useEffect(() => { void trackEvent('app_opened'); }, []);
  if (progress.status === 'error' && !progress.state) return <main className="lumi-shell lumi-shell--error"><p role="alert">Не удалось загрузить историю.</p><button className="lumi-primary" type="button" onClick={() => void progress.retry().catch(() => undefined)}>Повторить</button></main>;
  if (!progress.state) return <main className="lumi-shell"><p>Загружаем историю…</p></main>;
  return <StoryFrame progress={progress.state} status={progress.status} season1Owned={progress.season1Owned} season1PriceStars={progress.season1PriceStars} episodeRewindPriceStars={progress.episodeRewindPriceStars} userDisplayName={context.userDisplayName} onRewindComplete={async () => { await progress.reload(); }} onChoose={progress.choose} onAdvance={progress.advance} onNextEpisode={progress.nextEpisode} onRefreshOwnership={progress.refreshOwnership} onRetry={progress.retry} analytics />;
}

function LocalPrototype() {
  const [machine] = useState(() => createProgressMachine({ episode: firstEpisode, episodes, initial: progressFromDto(null, firstEpisode), save: async progress => progress }));
  const [progress, setProgress] = useState(machine.current());
  return <StoryFrame progress={progress} season1Owned season1PriceStars={149} episodeRewindPriceStars={49} userDisplayName="Игрок LUMI" onChoose={async id => { setProgress(await machine.choose(id)); }} onAdvance={async () => { setProgress(await machine.advance()); }} onNextEpisode={async () => { setProgress(await machine.nextEpisode()); }} />;
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
