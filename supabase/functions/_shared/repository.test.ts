import {
  createRepository,
  type LumiDatabaseAdapter,
  type Player,
  type Progress,
  type ProgressRow,
} from './repository.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function createMemoryDatabase(): LumiDatabaseAdapter & { playerCount(): number; progressCount(): number } {
  const players = new Map<number, Player>();
  const progress = new Map<string, ProgressRow>();
  const checkpoints = new Map<string, ProgressRow>();
  return {
    async upsertPlayerByTelegramId(telegramUserId) {
      const existing = players.get(telegramUserId);
      if (existing) return existing;
      const created: Player = {
        id: `player-${telegramUserId}`,
        telegramUserId,
        season1Owned: false,
        createdAt: '2026-10-02T00:00:00.000Z',
      };
      players.set(telegramUserId, created);
      return created;
    },
    async findProgress(playerId, storyId, seasonId) {
      return progress.get(`${playerId}:${storyId}:${seasonId}`) ?? null;
    },
    async upsertProgress(row) {
      progress.set(`${row.playerId}:${row.storyId}:${row.seasonId}`, row);
      return row;
    },
    async findEpisodeCheckpoint(playerId, storyId, seasonId, episodeId) {
      return checkpoints.get(`${playerId}:${storyId}:${seasonId}:${episodeId}`) ?? null;
    },
    async upsertEpisodeCheckpoint(row) {
      checkpoints.set(`${row.playerId}:${row.storyId}:${row.seasonId}:${row.episodeId}`, row);
      return row;
    },
    async insertAnalyticsEvent() {},
    playerCount: () => players.size,
    progressCount: () => progress.size,
  };
}

Deno.test('repository reuses one player for the same Telegram id', async () => {
  const db = createMemoryDatabase();
  const repository = createRepository(db);
  const first = await repository.getOrCreatePlayer(12345);
  const second = await repository.getOrCreatePlayer(12345);
  assert(first.id === second.id, 'same Telegram id returned different players');
  assert(db.playerCount() === 1, `expected one player, got ${db.playerCount()}`);
});

Deno.test('saveProgress upserts exactly one row per player story and season', async () => {
  const db = createMemoryDatabase();
  const repository = createRepository(db);
  const player = await repository.getOrCreatePlayer(12345);
  const first = await repository.saveProgress(player.id, {
    storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 'scene-1',
    junhoScore: 1, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: {},
  });
  const second = await repository.saveProgress(player.id, {
    storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 'scene-2',
    junhoScore: 2, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: { toldJunho: true },
  });
  assert(first.sceneId === 'scene-1', 'first progress wrong');
  assert(second.sceneId === 'scene-2', 'updated progress wrong');
  assert(db.progressCount() === 1, `expected one progress row, got ${db.progressCount()}`);
  const loaded: Progress | null = await repository.getProgress(player.id, 'last-online', 'season-1');
  assert(loaded?.sceneId === 'scene-2', 'loaded progress did not contain latest upsert');
});
