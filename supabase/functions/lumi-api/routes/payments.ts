import { jsonResponse } from '../../_shared/http.ts';
import { playerAccess } from '../../_shared/access.ts';
import type { StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository, Player, Progress, SaveProgressInput } from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';
import { EPISODE_REWIND_TARGETS, isRewindEpisodeId, type RewindEpisodeId } from '../rewind-targets.ts';

export const REWIND_PRODUCT_PREFIX = 'episode-rewind:';
export const SEASON_PRODUCT_PREFIX = 'season:';

const SUPPORTED_SEASONS = new Set([
  'last-online:season-1',
  'house-of-black-roses:season-1',
]);

const SEASON_PRICE_OVERRIDES = new Map<string, number>([
  ['house-of-black-roses:season-1', 249],
]);

export function seasonPriceStarsFor(storyId: string, seasonId: string, defaultPriceStars: number): number {
  return SEASON_PRICE_OVERRIDES.get(storyId + ':' + seasonId) ?? defaultPriceStars;
}

export function seasonProductId(storyId: string, seasonId: string): string | null {
  const key = storyId + ':' + seasonId;
  return SUPPORTED_SEASONS.has(key) ? SEASON_PRODUCT_PREFIX + key : null;
}

export function isSeasonProductId(productId: string): boolean {
  if (!productId.startsWith(SEASON_PRODUCT_PREFIX)) return false;
  return SUPPORTED_SEASONS.has(productId.slice(SEASON_PRODUCT_PREFIX.length));
}

type SeasonTarget = { storyId: string; seasonId: string; productId: string };

function seasonTarget(storyId: string, seasonId: string): SeasonTarget | null {
  const productId = seasonProductId(storyId, seasonId);
  return productId ? { storyId, seasonId, productId } : null;
}

function requestedSeasonFromUrl(request: Request): SeasonTarget | null {
  const url = new URL(request.url);
  return seasonTarget(
    url.searchParams.get('storyId') ?? 'last-online',
    url.searchParams.get('seasonId') ?? 'season-1',
  );
}

async function requestedSeasonFromInvoice(request: Request): Promise<SeasonTarget | null> {
  let storyId = 'last-online';
  let seasonId = 'season-1';
  const raw = await request.text();
  if (raw.trim()) {
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return null; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    if (record.storyId !== undefined) {
      if (typeof record.storyId !== 'string' || !record.storyId.trim()) return null;
      storyId = record.storyId;
    }
    if (record.seasonId !== undefined) {
      if (typeof record.seasonId !== 'string' || !record.seasonId.trim()) return null;
      seasonId = record.seasonId;
    }
  }
  return seasonTarget(storyId, seasonId);
}

export async function seasonAccess(
  player: Player,
  storyId: string,
  seasonId: string,
  dependencies: Pick<PaymentDependencies, 'seasonPriceStars' | 'seasonFree' | 'store'>,
): Promise<{ season1Owned: boolean; season1PriceStars: number }> {
  const productId = seasonProductId(storyId, seasonId);
  if (!productId) throw new Error('UNSUPPORTED_SEASON');
  const free = dependencies.seasonFree === true || player.freeAccess === true;
  const legacyOwned = storyId === 'last-online' && seasonId === 'season-1' && player.season1Owned;
  const paid = legacyOwned ? true : await dependencies.store.hasPaidProduct(player.id, productId);
  return {
    season1Owned: free || paid,
    season1PriceStars: free ? 0 : seasonPriceStarsFor(storyId, seasonId, dependencies.seasonPriceStars),
  };
}

export type PaymentRepository = Pick<
  LumiRepository,
  'getOrCreatePlayer' | 'getProgress' | 'getEpisodeCheckpoint' | 'saveProgress'
>;

export type PaymentTelegramGateway = {
  ensureWebhook(): Promise<void>;
  createInvoiceLink(invoicePayload: string, priceStars: number): Promise<string>;
};

export type PaymentDependencies = {
  botToken: string;
  nowSeconds: number;
  seasonPriceStars: number;
  rewindPriceStars: number;
  seasonFree?: boolean;
  repository: PaymentRepository;
  store: StarPaymentStore;
  telegram: PaymentTelegramGateway;
};

async function verifiedPlayer(
  request: Request,
  dependencies: PaymentDependencies,
) {
  const initData = request.headers.get('X-Telegram-Init-Data') ?? '';
  const user = await verifyTelegramInitData(
    initData,
    dependencies.botToken,
    dependencies.nowSeconds,
  );
  return dependencies.repository.getOrCreatePlayer(user.id);
}

function targetCompleted(progress: Progress | null, episodeId: RewindEpisodeId): boolean {
  if (!progress) return false;
  const target = EPISODE_REWIND_TARGETS[episodeId];
  const current = EPISODE_REWIND_TARGETS[progress.episodeId as RewindEpisodeId];
  if (
    !current ||
    progress.storyId !== target.storyId ||
    progress.seasonId !== target.seasonId ||
    current.storyId !== target.storyId ||
    current.seasonId !== target.seasonId
  ) return false;
  if (current.index > target.index) return true;
  return current.index === target.index &&
    (target.terminalSceneIds as readonly string[]).includes(progress.sceneId);
}

async function canRewind(
  playerId: string,
  episodeId: RewindEpisodeId,
  dependencies: PaymentDependencies,
): Promise<boolean> {
  const target = EPISODE_REWIND_TARGETS[episodeId];
  const progress = await dependencies.repository.getProgress(playerId, target.storyId, target.seasonId);
  if (!targetCompleted(progress, episodeId)) return false;
  if (target.index === 0) return true;
  const checkpoint = await dependencies.repository.getEpisodeCheckpoint(
    playerId,
    target.storyId,
    target.seasonId,
    episodeId,
  );
  return Boolean(checkpoint);
}

export async function episodeRewindInput(
  playerId: string,
  episodeId: RewindEpisodeId,
  repository: Pick<LumiRepository, 'getEpisodeCheckpoint'>,
): Promise<SaveProgressInput> {
  const target = EPISODE_REWIND_TARGETS[episodeId];
  if (target.index === 0) {
    return {
      storyId: target.storyId, seasonId: target.seasonId, episodeId,
      sceneId: target.startSceneId, junhoScore: 0, taeyunScore: 0,
      truthScore: 0, riskScore: 0, flags: {},
    };
  }
  const checkpoint = await repository.getEpisodeCheckpoint(
    playerId,
    target.storyId,
    target.seasonId,
    episodeId,
  );
  if (!checkpoint) throw new Error('REWIND_CHECKPOINT_MISSING');
  return {
    storyId: checkpoint.storyId, seasonId: checkpoint.seasonId, episodeId,
    sceneId: target.startSceneId, junhoScore: checkpoint.junhoScore,
    taeyunScore: checkpoint.taeyunScore, truthScore: checkpoint.truthScore,
    riskScore: checkpoint.riskScore, flags: checkpoint.flags,
  };
}

export async function handleCreateSeasonInvoice(
  request: Request,
  dependencies: PaymentDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  let player;
  try { player = await verifiedPlayer(request, dependencies); }
  catch { return jsonResponse({ error: 'UNAUTHORIZED' }, 401); }

  const target = await requestedSeasonFromInvoice(request);
  if (!target) return jsonResponse({ error: 'INVALID_SEASON' }, 400);

  const access = await seasonAccess(player, target.storyId, target.seasonId, dependencies);
  if (access.season1Owned) {
    return jsonResponse({
      season1Owned: true,
      priceStars: access.season1PriceStars,
      storyId: target.storyId,
      seasonId: target.seasonId,
    });
  }

  try {
    await dependencies.telegram.ensureWebhook();
    const priceStars = seasonPriceStarsFor(target.storyId, target.seasonId, dependencies.seasonPriceStars);
    const order = await dependencies.store.createOrder(player.id, target.productId, priceStars);
    const invoiceUrl = await dependencies.telegram.createInvoiceLink(order.invoicePayload, priceStars);
    return jsonResponse({
      season1Owned: false,
      priceStars,
      storyId: target.storyId,
      seasonId: target.seasonId,
      invoiceUrl,
    });
  } catch (error) {
    const code = error instanceof Error && error.message === 'TELEGRAM_WEBHOOK_CONFLICT'
      ? 'TELEGRAM_WEBHOOK_CONFLICT'
      : 'PAYMENTS_UNAVAILABLE';
    return jsonResponse({ error: code }, code === 'TELEGRAM_WEBHOOK_CONFLICT' ? 409 : 502);
  }
}

export async function handleCreateEpisodeRewindInvoice(
  request: Request,
  dependencies: PaymentDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let player;
  try {
    player = await verifiedPlayer(request, dependencies);
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'INVALID_REWIND_REQUEST' }, 400);
  }
  const episodeId = (body as { episodeId?: unknown } | null)?.episodeId;
  if (!isRewindEpisodeId(episodeId)) {
    return jsonResponse({ error: 'INVALID_REWIND_EPISODE' }, 400);
  }

  if (!await canRewind(player.id, episodeId, dependencies)) {
    return jsonResponse({ error: 'REWIND_NOT_AVAILABLE' }, 409);
  }

  if (player.freeAccess === true) {
    // Older clients always expect a Telegram invoice and cannot handle a direct rewind.
    if ((body as { allowFreeRewind?: unknown }).allowFreeRewind !== true) {
      return jsonResponse({ error: 'CLIENT_RELOAD_REQUIRED' }, 409);
    }
    try {
      const input = await episodeRewindInput(player.id, episodeId, dependencies.repository);
      await dependencies.repository.saveProgress(player.id, input);
      return jsonResponse({ episodeId, priceStars: 0, applied: true });
    } catch {
      return jsonResponse({ error: 'REWIND_UNAVAILABLE' }, 503);
    }
  }

  try {
    await dependencies.telegram.ensureWebhook();
    const productId = REWIND_PRODUCT_PREFIX + episodeId;
    const order = await dependencies.store.createOrder(
      player.id,
      productId,
      dependencies.rewindPriceStars,
    );
    const invoiceUrl = await dependencies.telegram.createInvoiceLink(
      order.invoicePayload,
      dependencies.rewindPriceStars,
    );
    return jsonResponse({
      episodeId,
      priceStars: dependencies.rewindPriceStars,
      invoiceUrl,
    });
  } catch (error) {
    const code = error instanceof Error && error.message === 'TELEGRAM_WEBHOOK_CONFLICT'
      ? 'TELEGRAM_WEBHOOK_CONFLICT'
      : 'PAYMENTS_UNAVAILABLE';
    return jsonResponse({ error: code }, code === 'TELEGRAM_WEBHOOK_CONFLICT' ? 409 : 502);
  }
}

export async function handleEpisodeRewindStatus(
  request: Request,
  dependencies: PaymentDependencies,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let player;
  try {
    player = await verifiedPlayer(request, dependencies);
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const episodeId = new URL(request.url).searchParams.get('episodeId');
  if (!isRewindEpisodeId(episodeId)) {
    return jsonResponse({ error: 'INVALID_REWIND_EPISODE' }, 400);
  }

  const target = EPISODE_REWIND_TARGETS[episodeId];
  const progress = await dependencies.repository.getProgress(
    player.id,
    target.storyId,
    target.seasonId,
  );
  return jsonResponse({
    episodeId,
    priceStars: playerAccess(player, dependencies).episodeRewindPriceStars,
    applied: Boolean(
      progress &&
      progress.episodeId === episodeId &&
      progress.sceneId === target.startSceneId,
    ),
  });
}

export async function handlePaymentStatus(
  request: Request,
  dependencies: PaymentDependencies,
): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);

  let player;
  try { player = await verifiedPlayer(request, dependencies); }
  catch { return jsonResponse({ error: 'UNAUTHORIZED' }, 401); }

  const target = requestedSeasonFromUrl(request);
  if (!target) return jsonResponse({ error: 'INVALID_SEASON' }, 400);

  const access = await seasonAccess(player, target.storyId, target.seasonId, dependencies);
  return jsonResponse({
    season1Owned: access.season1Owned,
    priceStars: access.season1PriceStars,
    episodeRewindPriceStars: player.freeAccess === true ? 0 : dependencies.rewindPriceStars,
    storyId: target.storyId,
    seasonId: target.seasonId,
  });
}
