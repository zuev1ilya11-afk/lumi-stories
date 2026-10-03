import { useState } from 'react';
import { getAvailableChoices, getScene } from '../../story/engine';
import { publicAsset } from '../../publicAsset';
import type { Episode, StoryState } from '../../story/schema';
import { SoaChatScreen } from '../messages/SoaChatScreen';
import { PrototypePaywall } from '../paywall/PrototypePaywall';
import { ChoiceList } from './ChoiceList';
import { DialogueBox } from './DialogueBox';
import { getScenePresentation } from './presentation';

type StoryScreenProps = {
  episode: Episode;
  sceneId: string;
  state: StoryState;
  onChoose(choiceId: string): Promise<void> | void;
  onAdvance(): Promise<void> | void;
  onMenu?(): void;
};

function assetPath(kind: 'backgrounds' | 'characters', id?: string): string | null {
  if (!id) return null;
  if (kind === 'characters') {
    const [character, emotion = 'neutral'] = id.split('-');
    return publicAsset(`assets/last-online/characters/${character}/${emotion}.webp`);
  }
  if (id === 'soa-junho-old-photo') return publicAsset('assets/last-online/cg/soa-junho-old-photo.webp');
  return publicAsset(`assets/last-online/backgrounds/${id}.webp`);
}

export function StoryScreen({ episode, sceneId, state, onChoose, onAdvance, onMenu }: StoryScreenProps) {
  const scene = getScene(episode, sceneId);
  if (scene.id === 'ep1_end_paywall') return <PrototypePaywall />;

  const choices = getAvailableChoices(scene, state);
  const [choicePending, setChoicePending] = useState(false);

  async function handleChoose(choiceId: string) {
    if (choicePending) return;
    setChoicePending(true);
    try {
      await onChoose(choiceId);
    } finally {
      setChoicePending(false);
    }
  }

  if (scene.kind === 'message') {
    return (
      <main className="lumi-chat-stage" key={scene.id} data-motion="phone">
        <div className="lumi-chat-stage__wallpaper" aria-hidden="true" />
        <SoaChatScreen
          scene={scene}
          availableChoices={choices}
          onChoose={handleChoose}
          onAdvance={onAdvance}
          disabled={choicePending}
        />
      </main>
    );
  }

  const presentation = getScenePresentation(scene);
  const background = assetPath('backgrounds', scene.background);
  const character = assetPath('characters', scene.character);
  const characterName = scene.character?.split('-')[0] ?? 'none';

  return (
    <main
      className={`lumi-story lumi-story--${presentation.mode}`}
      data-testid="story-stage"
      data-presentation={presentation.mode}
      data-motion={presentation.motion}
      key={scene.id}
      style={background ? { backgroundImage: `url(${background})` } : undefined}
    >
      {background ? (
        <div
          className="lumi-story__backdrop"
          style={{ backgroundImage: `url(${background})` }}
          aria-hidden="true"
        />
      ) : null}
      <div className="lumi-story__shade" aria-hidden="true" />
      <div className="lumi-story__motion-flash" aria-hidden="true" />

      <header className="lumi-story__topbar">
        <div><small>Эпизод 1</small><strong>{episode.title}</strong></div>
        <button className="lumi-icon-button" type="button" onClick={onMenu} aria-label="Меню">⋯</button>
      </header>

      {character && !presentation.hideCharacter ? (
        <img
          className={`lumi-story__character lumi-story__character--${characterName}`}
          src={character}
          alt=""
          aria-hidden="true"
        />
      ) : null}

      <div className="lumi-story__content">
        <div className="lumi-story__standard">
          <DialogueBox
            scene={scene}
            canAdvance={choices.length === 0 && scene.kind !== 'terminal'}
            onAdvance={onAdvance}
          />
          <ChoiceList choices={choices} disabled={choicePending} onChoose={handleChoose} />
        </div>
      </div>
    </main>
  );
}
