// Compatibility entry point for the initially published Episode 2 registry.
import { episodes, getEpisode } from '../../../story/episodes';
export { episodes, firstEpisode, getNextEpisode } from '../../../story/episodes';
export const getEpisodeById = getEpisode;
export function getEpisodeNumber(id: string): number {
  return episodes.indexOf(getEpisode(id)) + 1;
}
