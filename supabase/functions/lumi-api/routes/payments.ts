import { jsonResponse } from '../../_shared/http.ts';
import type { StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository, Progress } from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';

export const REWIND_PRODUCT_PREFIX = 'episode-rewind:';

export const EPISODE_REWIND_TARGETS = {
  'last-online-s1-e1': { index: 0, startSceneId: 'ep1_arrival', terminalSceneId: 'ep1_end_paywall' },
  'last-online-s1-e2': { index: 1, startSceneId: 'ep2_morning', terminalSceneId: 'ep2_end' },
} as const;

type RewindEpisodeId = keyof typeof EPISODE_REWIND_TARGETS;

export type PaymentRepository = Pick<
  LumiRepository,
  'getOrCreatePlayer' | 'getProgress' | 'getEpisodeCheckpoint'
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

  if (player.season1Owned) {
    return jsonResponse({
      season1Owned: true,
      priceStars: dependencies.seasonPriceStars,
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
    priceStars: dependencies.rewindPriceStars,
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

  return jsonResponse({
    season1Owned: player.season1Owned,
    priceStars: dependencies.seasonPriceStars,
    episodeRewindPriceStars: dependencies.rewindPriceStars,
  });
}
