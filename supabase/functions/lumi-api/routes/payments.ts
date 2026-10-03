import { jsonResponse } from '../../_shared/http.ts';
import type { StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository } from '../../_shared/repository.ts';
import { verifyTelegramInitData } from '../../_shared/telegram.ts';

export type PaymentRepository = Pick<LumiRepository, 'getOrCreatePlayer'>;

export type PaymentTelegramGateway = {
  ensureWebhook(): Promise<void>;
  createInvoiceLink(invoicePayload: string, priceStars: number): Promise<string>;
};

export type PaymentDependencies = {
  botToken: string;
  nowSeconds: number;
  priceStars: number;
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
      priceStars: dependencies.priceStars,
    });
  }

  try {
    await dependencies.telegram.ensureWebhook();
    const order = await dependencies.store.createOrder(player.id, dependencies.priceStars);
    const invoiceUrl = await dependencies.telegram.createInvoiceLink(
      order.invoicePayload,
      dependencies.priceStars,
    );
    return jsonResponse({
      season1Owned: false,
      priceStars: dependencies.priceStars,
      invoiceUrl,
    });
  } catch (error) {
    const code = error instanceof Error && error.message === 'TELEGRAM_WEBHOOK_CONFLICT'
      ? 'TELEGRAM_WEBHOOK_CONFLICT'
      : 'PAYMENTS_UNAVAILABLE';
    return jsonResponse({ error: code }, code === 'TELEGRAM_WEBHOOK_CONFLICT' ? 409 : 502);
  }
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
    priceStars: dependencies.priceStars,
  });
}
