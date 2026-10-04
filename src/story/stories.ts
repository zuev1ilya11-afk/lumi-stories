import episodeOneRaw from '../content/house-of-black-roses/season-1/episode-1.json';
import episodeTwoBlackRosesRaw from '../content/house-of-black-roses/season-1/episode-2.json';
import { STORY_CATALOG, getStoryCatalogEntry } from './catalog';
import { episodes as lastOnlineEpisodes } from './episodes';
import { parseEpisode, type Episode } from './schema';

export type StoryRuntime = {
  id: string;
  seasonId: string;
  episodes: readonly Episode[];
  firstEpisode: Episode;
  free: boolean;
};

const blackRosesEpisodes: readonly Episode[] = [parseEpisode(episodeOneRaw), parseEpisode(episodeTwoBlackRosesRaw)];

const RUNTIMES: Record<string, StoryRuntime> = {
  'last-online': {
    id: 'last-online',
    seasonId: 'season-1',
    episodes: lastOnlineEpisodes,
    firstEpisode: lastOnlineEpisodes[0],
    free: false,
  },
  'house-of-black-roses': {
    id: 'house-of-black-roses',
    seasonId: 'season-1',
    episodes: blackRosesEpisodes,
    firstEpisode: blackRosesEpisodes[0],
    free: false,
  },
};

export function getStoryRuntime(storyId = 'last-online'): StoryRuntime {
  const runtime = RUNTIMES[storyId];
  if (!runtime) throw new Error(`Story not available: ${storyId}`);
  return runtime;
}

export function getStoryEpisode(storyId: string, episodeId?: string): Episode {
  const story = getStoryRuntime(storyId);
  if (!episodeId) return story.firstEpisode;
  const canonicalEpisodeId = storyId === 'last-online' && episodeId === 'episode-2'
    ? 'last-online-s1-e2'
    : episodeId;
  const episode = story.episodes.find(candidate => candidate.id === canonicalEpisodeId);
  if (!episode) throw new Error(`Episode not available for ${storyId}: ${episodeId}`);
  return episode;
}

export function getNextStoryEpisode(storyId: string, episodeId: string): Episode | undefined {
  const story = getStoryRuntime(storyId);
  const index = story.episodes.findIndex(candidate => candidate.id === episodeId);
  return index < 0 ? undefined : story.episodes[index + 1];
}

export function storyIdForEpisode(episodeId: string): string {
  for (const story of STORY_CATALOG) {
    if (getStoryRuntime(story.id).episodes.some(episode => episode.id === episodeId)) return story.id;
  }
  throw new Error(`Story not available for episode: ${episodeId}`);
}

export function storyCatalog(storyId: string) {
  return getStoryCatalogEntry(storyId);
}
