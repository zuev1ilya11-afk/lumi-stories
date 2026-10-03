export type Player = {
  id: string;
  telegramUserId: number;
  season1Owned: boolean;
  createdAt: string;
};

export type Progress = {
  playerId: string;
  storyId: string;
  seasonId: string;
  episodeId: string;
  sceneId: string;
  junhoScore: number;
  taeyunScore: number;
  truthScore: number;
  riskScore: number;
  flags: Record<string, unknown>;
  updatedAt: string;
};

export type ProgressRow = Progress;

export type EpisodeCheckpoint = Progress;
export type EpisodeCheckpointRow = EpisodeCheckpoint;

export type SaveProgressInput = Omit<Progress, 'playerId' | 'updatedAt'>;


export type AnalyticsEventInput = {
  eventName: string;
  episodeId?: string;
  sceneId?: string;
  metadata: Record<string, unknown>;
};

export type AnalyticsEventRow = AnalyticsEventInput & {
  playerId: string;
  timestamp: string;
};

export interface LumiDatabaseAdapter {
  upsertPlayerByTelegramId(telegramUserId: number): Promise<Player>;
  findProgress(playerId: string, storyId: string, seasonId: string): Promise<ProgressRow | null>;
  upsertProgress(row: ProgressRow): Promise<ProgressRow>;
  findEpisodeCheckpoint(playerId: string, storyId: string, seasonId: string, episodeId: string): Promise<EpisodeCheckpointRow | null>;
  upsertEpisodeCheckpoint(row: EpisodeCheckpointRow): Promise<EpisodeCheckpointRow>;
  insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void>;
}

export interface LumiRepository {
  getOrCreatePlayer(telegramUserId: number): Promise<Player>;
  getProgress(playerId: string, storyId: string, seasonId: string): Promise<Progress | null>;
  saveProgress(playerId: string, input: SaveProgressInput): Promise<Progress>;
  getEpisodeCheckpoint(playerId: string, storyId: string, seasonId: string, episodeId: string): Promise<EpisodeCheckpoint | null>;
  saveEpisodeCheckpoint(playerId: string, input: SaveProgressInput): Promise<EpisodeCheckpoint>;
  recordAnalytics(playerId: string, input: AnalyticsEventInput): Promise<void>;
}

export function createRepository(database: LumiDatabaseAdapter): LumiRepository {
  return {
    getOrCreatePlayer(telegramUserId) {
      return database.upsertPlayerByTelegramId(telegramUserId);
    },
    getProgress(playerId, storyId, seasonId) {
      return database.findProgress(playerId, storyId, seasonId);
    },
    saveProgress(playerId, input) {
      return database.upsertProgress({
        playerId,
        ...input,
        updatedAt: new Date().toISOString(),
      });
    },
    getEpisodeCheckpoint(playerId, storyId, seasonId, episodeId) {
      return database.findEpisodeCheckpoint(playerId, storyId, seasonId, episodeId);
    },
    saveEpisodeCheckpoint(playerId, input) {
      return database.upsertEpisodeCheckpoint({
        playerId,
        ...input,
        updatedAt: new Date().toISOString(),
      });
    },
    recordAnalytics(playerId, input) {
      return database.insertAnalyticsEvent({ playerId, ...input, timestamp: new Date().toISOString() });
    },
  };
}

type FetchLike = typeof fetch;

type PlayerDbRow = {
  id: string;
  telegram_user_id: number;
  season_1_owned: boolean;
  created_at: string;
};

type ProgressDbRow = {
  player_id: string;
  story_id: string;
  season_id: string;
  episode_id: string;
  scene_id: string;
  junho_score: number;
  taeyun_score: number;
  truth_score: number;
  risk_score: number;
  flags: Record<string, unknown>;
  updated_at: string;
};

function playerFromRow(row: PlayerDbRow): Player {
  return {
    id: row.id,
    telegramUserId: Number(row.telegram_user_id),
    season1Owned: row.season_1_owned,
    createdAt: row.created_at,
  };
}

function progressFromRow(row: ProgressDbRow): Progress {
  return {
    playerId: row.player_id,
    storyId: row.story_id,
    seasonId: row.season_id,
    episodeId: row.episode_id,
    sceneId: row.scene_id,
    junhoScore: row.junho_score,
    taeyunScore: row.taeyun_score,
    truthScore: row.truth_score,
    riskScore: row.risk_score,
    flags: row.flags ?? {},
    updatedAt: row.updated_at,
  };
}

async function readRows<T>(response: Response): Promise<T[]> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase Data API ${response.status}: ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Supabase Data API returned a non-array response');
  return data as T[];
}

export function createSupabaseRestDatabaseAdapter(
  supabaseUrl: string,
  secretKey: string,
  fetcher: FetchLike = fetch,
): LumiDatabaseAdapter {
  const root = supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: secretKey,
    'Content-Type': 'application/json',
  };

  return {
    async upsertPlayerByTelegramId(telegramUserId) {
      const response = await fetcher(
        `${root}/rest/v1/players?on_conflict=telegram_user_id&select=id,telegram_user_id,season_1_owned,created_at`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({ telegram_user_id: telegramUserId }),
        },
      );
      const [row] = await readRows<PlayerDbRow>(response);
      if (!row) throw new Error('Supabase player upsert returned no row');
      return playerFromRow(row);
    },

    async findProgress(playerId, storyId, seasonId) {
      const query = new URLSearchParams({
        player_id: `eq.${playerId}`,
        story_id: `eq.${storyId}`,
        season_id: `eq.${seasonId}`,
        select: 'player_id,story_id,season_id,episode_id,scene_id,junho_score,taeyun_score,truth_score,risk_score,flags,updated_at',
        limit: '1',
      });
      const response = await fetcher(`${root}/rest/v1/progress?${query.toString()}`, { headers });
      const [row] = await readRows<ProgressDbRow>(response);
      return row ? progressFromRow(row) : null;
    },

    async upsertProgress(row) {
      const response = await fetcher(
        `${root}/rest/v1/progress?on_conflict=player_id,story_id,season_id&select=player_id,story_id,season_id,episode_id,scene_id,junho_score,taeyun_score,truth_score,risk_score,flags,updated_at`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            player_id: row.playerId,
            story_id: row.storyId,
            season_id: row.seasonId,
            episode_id: row.episodeId,
            scene_id: row.sceneId,
            junho_score: row.junhoScore,
            taeyun_score: row.taeyunScore,
            truth_score: row.truthScore,
            risk_score: row.riskScore,
            flags: row.flags,
            updated_at: row.updatedAt,
          }),
        },
      );
      const [saved] = await readRows<ProgressDbRow>(response);
      if (!saved) throw new Error('Supabase progress upsert returned no row');
      return progressFromRow(saved);
    },

    async findEpisodeCheckpoint(playerId, storyId, seasonId, episodeId) {
      const query = new URLSearchParams({
        player_id: `eq.${playerId}`,
        story_id: `eq.${storyId}`,
        season_id: `eq.${seasonId}`,
        episode_id: `eq.${episodeId}`,
        select: 'player_id,story_id,season_id,episode_id,scene_id,junho_score,taeyun_score,truth_score,risk_score,flags,updated_at',
        limit: '1',
      });
      const response = await fetcher(`${root}/rest/v1/episode_checkpoints?${query.toString()}`, { headers });
      const [row] = await readRows<ProgressDbRow>(response);
      return row ? progressFromRow(row) : null;
    },

    async upsertEpisodeCheckpoint(row) {
      const response = await fetcher(
        `${root}/rest/v1/episode_checkpoints?on_conflict=player_id,story_id,season_id,episode_id&select=player_id,story_id,season_id,episode_id,scene_id,junho_score,taeyun_score,truth_score,risk_score,flags,updated_at`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify({
            player_id: row.playerId,
            story_id: row.storyId,
            season_id: row.seasonId,
            episode_id: row.episodeId,
            scene_id: row.sceneId,
            junho_score: row.junhoScore,
            taeyun_score: row.taeyunScore,
            truth_score: row.truthScore,
            risk_score: row.riskScore,
            flags: row.flags,
            updated_at: row.updatedAt,
          }),
        },
      );
      const [saved] = await readRows<ProgressDbRow>(response);
      if (!saved) throw new Error('Supabase episode checkpoint upsert returned no row');
      return progressFromRow(saved);
    },

    async insertAnalyticsEvent(row) {
      const response = await fetcher(`${root}/rest/v1/analytics_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          player_id: row.playerId,
          event_name: row.eventName,
          episode_id: row.episodeId ?? null,
          scene_id: row.sceneId ?? null,
          metadata: row.metadata,
          timestamp: row.timestamp,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Supabase analytics insert ${response.status}: ${body.slice(0, 300)}`);
      }
    },
  };
}

export function readSupabaseServerSecret(
  envGet: (name: string) => string | undefined,
): string | null {
  const secretKeys = envGet('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to the legacy key while old projects migrate.
    }
  }
  const legacy = envGet('SUPABASE_SERVICE_ROLE_KEY');
  return legacy && legacy.length > 0 ? legacy : null;
}
