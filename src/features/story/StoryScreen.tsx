import { useState } from 'react';
import { getAvailableChoices, getScene } from '../../story/engine';
import { publicAsset } from '../../publicAsset';
import type { Episode, StoryState } from '../../story/schema';
import { SoaChatScreen } from '../messages/SoaChatScreen';
import { PrototypePaywall } from '../paywall/PrototypePaywall';
import { ChoiceList } from './ChoiceList';
import { DialogueBox } from './DialogueBox';

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
  const background = assetPath('backgrounds', scene.background);
  const character = assetPath('characters', scene.character);

  async function handleChoose(choiceId: string) {
    if (choicePending) return;
    setChoicePending(true);
    try {
      await onChoose(choiceId);
    } finally {
      setChoicePending(false);
    }
  }

  return (
    <main
      className="lumi-story"
      data-testid="story-stage"
      style={background ? { backgroundImage: `url(${background})` } : undefined}
    >
      <div className="lumi-story__shade" aria-hidden="true" />
      <header className="lumi-story__topbar">
        <div><small>Эпизод 1</small><strong>{episode.title}</strong></div>
        <button className="lumi-icon-button" type="button" onClick={onMenu} aria-label="Меню">⋯</button>
      </header>

      {character ? <img className="lumi-story__character" src={character} alt="" aria-hidden="true" /> : null}

      <div className="lumi-story__content">
        {scene.kind === 'message' ? (
          <SoaChatScreen scene={scene} availableChoices={choices} onChoose={handleChoose} onAdvance={onAdvance} disabled={choicePending} />
        ) : (
          <div className="lumi-story__standard">
            <DialogueBox scene={scene} canAdvance={choices.length === 0 && scene.kind !== 'terminal'} onAdvance={onAdvance} />
            <ChoiceList choices={choices} disabled={choicePending} onChoose={handleChoose} />
          </div>
        )}
      </div>
    </main>
  );
}
