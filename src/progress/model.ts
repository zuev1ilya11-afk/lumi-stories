import type { ProgressDto } from '../api/types.ts';
import { applyChoice, getAvailableChoices, getScene, resolveNextScene } from '../story/engine.ts';
import type { Episode, FlagValue, StoryState } from '../story/schema.ts';

export type ProgressState = {
  episodeId?: string;
  sceneId: string;
  storyState: StoryState;
};

type SaveProgressFn = (progress: ProgressDto) => Promise<ProgressDto>;
type ProgressIdentity = { storyId: string; seasonId: string };

type ProgressMachine = {
  current(): ProgressState;
  pending(): ProgressState | null;
  choose(choiceId: string): Promise<ProgressState>;
  advance(): Promise<ProgressState>;
  nextEpisode(): Promise<ProgressState>;
  retry(): Promise<ProgressState>;
};

const DEFAULT_IDENTITY: ProgressIdentity = { storyId: 'last-online', seasonId: 'season-1' };

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
      episodeId: episode.id,
      sceneId: episode.startSceneId,
      storyState: { junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {} },
    };
  }
  if (progress.episodeId !== episode.id) throw new Error(`Progress episode mismatch: ${progress.episodeId}`);
  getScene(episode, progress.sceneId);
  return {
    episodeId: episode.id,
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

export function progressToDto(progress: ProgressState, episode: Episode, identity: ProgressIdentity = DEFAULT_IDENTITY): ProgressDto {
  return {
    storyId: identity.storyId,
    seasonId: identity.seasonId,
    episodeId: progress.episodeId ?? episode.id,
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
    ...current,
    sceneId: choice.nextSceneId,
    storyState: applyChoice(current.storyState, choice),
  };
}

export function advanceTransition(episode: Episode, current: ProgressState): ProgressState {
  const scene = getScene(episode, current.sceneId);
  const nextSceneId = resolveNextScene(scene, current.storyState);
  if (!nextSceneId) return current;
  return { ...current, sceneId: nextSceneId };
}

export function createProgressMachine(options: {
  episode: Episode;
  episodes?: readonly Episode[];
  initial: ProgressState;
  save: SaveProgressFn;
  storyId?: string;
  seasonId?: string;
}): ProgressMachine {
  let committed = options.initial;
  let pendingState: ProgressState | null = null;
  let inFlight: Promise<ProgressState> | null = null;
  const episodes = options.episodes ?? [options.episode];
  const identity = {
    storyId: options.storyId ?? DEFAULT_IDENTITY.storyId,
    seasonId: options.seasonId ?? DEFAULT_IDENTITY.seasonId,
  };

  function episodeFor(state: ProgressState): Episode {
    const id = state.episodeId ?? options.episode.id;
    const episode = episodes.find(candidate => candidate.id === id);
    if (!episode) throw new Error(`Episode not available: ${id}`);
    return episode;
  }

  async function saveCandidate(candidate: ProgressState): Promise<ProgressState> {
    pendingState = candidate;
    const episode = episodeFor(candidate);
    const saved = await options.save(progressToDto(candidate, episode, identity));
    if (saved.storyId !== identity.storyId || saved.seasonId !== identity.seasonId) {
      throw new Error('Progress identity mismatch');
    }
    committed = progressFromDto(saved, episode);
    pendingState = null;
    return committed;
  }

  function run(transition: () => ProgressState, retry = false): Promise<ProgressState> {
    if (inFlight) return inFlight;
    if (pendingState && !retry) return Promise.reject(new Error('Retry the pending save before continuing'));
    let candidate: ProgressState;
    try { candidate = transition(); } catch (error) { return Promise.reject(error); }
    if (candidate === committed) return Promise.resolve(committed);
    inFlight = saveCandidate(candidate).finally(() => { inFlight = null; });
    return inFlight;
  }

  return {
    current: () => committed,
    pending: () => pendingState,
    choose(choiceId) {
      return run(() => choiceTransition(episodeFor(committed), committed, choiceId));
    },
    advance() {
      return run(() => advanceTransition(episodeFor(committed), committed));
    },
    nextEpisode() {
      return run(() => {
        const episode = episodeFor(committed);
        if (getScene(episode, committed.sceneId).kind !== 'terminal') throw new Error('Finish the current episode before continuing');
        const next = episodes[episodes.indexOf(episode) + 1];
        return next ? { ...committed, episodeId: next.id, sceneId: next.startSceneId } : committed;
      });
    },
    retry() {
      return run(() => pendingState ?? committed, true);
    },
  };
}
