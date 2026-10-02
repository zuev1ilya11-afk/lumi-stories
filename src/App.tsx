import { useEffect, useMemo, useState } from 'react';
import { trackEvent } from './analytics/events';
import episodeRaw from './content/last-online/season-1/episode-1.json';
import { SeasonScreen } from './features/shell/SeasonScreen';
import { StartScreen } from './features/shell/StartScreen';
import { StoryScreen } from './features/story/StoryScreen';
import { useProgress } from './progress/useProgress';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from './story/engine';
import { parseEpisode, type StoryState } from './story/schema';
import { getTelegramContext, TelegramContextError, type TelegramContext } from './telegram/telegram';

const episode = parseEpisode(episodeRaw);
const initialState: StoryState = { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} };

function isProductionBuild(): boolean {
  return ((import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD ?? false) === true;
}

function StoryFrame(props: { sceneId: string; storyState: StoryState; status?: string; onChoose(id: string): Promise<void>; onAdvance(): Promise<void>; onRetry?(): Promise<void>; analytics?: boolean }) {
  const [screen, setScreen] = useState<'start' | 'season' | 'story'>('start');
  const hasProgress = props.sceneId !== episode.startSceneId;
  if (screen === 'start') return <StartScreen onStart={() => setScreen('season')} />;
  if (screen === 'season') return <SeasonScreen hasProgress={hasProgress} onPlay={() => { setScreen('story'); if (props.analytics) void trackEvent('episode_started', { episodeId: episode.id, sceneId: props.sceneId }); }} onBack={() => setScreen('start')} />;
  return (
    <>
      <StoryScreen episode={episode} sceneId={props.sceneId} state={props.storyState} onChoose={props.onChoose} onAdvance={props.onAdvance} onMenu={() => setScreen('season')} />
      {props.status === 'error' && props.onRetry ? (
        <aside className="lumi-save-error" role="alert">Не удалось сохранить. <button type="button" onClick={() => void props.onRetry?.()}>Повторить</button></aside>
      ) : null}
    </>
  );
}

function ConnectedPrototype({ context }: { context: TelegramContext }) {
  const progress = useProgress(context.initData);
  useEffect(() => { void trackEvent('app_opened'); }, []);
  if (progress.status === 'loading' || !progress.state) return <main className="lumi-shell"><p>Загружаем историю…</p></main>;
  return <StoryFrame sceneId={progress.state.sceneId} storyState={progress.state.storyState} status={progress.status} onChoose={progress.choose} onAdvance={progress.advance} onRetry={progress.retry} analytics />;
}

function LocalPrototype() {
  const [sceneId, setSceneId] = useState(episode.startSceneId);
  const [storyState, setStoryState] = useState<StoryState>(initialState);
  const currentScene = useMemo(() => getScene(episode, sceneId), [sceneId]);
  async function choose(choiceId: string) {
    const choice = getAvailableChoices(currentScene, storyState).find((candidate) => candidate.id === choiceId);
    if (!choice) return;
    setStoryState((current) => applyChoice(current, choice));
    setSceneId(choice.nextSceneId);
  }
  async function advance() {
    const next = resolveNextScene(currentScene, storyState);
    if (next) setSceneId(next);
  }
  return <StoryFrame sceneId={sceneId} storyState={storyState} onChoose={choose} onAdvance={advance} />;
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
