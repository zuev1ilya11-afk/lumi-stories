import type { Scene } from '../../story/schema';

export type ScenePresentation = {
  mode: 'standard' | 'cinematic';
  motion: 'calm' | 'reveal' | 'tension';
  hideCharacter?: boolean;
};

const PRESENTATION_BY_SCENE: Record<string, ScenePresentation> = {
  ep1_first_meet: { mode: 'cinematic', motion: 'reveal' },
  ep1_reveal_junho: { mode: 'cinematic', motion: 'reveal' },
  ep1_noise_hall: { mode: 'cinematic', motion: 'tension' },
  ep1_junho_warning: { mode: 'cinematic', motion: 'tension' },
  ep1_old_photo: { mode: 'cinematic', motion: 'reveal', hideCharacter: true },
};

export function getScenePresentation(scene: Scene): ScenePresentation {
  return PRESENTATION_BY_SCENE[scene.id] ?? {
    mode: 'standard',
    motion: scene.kind === 'narrative' ? 'calm' : 'reveal',
  };
}
