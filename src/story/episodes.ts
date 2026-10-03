import episodeOneRaw from '../content/last-online/season-1/episode-1.json';
import episodeTwoRaw from '../content/last-online/season-1/episode-2.json';
import episodeThreeRaw from '../content/last-online/season-1/episode-3.json';
import episodeFourRaw from '../content/last-online/season-1/episode-4.json';
import { parseEpisode, type Episode } from './schema';

export const episodes: readonly Episode[] = [parseEpisode(episodeOneRaw), parseEpisode(episodeTwoRaw), parseEpisode(episodeThreeRaw), parseEpisode(episodeFourRaw)];
export const firstEpisode = episodes[0];

export function getEpisodeNumber(episodeId = firstEpisode.id): number {
  if (episodeId === 'episode-2') return 2;
  const canonicalMatch = episodeId.match(/-s\d+-e(\d+)$/);
  if (canonicalMatch) return Math.max(1, Number(canonicalMatch[1]));
  return Math.max(1, episodes.findIndex(episode => episode.id === episodeId) + 1);
}

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
