import { useEffect, useRef, useState } from 'react';
import { getAvailableChoices, getScene } from '../../story/engine';
import type { Episode, Scene, StoryState } from '../../story/schema';
import { SoaChatScreen, type ChatTimelineEvent } from '../messages/SoaChatScreen';
import { PrototypePaywall } from '../paywall/PrototypePaywall';
import { ChoiceList } from './ChoiceList';
import { CinematicStage } from './CinematicStage';
import { DialogueBox } from './DialogueBox';
import { getSceneBeats, getScenePresentation, nearbyAssets, sceneAsset } from './presentation';
import { useBeatPlayback } from './useBeatPlayback';
import { useReducedMotion } from './useReducedMotion';

type Props = { episode: Episode; sceneId: string; state: StoryState; onChoose(choiceId: string): Promise<void> | void; onAdvance(): Promise<void> | void; onMenu?(): void };

export function StoryScreen(props: Props) {
  const scene = getScene(props.episode, props.sceneId);
  const chatHistory = useRef<ChatTimelineEvent[]>([]);
  const previous = useRef<string | undefined>(undefined);
  const previousArt = previous.current;

  return <ScenePlayer key={scene.id} {...props} scene={scene} previous={previousArt} onArt={src => { previous.current = src; }} chatHistory={chatHistory.current} onHistory={messages => { chatHistory.current = messages; }} />;
}

function ScenePlayer({ episode, scene, state, onChoose, onAdvance, onMenu, previous, onArt, chatHistory, onHistory }: Props & { scene: Scene; previous?: string; onArt(src?: string): void; chatHistory: ChatTimelineEvent[]; onHistory(messages: ChatTimelineEvent[]): void }) {
  const reduced = useReducedMotion();
  const playback = useBeatPlayback(getSceneBeats(scene), reduced);
  const p = getScenePresentation(scene, playback.beat);
  const choices = getAvailableChoices(scene, state);
  const [offer, setOffer] = useState(false);
  const art = sceneAsset(p.cg ?? playback.beat.background ?? scene.background);
  useEffect(() => { onArt(art); }, [art, onArt]);
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string>();
  const assets = nearbyAssets(episode, scene, playback.index).join('\n');
  useEffect(() => { assets.split('\n').filter(Boolean).forEach(src => { const image = new Image(); image.src = src; }); }, [assets]);
  useEffect(() => {
    if (!p.haptic || reduced) return;
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(p.haptic); } catch { /* Unsupported Telegram client. */ }
  }, [p.haptic, reduced]);
  async function run(action: () => Promise<void> | void, choiceId?: string) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError(false); setSelected(choiceId);
    try { await action(); } catch { setError(true); }
    finally { lock.current = false; setPending(false); }
  }
  function tap() {
    if (lock.current) return;
    if (playback.tap() && choices.length === 0) {
      if (scene.kind === 'terminal') setOffer(true);
      else void run(onAdvance);
    }
  }
  if (offer) return <PrototypePaywall />;
  if (scene.kind === 'message') return <main className="lumi-chat-stage" data-scene-id={scene.id} data-motion="phone">
    <div className="lumi-chat-stage__wallpaper" aria-hidden="true" />
    <SoaChatScreen scene={scene} availableChoices={choices} onChoose={id => run(() => onChoose(id), id)} onAdvance={() => run(onAdvance)} disabled={pending} onMenu={onMenu} history={chatHistory} onHistory={onHistory} />
    {error ? <p role="alert">Не удалось продолжить. Попробуйте ещё раз.</p> : null}
  </main>;
  const readyChoices = playback.final && playback.complete ? choices : [];
  return <main className={`lumi-story lumi-story--${p.mode}`} data-testid="story-stage" data-scene-id={scene.id} data-beat-index={playback.index} data-beat-count={getSceneBeats(scene).length}
    data-presentation={p.mode} data-motion={p.motion} data-camera={p.camera} data-transition={p.transition}>
    <CinematicStage scene={scene} beat={playback.beat} presentation={p} previous={previous} />
    <header className="lumi-story__topbar"><div><small>LUMI · {p.location ?? 'История'}</small><strong>{episode.title}</strong></div><button className="lumi-icon-button" type="button" onClick={onMenu} aria-label="Меню">⋯</button></header>
    <button className="lumi-stage-tap" type="button" aria-label="Продолжить сцену" disabled={pending || readyChoices.length > 0} onClick={event => { if (event.detail < 2) tap(); }} tabIndex={-1} />
    <div className="lumi-story__content">
      <DialogueBox beat={playback.beat} visibleText={playback.visibleText} complete={playback.complete} index={playback.index} total={getSceneBeats(scene).length}
        canTap={readyChoices.length === 0} disabled={pending} onTap={tap} />
      <ChoiceList choices={readyChoices} disabled={pending} selected={selected} onChoose={id => run(() => onChoose(id), id)} />
      {error ? <p role="alert">Не удалось продолжить. Попробуйте ещё раз.</p> : null}
    </div>
  </main>;
}
