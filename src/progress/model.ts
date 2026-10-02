import type { ProgressDto } from '../api/types.ts';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from '../story/engine.ts';
import type { Episode, FlagValue, StoryState } from '../story/schema.ts';

export type ProgressState = {
  sceneId: string;
  storyState: StoryState;
};

type SaveProgressFn = (progress: ProgressDto) => Promise<ProgressDto>;

type ProgressMachine = {
  current(): ProgressState;
  pending(): ProgressState | null;
  choose(choiceId: string): Promise<ProgressState>;
  advance(): Promise<ProgressState>;
  retry(): Promise<ProgressState>;
};

function cleanFlags(flags: Record<string, unknown>): Record<string, FlagValue> {
  const cleaned: Record<string, FlagValue> = {};
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value === 'boolean' || typeof value === 'string') cleaned[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) cleaned[key] = value;
  }
  return cleaned;
}

export function progressFromDto(progress: ProgressDto | null, episode: Episode): ProgressState {
  if (!progress) {
    return {
      sceneId: episode.startSceneId,
      storyState: { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} },
    };
  }
  getScene(episode, progress.sceneId);
  return {
    sceneId: progress.sceneId,
    storyState: {
      junhoScore: progress.junhoScore,
      taeyunScore: progress.taeyunScore,
      truthScore: progress.truthScore,
      riskScore: progress.riskScore,
      flags: cleanFlags(progress.flags),
    },
  };
}

export function progressToDto(progress: ProgressState, episode: Episode): ProgressDto {
  return {
    storyId: 'last-online',
    seasonId: 'season-1',
    episodeId: episode.id,
    sceneId: progress.sceneId,
    junhoScore: progress.storyState.junhoScore,
    taeyunScore: progress.storyState.taeyunScore,
    truthScore: progress.storyState.truthScore,
    riskScore: progress.storyState.riskScore,
    flags: progress.storyState.flags,
  };
}

export function choiceTransition(episode: Episode, current: ProgressState, choiceId: string): ProgressState {
  const scene = getScene(episode, current.sceneId);
  const choice = getAvailableChoices(scene, current.storyState).find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error(`Choice not available: ${choiceId}`);
  return {
    sceneId: choice.nextSceneId,
    storyState: applyChoice(current.storyState, choice),
  };
}

export function advanceTransition(episode: Episode, current: ProgressState): ProgressState {
  const scene = getScene(episode, current.sceneId);
  const nextSceneId = resolveNextScene(scene, current.storyState);
  if (!nextSceneId) return current;
  return { sceneId: nextSceneId, storyState: current.storyState };
}

export function createProgressMachine(options: {
  episode: Episode;
  initial: ProgressState;
  save: SaveProgressFn;
}): ProgressMachine {
  let committed = options.initial;
  let pendingState: ProgressState | null = null;

  async function saveCandidate(candidate: ProgressState): Promise<ProgressState> {
    pendingState = candidate;
    const saved = await options.save(progressToDto(candidate, options.episode));
    committed = progressFromDto(saved, options.episode);
    pendingState = null;
    return committed;
  }

  return {
    current: () => committed,
    pending: () => pendingState,
    choose(choiceId) {
      return saveCandidate(choiceTransition(options.episode, committed, choiceId));
    },
    advance() {
      return saveCandidate(advanceTransition(options.episode, committed));
    },
    async retry() {
      if (!pendingState) return committed;
      return saveCandidate(pendingState);
    },
  };
}
