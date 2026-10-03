import { jsonResponse } from '../../_shared/http.ts';
import type {
  LumiRepository,
  Player,
  SaveProgressInput,
} from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';

export type ProgressRepository = Pick<
  LumiRepository,
  'getOrCreatePlayer' | 'getProgress' | 'saveProgress' | 'saveEpisodeCheckpoint'
>;

export type ProgressDependencies = {
  botToken: string;
  nowSeconds: number;
  repository: ProgressRepository;
  canAccessSeason?(player: Player, storyId: string, seasonId: string): Promise<boolean>;
};

const SAVE_KEYS = new Set([
  'storyId',
  'seasonId',
  'episodeId',
  'sceneId',
  'junhoScore',
  'taeyunScore',
  'truthScore',
  'riskScore',
  'flags',
]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFreeFirstEpisode(storyId: string, seasonId: string, episodeId: string): boolean {
  const seasonMatch = /^season-(\d+)$/.exec(seasonId);
  if (!seasonMatch) return false;
  return episodeId === storyId + '-s' + seasonMatch[1] + '-e1';
}

function parseSaveProgressInput(value: unknown): SaveProgressInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !SAVE_KEYS.has(key))) return null;
  if (
    !nonEmptyString(record.storyId) ||
    !nonEmptyString(record.seasonId) ||
    !nonEmptyString(record.episodeId) ||
    !nonEmptyString(record.sceneId)
  ) return null;
  for (const key of ['junhoScore', 'taeyunScore', 'truthScore', 'riskScore'] as const) {
    if (!Number.isSafeInteger(record[key])) return null;
  }
  if (!record.flags || typeof record.flags !== 'object' || Array.isArray(record.flags)) return null;

  return {
    storyId: record.storyId,
    seasonId: record.seasonId,
    episodeId: record.episodeId,
    sceneId: record.sceneId,
    junhoScore: record.junhoScore as number,
    taeyunScore: record.taeyunScore as number,
    truthScore: record.truthScore as number,
    riskScore: record.riskScore as number,
    flags: record.flags as Record<string, unknown>,
  };
}

export async function handleProgress(
  request: Request,
  dependencies: ProgressDependencies,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const initData = request.headers.get('X-Telegram-Init-Data') ?? '';
  let telegramUserId: number;
  try {
    telegramUserId = (
      await verifyTelegramInitData(initData, dependencies.botToken, dependencies.nowSeconds)
    ).id;
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const player = await dependencies.repository.getOrCreatePlayer(telegramUserId);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const storyId = url.searchParams.get('storyId');
    const seasonId = url.searchParams.get('seasonId');
    if (!nonEmptyString(storyId) || !nonEmptyString(seasonId)) {
      return jsonResponse({ error: 'INVALID_PROGRESS_QUERY' }, 400);
    }
    const progress = await dependencies.repository.getProgress(player.id, storyId, seasonId);
    return jsonResponse({ progress });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'INVALID_PROGRESS' }, 400);
  }
  const input = parseSaveProgressInput(body);
  if (!input) return jsonResponse({ error: 'INVALID_PROGRESS' }, 400);

  if (!isFreeFirstEpisode(input.storyId, input.seasonId, input.episodeId) && dependencies.canAccessSeason) {
    let allowed = false;
    try {
      allowed = await dependencies.canAccessSeason(player, input.storyId, input.seasonId);
    } catch {
      return jsonResponse({ error: 'INVALID_SEASON' }, 400);
    }
    if (!allowed) return jsonResponse({ error: 'SEASON_REQUIRED' }, 403);
  }

  const previous = await dependencies.repository.getProgress(player.id, input.storyId, input.seasonId);
  if (previous && previous.episodeId !== input.episodeId) {
    await dependencies.repository.saveEpisodeCheckpoint(player.id, input);
  }

  const progress = await dependencies.repository.saveProgress(player.id, input);
  return jsonResponse({ progress });
}
