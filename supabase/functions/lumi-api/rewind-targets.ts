export type RewindTarget = {
  storyId: string;
  seasonId: string;
  index: number;
  startSceneId: string;
  terminalSceneIds: readonly string[];
};

export const EPISODE_REWIND_TARGETS = {
  'last-online-s1-e1': {
    storyId: 'last-online',
    seasonId: 'season-1',
    index: 0,
    startSceneId: 'ep1_arrival',
    terminalSceneIds: ['ep1_end_paywall'],
  },
  'last-online-s1-e2': {
    storyId: 'last-online',
    seasonId: 'season-1',
    index: 1,
    startSceneId: 'ep2_morning',
    terminalSceneIds: ['ep2_end'],
  },
  'last-online-s1-e3': {
    storyId: 'last-online',
    seasonId: 'season-1',
    index: 2,
    startSceneId: 'ep3_elevator',
    terminalSceneIds: ['ep3_end'],
  },
  'last-online-s1-e4': {
    storyId: 'last-online',
    seasonId: 'season-1',
    index: 3,
    startSceneId: 'ep4_morning',
    terminalSceneIds: ['ep4_end'],
  },
  'last-online-s1-e5': {
    storyId: 'last-online',
    seasonId: 'season-1',
    index: 4,
    startSceneId: 'ep5_morning',
    terminalSceneIds: ['ep5_end_junho', 'ep5_end_taeyun', 'ep5_end_self'],
  },
  'house-of-black-roses-s1-e1': {
    storyId: 'house-of-black-roses',
    seasonId: 'season-1',
    index: 0,
    startSceneId: 'gothic_ep1_arrival',
    terminalSceneIds: ['gothic_ep1_end'],
  },
  'house-of-black-roses-s1-e2': {
    storyId: 'house-of-black-roses',
    seasonId: 'season-1',
    index: 1,
    startSceneId: 'gothic_ep2_after_portrait',
    terminalSceneIds: ['gothic_ep2_end'],
  },
} as const satisfies Record<string, RewindTarget>;

export type RewindEpisodeId = keyof typeof EPISODE_REWIND_TARGETS;

export function isRewindEpisodeId(value: unknown): value is RewindEpisodeId {
  return typeof value === 'string' && value in EPISODE_REWIND_TARGETS;
}
