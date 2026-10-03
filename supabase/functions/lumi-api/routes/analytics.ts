import { jsonResponse } from '../../_shared/http.ts';
import type { LumiRepository } from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';

const ALLOWED_EVENTS = new Set([
  'app_opened', 'episode_started', 'scene_reached', 'choice_selected',
  'episode_finished', 'paywall_opened', 'purchase_clicked', 'replay_started',
]);
const MAX_METADATA_BYTES = 4096;
const BODY_KEYS = new Set(['eventName', 'episodeId', 'sceneId', 'metadata']);

export type AnalyticsRepository = Pick<LumiRepository, 'getOrCreatePlayer' | 'recordAnalytics'>;
export type AnalyticsDependencies = { botToken: string; nowSeconds: number; repository: AnalyticsRepository };

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !BODY_KEYS.has(key))) return null;
  if (typeof record.eventName !== 'string' || !ALLOWED_EVENTS.has(record.eventName)) return null;
  const metadata = record.metadata ?? {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  let size = 0;
  try { size = new TextEncoder().encode(JSON.stringify(metadata)).byteLength; } catch { return null; }
  if (size > MAX_METADATA_BYTES) return null;
  return {
    eventName: record.eventName,
    episodeId: optionalString(record.episodeId),
    sceneId: optionalString(record.sceneId),
    metadata: metadata as Record<string, unknown>,
  };
}

export async function handleAnalytics(request: Request, dependencies: AnalyticsDependencies): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const initData = request.headers.get('X-Telegram-Init-Data') ?? '';
  let telegramUserId: number;
  try {
    telegramUserId = (await verifyTelegramInitData(initData, dependencies.botToken, dependencies.nowSeconds)).id;
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return jsonResponse({ error: 'INVALID_ANALYTICS_EVENT' }, 400); }
  const event = parseBody(body);
  if (!event) return jsonResponse({ error: 'INVALID_ANALYTICS_EVENT' }, 400);
  const player = await dependencies.repository.getOrCreatePlayer(telegramUserId);
  await dependencies.repository.recordAnalytics(player.id, event);
  return new Response(null, { status: 204 });
}
