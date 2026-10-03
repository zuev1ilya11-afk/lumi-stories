import { publicAsset } from '../../publicAsset';
import type { Beat, Episode, Scene, ScenePresentation } from '../../story/schema';
export function getSceneBeats(scene: Scene): Beat[] {
  return scene.beats ?? [{ text: scene.text, ...(scene.kind === 'dialogue' && scene.speaker ? { speaker: scene.speaker } : {}) }];
}
export function getScenePresentation(scene: Scene, beat?: Beat): ScenePresentation {
  const defined = (p?: ScenePresentation) => Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== undefined));
  const result: ScenePresentation = { mode: 'standard', camera: 'wide', motion: 'none', transition: 'fade', ...defined(scene.presentation), ...defined(beat?.presentation) };
  if (result.cg === 'none') result.cg = undefined;
  return result;
}
export function sceneAsset(id?: string, kind: 'backgrounds' | 'characters' | 'cg' = 'backgrounds'): string | undefined {
  if (!id) return undefined;
  if (id.includes('/') || /\.(webp|png|jpg)$/i.test(id)) return publicAsset(id);
  if (kind === 'characters') {
    const [character, ...emotion] = id.split('-');
    return publicAsset(`assets/last-online/characters/${character}/${emotion.join('-') || 'neutral'}.webp`);
  }
  if (id === 'soa-junho-old-photo') kind = 'cg';
  return publicAsset(`assets/last-online/${kind}/${id}.webp`);
}
export function presentationAssets(scene: Scene, beat?: Beat): string[] {
  const p = getScenePresentation(scene, beat);
  return [sceneAsset(p.cg ?? beat?.background ?? scene.background),
    ...(p.cg ? [] : (p.characters?.map(c => sceneAsset(c.src)) ?? [sceneAsset(scene.character, 'characters')])),
    scene.attachment ? sceneAsset(scene.attachment, 'cg') : undefined].filter((p): p is string => !!p);
}
// Current shot, next beat and first shots of immediately reachable scenes only.
export function nearbyAssets(episode: Episode, scene: Scene, index: number): string[] {
  const beats = getSceneBeats(scene);
  const nextIds = new Set([scene.nextSceneId, ...(scene.choices ?? []).map(c => c.nextSceneId), ...(scene.transitions ?? []).map(t => t.nextSceneId)]);
  return [...new Set([...presentationAssets(scene, beats[index]),
    ...(beats[index + 1] ? presentationAssets(scene, beats[index + 1]) : []),
    ...episode.scenes.filter(s => nextIds.has(s.id)).flatMap(s => presentationAssets(s, getSceneBeats(s)[0])),
  ])];
}
