import episodeOneRaw from '../content/last-online/season-1/episode-1.json';
import episodeTwoRaw from '../content/last-online/season-1/episode-2.json';
import { parseEpisode, type Episode } from './schema';

export const episodes: readonly Episode[] = [parseEpisode(episodeOneRaw), parseEpisode(episodeTwoRaw)];
export const firstEpisode = episodes[0];

export function getEpisode(episodeId = firstEpisode.id): Episode {
  const canonicalId = episodeId === 'episode-2' ? 'last-online-s1-e2' : episodeId;
  const episode = episodes.find(candidate => candidate.id === canonicalId);
  if (!episode) throw new Error(`Episode not available: ${episodeId}`);
  return episode;
}

export function getNextEpisode(episodeId: string): Episode | undefined {
  const index = episodes.findIndex(candidate => candidate.id === episodeId);
  return index < 0 ? undefined : episodes[index + 1];
}
