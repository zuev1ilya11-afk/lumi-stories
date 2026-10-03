import episode1Raw from './episode-1.json';
import episode2Raw from './episode-2.json';
import { parseEpisode, type Episode } from '../../../story/schema';

export const episodes: Episode[] = [parseEpisode(episode1Raw), parseEpisode(episode2Raw)];
export const firstEpisode = episodes[0];

export function getEpisodeById(id?: string): Episode {
  return episodes.find((episode) => episode.id === id) ?? firstEpisode;
}
export function getEpisodeNumber(id: string): number {
  const index = episodes.findIndex((episode) => episode.id === id);
  return index >= 0 ? index + 1 : 1;
}
export function getNextEpisode(id: string): Episode | undefined {
  const index = episodes.findIndex((episode) => episode.id === id);
  return index >= 0 ? episodes[index + 1] : undefined;
}
