import { applyChoice, getAvailableChoices, resolveNextScene } from './engine.ts';
import type { Episode, Scene, StoryState } from './schema.ts';

export type ValidationIssueCode =
  | 'MISSING_START_SCENE'
  | 'MISSING_SCENE_REFERENCE'
  | 'UNREACHABLE_REQUIRED_SCENE'
  | 'NON_TERMINATING_PATH';

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
  sceneId?: string;
};

export type PathResult = {
  sceneIds: string[];
  terminal: boolean;
  state: StoryState;
  reason?: 'missing_scene' | 'dead_end' | 'cycle' | 'path_limit';
};

const ZERO_STATE: StoryState = {
  junhoScore: 0,
  taeyunScore: 0,
  truthScore: 0,
  riskScore: 0,
  flags: {},
};

function references(scene: Scene): string[] {
  return [
    ...(scene.nextSceneId ? [scene.nextSceneId] : []),
    ...(scene.choices ?? []).map((choice) => choice.nextSceneId),
    ...(scene.transitions ?? []).map((transition) => transition.nextSceneId),
  ];
}

function reachableSceneIds(episode: Episode): Set<string> {
  const byId = new Map(episode.scenes.map((scene) => [scene.id, scene]));
  const visited = new Set<string>();
  const queue = [episode.startSceneId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const scene = byId.get(id);
    if (!scene) continue;
    visited.add(id);
    for (const next of references(scene)) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

export function enumeratePaths(
  episode: Episode,
  initialState: StoryState,
): PathResult[] {
  const byId = new Map(episode.scenes.map((scene) => [scene.id, scene]));
  const results: PathResult[] = [];
  const maxDepth = Math.max(episode.scenes.length * 3, 12);
  const maxPaths = 10_000;

  function visit(sceneId: string, state: StoryState, path: string[]): void {
    if (results.length >= maxPaths) return;
    if (path.length >= maxDepth) {
      results.push({ sceneIds: path, terminal: false, state, reason: 'path_limit' });
      return;
    }
    if (path.includes(sceneId)) {
      results.push({ sceneIds: [...path, sceneId], terminal: false, state, reason: 'cycle' });
      return;
    }

    const scene = byId.get(sceneId);
    if (!scene) {
      results.push({ sceneIds: [...path, sceneId], terminal: false, state, reason: 'missing_scene' });
      return;
    }
    const nextPath = [...path, scene.id];
    if (scene.kind === 'terminal') {
      results.push({ sceneIds: nextPath, terminal: true, state });
      return;
    }

    const choices = getAvailableChoices(scene, state);
    if ((scene.choices?.length ?? 0) > 0 && choices.length > 0) {
      for (const choice of choices) visit(choice.nextSceneId, applyChoice(state, choice), nextPath);
      return;
    }

    const nextSceneId = resolveNextScene(scene, state);
    if (!nextSceneId) {
      results.push({ sceneIds: nextPath, terminal: false, state, reason: 'dead_end' });
      return;
    }
    visit(nextSceneId, state, nextPath);
  }

  visit(episode.startSceneId, {
    ...initialState,
    flags: { ...initialState.flags },
  }, []);
  return results;
}

export function validateEpisode(episode: Episode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(episode.scenes.map((scene) => [scene.id, scene]));
  if (!byId.has(episode.startSceneId)) {
    issues.push({
      code: 'MISSING_START_SCENE',
      message: `Start scene does not exist: ${episode.startSceneId}`,
      sceneId: episode.startSceneId,
    });
  }

  for (const scene of episode.scenes) {
    for (const target of references(scene)) {
      if (!byId.has(target)) {
        issues.push({
          code: 'MISSING_SCENE_REFERENCE',
          message: `${scene.id} points to missing scene ${target}`,
          sceneId: scene.id,
        });
      }
    }
  }

  const reachable = reachableSceneIds(episode);
  for (const requiredSceneId of episode.requiredSceneIds ?? []) {
    if (!reachable.has(requiredSceneId)) {
      issues.push({
        code: 'UNREACHABLE_REQUIRED_SCENE',
        message: `Required scene is unreachable: ${requiredSceneId}`,
        sceneId: requiredSceneId,
      });
    }
  }

  if (byId.has(episode.startSceneId)) {
    const paths = enumeratePaths(episode, ZERO_STATE);
    const failed = paths.find((path) => !path.terminal);
    if (failed) {
      issues.push({
        code: 'NON_TERMINATING_PATH',
        message: `Path does not reach a terminal scene (${failed.reason ?? 'unknown'}): ${failed.sceneIds.join(' -> ')}`,
        sceneId: failed.sceneIds.at(-1),
      });
    }
  }

  return issues;
}
