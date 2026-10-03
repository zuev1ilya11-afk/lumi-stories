import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '../../analytics/events';
import { readInterfacePreference } from '../../interfacePreferences';
import { getStoryCatalogEntry } from '../../story/catalog';
import { getAvailableChoices, getScene } from '../../story/engine';
import { getEpisodeNumber } from '../../story/episodes';
import type { Episode, Scene, StoryState } from '../../story/schema';
import { SoaChatScreen, type ChatTimelineEvent } from '../messages/SoaChatScreen';
import { PrototypePaywall } from '../paywall/PrototypePaywall';
import { ChoiceList } from './ChoiceList';
import { CinematicStage } from './CinematicStage';
import { DialogueBox } from './DialogueBox';
import { getSceneBeats, getScenePresentation, nearbyAssets, sceneAsset } from './presentation';
import { useBeatPlayback } from './useBeatPlayback';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  storyId?: string;
  seasonId?: string;
  episode: Episode;
  sceneId: string;
  state: StoryState;
  onChoose(choiceId: string): Promise<void> | void;
  onAdvance(): Promise<void> | void;
  onMenu?(): void;
  nextEpisode?: Episode;
  onNextEpisode?(): Promise<void> | void;
  disabled?: boolean;
  analytics?: boolean;
  season1Owned?: boolean;
  season1PriceStars?: number;
  onRefreshOwnership?(): Promise<boolean>;
};

export function StoryScreen(props: Props) {
  const scene = getScene(props.episode, props.sceneId);
  const chatHistory = useRef<ChatTimelineEvent[]>([]);
  const previous = useRef<string | undefined>(undefined);
  const previousArt = previous.current;

  return <ScenePlayer key={`${props.episode.id}:${scene.id}`} {...props} scene={scene} previous={previousArt} onArt={src => { previous.current = src; }} chatHistory={chatHistory.current} onHistory={messages => { chatHistory.current = messages; }} />;
}

function ScenePlayer({ storyId = 'last-online', seasonId = 'season-1', episode, scene, state, onChoose, onAdvance, onMenu, nextEpisode, onNextEpisode, disabled = false, analytics = false, season1Owned = false, season1PriceStars = 149, onRefreshOwnership, previous, onArt, chatHistory, onHistory }: Props & { scene: Scene; previous?: string; onArt(src?: string): void; chatHistory: ChatTimelineEvent[]; onHistory(messages: ChatTimelineEvent[]): void }) {
  const reduced = useReducedMotion();
  const playback = useBeatPlayback(getSceneBeats(scene), reduced);
  const p = getScenePresentation(scene, playback.beat);
  const choices = getAvailableChoices(scene, state);
  const [offer, setOffer] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const art = sceneAsset(p.cg ?? playback.beat.background ?? scene.background);
  useEffect(() => { onArt(art); }, [art, onArt]);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string>();
  const assets = nearbyAssets(episode, scene, playback.index).join('\n');
  useEffect(() => { if (offer && analytics) void trackEvent('episode_finished', { episodeId: episode.id, sceneId: scene.id }); }, [offer, analytics, episode.id, scene.id]);
  useEffect(() => { assets.split('\n').filter(Boolean).forEach(src => { const image = new Image(); image.src = src; }); }, [assets]);
  useEffect(() => {
    if (!p.haptic || reduced || !readInterfacePreference('haptics')) return;
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(p.haptic); } catch { /* Unsupported Telegram client. */ }
  }, [p.haptic, reduced]);
  async function run(action: () => Promise<void> | void, choiceId?: string) {
    if (lock.current || disabled) return;
    lock.current = true; setPending(true); setError(false); setSelected(choiceId);
    try { await action(); } catch { setError(true); }
    finally { lock.current = false; setPending(false); }
  }
  function tap() {
    if (lock.current || disabled) return;
    if (playback.tap() && choices.length === 0) {
      if (scene.kind === 'terminal') setOffer(true);
      else void run(onAdvance);
    }
  }
  const entitlement = season1Owned || purchased;
  const episodeNumber = getEpisodeNumber(episode.id);
  const seasonComplete = !nextEpisode && episodeNumber >= getStoryCatalogEntry(storyId).episodes.length;
  if (offer && nextEpisode && onNextEpisode && !entitlement) {
    return <PrototypePaywall
      storyId={storyId}
      seasonId={seasonId}
      episodeId={episode.id}
      sceneId={scene.id}
      episodeNumber={episodeNumber}
      nextEpisodeTitle={nextEpisode.title}
      imageSrc={art}
      priceStars={season1PriceStars}
      onPurchased={async () => {
        const confirmed = onRefreshOwnership ? await onRefreshOwnership() : true;
        if (confirmed) setPurchased(true);
      }}
      onMenu={onMenu}
    />;
  }
  if (offer) return <section className="lumi-paywall" data-story-id={storyId} aria-label="Продолжение сезона">
    {art ? <img src={art} alt="Финал эпизода" /> : null}
    <div className="lumi-paywall__body">
      <p className="lumi-eyebrow">Эпизод {episodeNumber} завершён</p>
      <h2>{nextEpisode ? 'История только начинается' : seasonComplete ? 'Сезон 1 завершён' : `Эпизод ${episodeNumber + 1} в разработке`}</h2>
      {nextEpisode && onNextEpisode ? <>
        <p>{nextEpisode.title}</p>
        <button className="lumi-primary" type="button" disabled={pending || disabled} onClick={() => void run(onNextEpisode)}>Продолжить — Эпизод {episodeNumber + 1}</button>
      </> : <p>Продолжение истории появится позже.</p>}
      {onMenu ? <button className="lumi-primary" type="button" onClick={onMenu}>К сезону</button> : null}
      {error && !disabled ? <p role="alert">Не удалось продолжить. Попробуйте ещё раз.</p> : null}
    </div>
  </section>;
  if (scene.kind === 'message') return <main className="lumi-chat-stage" data-scene-id={scene.id} data-motion="phone">
    <div className="lumi-chat-stage__wallpaper" aria-hidden="true" />
    <SoaChatScreen scene={scene} availableChoices={choices} onChoose={id => run(() => onChoose(id), id)} onAdvance={() => run(onAdvance)} disabled={pending || disabled} onMenu={onMenu} history={chatHistory} onHistory={onHistory} dateLabel={episodeNumber > 1 ? 'Сегодня' : undefined} />
    {error && !disabled ? <p role="alert">Не удалось продолжить. Попробуйте ещё раз.</p> : null}
  </main>;
  const readyChoices = playback.final && playback.complete ? choices : [];
  return <main className={`lumi-story lumi-story--${p.mode}`} data-testid="story-stage" data-story-id={storyId} data-scene-id={scene.id} data-beat-index={playback.index} data-beat-count={getSceneBeats(scene).length}
    data-presentation={p.mode} data-motion={p.motion} data-camera={p.camera} data-transition={p.transition}>
    <CinematicStage scene={scene} beat={playback.beat} presentation={p} previous={previous} />
    <header className="lumi-story__topbar"><div><small>LUMI · {p.location ?? 'История'}</small><strong>{episode.title}</strong></div><button className="lumi-icon-button" type="button" onClick={onMenu} aria-label="Меню">⋯</button></header>
    <button className="lumi-stage-tap" type="button" aria-label="Продолжить сцену" disabled={pending || disabled || readyChoices.length > 0} onClick={event => { if (event.detail < 2) tap(); }} tabIndex={-1} />
    <div className="lumi-story__content">
      <DialogueBox beat={playback.beat} visibleText={playback.visibleText} complete={playback.complete} index={playback.index} total={getSceneBeats(scene).length}
        canTap={readyChoices.length === 0} disabled={pending || disabled} onTap={tap} />
      <ChoiceList choices={readyChoices} disabled={pending || disabled} selected={selected} onChoose={id => run(() => onChoose(id), id)} />
      {error && !disabled ? <p role="alert">Не удалось продолжить. Попробуйте ещё раз.</p> : null}
    </div>
  </main>;
}
