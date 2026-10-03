import { jsonResponse } from '../../_shared/http.ts';
import { playerAccess } from '../../_shared/access.ts';
import type { StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository, Progress, SaveProgressInput } from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';

export const REWIND_PRODUCT_PREFIX = 'episode-rewind:';

export const EPISODE_REWIND_TARGETS = {
  'last-online-s1-e1': { index: 0, startSceneId: 'ep1_arrival', terminalSceneId: 'ep1_end_paywall' },
  'last-online-s1-e2': { index: 1, startSceneId: 'ep2_morning', terminalSceneId: 'ep2_end' },
  'last-online-s1-e3': { index: 2, startSceneId: 'ep3_elevator', terminalSceneId: 'ep3_end' },
  'last-online-s1-e4': { index: 3, startSceneId: 'ep4_morning', terminalSceneId: 'ep4_end' },
} as const;

type RewindEpisodeId = keyof typeof EPISODE_REWIND_TARGETS;

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

function isRewindEpisodeId(value: unknown): value is RewindEpisodeId {
  return typeof value === 'string' && value in EPISODE_REWIND_TARGETS;
}

function targetCompleted(progress: Progress | null, episodeId: RewindEpisodeId): boolean {
  if (!progress) return false;
  const current = EPISODE_REWIND_TARGETS[progress.episodeId as RewindEpisodeId];
  const target = EPISODE_REWIND_TARGETS[episodeId];
  if (!current) return false;
  if (current.index > target.index) return true;
  return current.index === target.index && progress.sceneId === target.terminalSceneId;
}

async function canRewind(
  playerId: string,
  episodeId: RewindEpisodeId,
  dependencies: PaymentDependencies,
): Promise<boolean> {
  const progress = await dependencies.repository.getProgress(playerId, 'last-online', 'season-1');
  if (!targetCompleted(progress, episodeId)) return false;
  if (episodeId === 'last-online-s1-e1') return true;
  const checkpoint = await dependencies.repository.getEpisodeCheckpoint(
    playerId,
    'last-online',
    'season-1',
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
  if (episodeId === 'last-online-s1-e1') {
    return {
      storyId: 'last-online', seasonId: 'season-1', episodeId,
      sceneId: target.startSceneId, junhoScore: 0, taeyunScore: 0,
      truthScore: 0, riskScore: 0, flags: {},
    };
  }
  const checkpoint = await repository.getEpisodeCheckpoint(playerId, 'last-online', 'season-1', episodeId);
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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let player;
  try {
    player = await verifiedPlayer(request, dependencies);
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const access = playerAccess(player, dependencies);
  if (access.season1Owned) {
    return jsonResponse({
      season1Owned: true,
      priceStars: access.season1PriceStars,
    });
  }

  try {
    await dependencies.telegram.ensureWebhook();
    const order = await dependencies.store.createOrder(
      player.id,
      'season-1',
      dependencies.seasonPriceStars,
    );
    const invoiceUrl = await dependencies.telegram.createInvoiceLink(
      order.invoicePayload,
      dependencies.seasonPriceStars,
    );
    return jsonResponse({
      season1Owned: false,
      priceStars: dependencies.seasonPriceStars,
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

  const progress = await dependencies.repository.getProgress(player.id, 'last-online', 'season-1');
  const target = EPISODE_REWIND_TARGETS[episodeId];
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
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let player;
  try {
    player = await verifiedPlayer(request, dependencies);
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const access = playerAccess(player, dependencies);
  return jsonResponse({
    season1Owned: access.season1Owned,
    priceStars: access.season1PriceStars,
    episodeRewindPriceStars: access.episodeRewindPriceStars,
  });
}
