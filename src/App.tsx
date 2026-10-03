import { useEffect, useState } from 'react';
import { trackEvent } from './analytics/events';
import { EpisodeRecap } from './features/shell/EpisodeRecap';
import { SeasonScreen } from './features/shell/SeasonScreen';
import { StartScreen } from './features/shell/StartScreen';
import { StoryScreen } from './features/story/StoryScreen';
import { useProgress } from './progress/useProgress';
import { createProgressMachine, progressFromDto, type ProgressState } from './progress/model';
import { getScene } from './story/engine';
import { getNextStoryEpisode, getStoryEpisode, getStoryRuntime } from './story/stories';
import { getTelegramContext, readyTelegramApp, TelegramContextError, type TelegramContext } from './telegram/telegram';

function isProductionBuild(): boolean {
  return import.meta.env.PROD;
}

type StoryFrameProps = {
  storyId: string;
  progress: ProgressState;
  status?: string;
  season1Owned: boolean;
  season1PriceStars: number;
  episodeRewindPriceStars: number;
  initialScreen?: 'start' | 'season';
  onOpenStory?(storyId: string): void;
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
  const [screen, setScreen] = useState<'start' | 'season' | 'story' | 'recap'>(props.initialScreen ?? 'start');
  const [recapEpisodeId, setRecapEpisodeId] = useState<string>();
  const story = getStoryRuntime(props.storyId);
  const { sceneId, storyState } = props.progress;
  const episode = getStoryEpisode(props.storyId, props.progress.episodeId);
  const hasProgress = episode.id !== story.firstEpisode.id || sceneId !== story.firstEpisode.startSceneId;
  const episodeCompleted = getScene(episode, sceneId).kind === 'terminal';

  function openSavedEpisode() {
    setScreen('story');
    if (props.analytics) void trackEvent('episode_started', { episodeId: episode.id, sceneId });
  }

  function openStory(storyId: string) {
    if (storyId === props.storyId) {
      setScreen('season');
      return;
    }
    props.onOpenStory?.(storyId);
  }

  function openRecap(episodeId: string) {
    const selectedIndex = story.episodes.findIndex(candidate => candidate.id === episodeId);
    const currentIndex = story.episodes.findIndex(candidate => candidate.id === episode.id);
    const completed = selectedIndex >= 0 && (selectedIndex < currentIndex || (selectedIndex === currentIndex && episodeCompleted));
    if (!completed) return;
    setRecapEpisodeId(episodeId);
    setScreen('recap');
  }

  if (screen === 'start') return <StartScreen
    onStart={() => setScreen('season')}
    onOpenStory={openStory}
    userDisplayName={props.userDisplayName}
    hasProgress={hasProgress}
    currentStoryId={props.storyId}
    currentEpisodeId={episode.id}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
  />;
  if (screen === 'season') return <SeasonScreen
    storyId={props.storyId}
    hasProgress={hasProgress}
    currentEpisodeId={episode.id}
    episodeCompleted={episodeCompleted}
    season1Owned={props.season1Owned}
    season1PriceStars={props.season1PriceStars}
    onPlay={openSavedEpisode}
    onOpenRecap={props.storyId === 'last-online' ? openRecap : undefined}
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
        storyId={props.storyId}
        seasonId={story.seasonId}
        episode={episode}
        sceneId={sceneId}
        state={storyState}
        onChoose={props.onChoose}
        onAdvance={props.onAdvance}
        nextEpisode={getNextStoryEpisode(props.storyId, episode.id)}
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
  const [storyId, setStoryId] = useState('last-online');
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [initialScreen, setInitialScreen] = useState<'start' | 'season'>('start');
  const progress = useProgress(context.initData, storyId);

  useEffect(() => {
    readyTelegramApp();
    void trackEvent('app_opened');
  }, []);

  function selectStory(nextStoryId: string) {
    setStoryId(nextStoryId);
    setInitialScreen('season');
    setSelectionRevision(revision => revision + 1);
  }

  if (progress.status === 'error' && !progress.state) return <main className="lumi-shell lumi-shell--error"><p role="alert">Не удалось загрузить историю.</p><button className="lumi-primary" type="button" onClick={() => void progress.retry().catch(() => undefined)}>Повторить</button></main>;
  if (!progress.state) return <main className="lumi-shell"><p>Загружаем историю…</p></main>;
  return <StoryFrame
    key={`${storyId}:${selectionRevision}`}
    storyId={storyId}
    initialScreen={initialScreen}
    progress={progress.state}
    status={progress.status}
    season1Owned={progress.season1Owned}
    season1PriceStars={progress.season1PriceStars}
    episodeRewindPriceStars={progress.episodeRewindPriceStars}
    userDisplayName={context.userDisplayName}
    onOpenStory={selectStory}
    onRewindComplete={async () => { await progress.reload(); }}
    onChoose={progress.choose}
    onAdvance={progress.advance}
    onNextEpisode={progress.nextEpisode}
    onRefreshOwnership={progress.refreshOwnership}
    onRetry={progress.retry}
    analytics
  />;
}

function LocalStoryPrototype({ storyId, initialScreen, onOpenStory }: { storyId: string; initialScreen: 'start' | 'season'; onOpenStory(storyId: string): void }) {
  const story = getStoryRuntime(storyId);
  const [machine] = useState(() => createProgressMachine({
    episode: story.firstEpisode,
    episodes: story.episodes,
    storyId: story.id,
    seasonId: story.seasonId,
    initial: progressFromDto(null, story.firstEpisode),
    save: async progress => progress,
  }));
  const [progress, setProgress] = useState(machine.current());
  return <StoryFrame
    storyId={storyId}
    initialScreen={initialScreen}
    progress={progress}
    season1Owned
    season1PriceStars={story.free ? 0 : 149}
    episodeRewindPriceStars={story.id === 'last-online' ? 49 : 0}
    userDisplayName="Игрок LUMI"
    onOpenStory={onOpenStory}
    onChoose={async id => { setProgress(await machine.choose(id)); }}
    onAdvance={async () => { setProgress(await machine.advance()); }}
    onNextEpisode={async () => { setProgress(await machine.nextEpisode()); }}
  />;
}

function LocalPrototype() {
  const [storyId, setStoryId] = useState('last-online');
  const [revision, setRevision] = useState(0);
  const [initialScreen, setInitialScreen] = useState<'start' | 'season'>('start');
  function selectStory(nextStoryId: string) {
    setStoryId(nextStoryId);
    setInitialScreen('season');
    setRevision(value => value + 1);
  }
  return <LocalStoryPrototype key={`${storyId}:${revision}`} storyId={storyId} initialScreen={initialScreen} onOpenStory={selectStory} />;
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
