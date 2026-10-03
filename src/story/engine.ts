import type { Choice, Condition, Episode, Scene, StoryState } from './schema.ts';

function conditionMatches(condition: Condition, state: StoryState): boolean {
  if (condition.kind === 'scoreAtLeast') return state[condition.score] >= condition.value;
  return state.flags[condition.flag] === condition.value;
}

function conditionsMatch(conditions: Condition[] | undefined, state: StoryState): boolean {
  return !conditions || conditions.every((condition) => conditionMatches(condition, state));
}

export function getScene(episode: Episode, sceneId: string): Scene {
  const scene = episode.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new Error(`Scene not found: ${sceneId}`);
  return scene;
}

export function getAvailableChoices(scene: Scene, state: StoryState): Choice[] {
  return (scene.choices ?? []).filter((choice) => conditionsMatch(choice.conditions, state));
}

export function applyChoice(state: StoryState, choice: Choice): StoryState {
  const next: StoryState = {
    ...state,
    flags: { ...state.flags },
  };
  for (const effect of choice.effects ?? []) {
    if (effect.kind === 'inc') next[effect.score] += effect.by;
    else next.flags[effect.flag] = effect.value;
  }
  return next;
}

export function resolveNextScene(scene: Scene, state: StoryState): string | null {
  if (scene.kind === 'terminal') return null;
  for (const transition of scene.transitions ?? []) {
    if (conditionsMatch(transition.conditions, state)) return transition.nextSceneId;
  }
  return scene.nextSceneId ?? null;
}
