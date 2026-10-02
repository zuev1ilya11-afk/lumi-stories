export type ProgressDto = {
  storyId: string;
  seasonId: string;
  episodeId: string;
  sceneId: string;
  junhoScore: number;
  taeyunScore: number;
  truthScore: number;
  riskScore: number;
  flags: Record<string, unknown>;
  updatedAt?: string;
};

export type BootstrapResponse = {
  playerId: string;
  telegramUserId: number;
  season1Owned: boolean;
  progress: ProgressDto | null;
};

export class LumiApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'LumiApiError';
  }
}


export type AnalyticsPayload = {
  eventName: string;
  episodeId?: string;
  sceneId?: string;
  metadata?: Record<string, unknown>;
};
