import { jsonResponse } from '../../_shared/http.ts';
import type { StarPaymentOrder, StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository, SaveProgressInput } from '../../_shared/repository.ts';
import { constantTimeTextEqual } from '../../_shared/telegram-bot.ts';
import { EPISODE_REWIND_TARGETS, REWIND_PRODUCT_PREFIX } from './payments.ts';

type TelegramUser = { id?: number };
type TelegramChat = { id?: number };

type PreCheckoutQuery = {
  id?: string;
  from?: TelegramUser;
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
};

type SuccessfulPayment = {
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
  telegram_payment_charge_id?: string;
  provider_payment_charge_id?: string;
};

type RefundedPayment = {
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
  telegram_payment_charge_id?: string;
};

type TelegramMessage = {
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
  successful_payment?: SuccessfulPayment;
  refunded_payment?: RefundedPayment;
};

type TelegramUpdate = {
  pre_checkout_query?: PreCheckoutQuery;
  message?: TelegramMessage;
};

export type TelegramWebhookRepository = Pick<
  LumiRepository,
  'getOrCreatePlayer' | 'getEpisodeCheckpoint' | 'saveProgress'
>;

export type TelegramWebhookDependencies = {
  webhookSecret: string;
  seasonPriceStars: number;
  rewindPriceStars: number;
  repository: TelegramWebhookRepository;
  store: StarPaymentStore;
  answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string): Promise<void>;
  sendMessage(chatId: number, text: string): Promise<void>;
};

function productPrice(productId: string, dependencies: TelegramWebhookDependencies): number | null {
  if (productId === 'season-1') return dependencies.seasonPriceStars;
  if (productId.startsWith(REWIND_PRODUCT_PREFIX)) {
    const episodeId = productId.slice(REWIND_PRODUCT_PREFIX.length);
    if (episodeId in EPISODE_REWIND_TARGETS) return dependencies.rewindPriceStars;
  }
  return null;
}

function validOrder(
  order: StarPaymentOrder | null,
  playerId: string,
  currency: unknown,
  amount: unknown,
  dependencies: TelegramWebhookDependencies,
): order is StarPaymentOrder {
  if (!order || order.playerId !== playerId || order.currency !== 'XTR' || currency !== 'XTR') return false;
  const expectedPrice = productPrice(order.productId, dependencies);
  return expectedPrice !== null && order.amount === expectedPrice && amount === expectedPrice;
}

function rewindEpisodeId(productId: string): keyof typeof EPISODE_REWIND_TARGETS | null {
  if (!productId.startsWith(REWIND_PRODUCT_PREFIX)) return null;
  const episodeId = productId.slice(REWIND_PRODUCT_PREFIX.length);
  return episodeId in EPISODE_REWIND_TARGETS
    ? episodeId as keyof typeof EPISODE_REWIND_TARGETS
    : null;
}

async function episodeRewindInput(
  playerId: string,
  productId: string,
  dependencies: TelegramWebhookDependencies,
): Promise<SaveProgressInput> {
  const episodeId = rewindEpisodeId(productId);
  if (!episodeId) throw new Error('REWIND_PRODUCT_INVALID');
  const target = EPISODE_REWIND_TARGETS[episodeId];

  let input: SaveProgressInput;
  if (episodeId === 'last-online-s1-e1') {
    input = {
      storyId: 'last-online',
      seasonId: 'season-1',
      episodeId,
      sceneId: target.startSceneId,
      junhoScore: 0,
      taeyunScore: 0,
      truthScore: 0,
      riskScore: 0,
      flags: {},
    };
  } else {
    const checkpoint = await dependencies.repository.getEpisodeCheckpoint(
      playerId,
      'last-online',
      'season-1',
      episodeId,
    );
    if (!checkpoint) throw new Error('REWIND_CHECKPOINT_MISSING');
    input = {
      storyId: checkpoint.storyId,
      seasonId: checkpoint.seasonId,
      episodeId: checkpoint.episodeId,
      sceneId: target.startSceneId,
      junhoScore: checkpoint.junhoScore,
      taeyunScore: checkpoint.taeyunScore,
      truthScore: checkpoint.truthScore,
      riskScore: checkpoint.riskScore,
      flags: checkpoint.flags,
    };
  }

  return input;
}

async function handlePreCheckout(
  query: PreCheckoutQuery,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> {
  const queryId = typeof query.id === 'string' ? query.id : '';
  const telegramUserId = Number(query.from?.id);
  const payload = typeof query.invoice_payload === 'string' ? query.invoice_payload : '';
  let ok = false;

  try {
    if (queryId && Number.isSafeInteger(telegramUserId) && telegramUserId > 0 && payload) {
      const player = await dependencies.repository.getOrCreatePlayer(telegramUserId);
      const order = await dependencies.store.findByPayload(payload);
      if (
        validOrder(order, player.id, query.currency, query.total_amount, dependencies) &&
        !(order.productId === 'season-1' && player.season1Owned)
      ) {
        const approved = await dependencies.store.approveOrder(order, queryId);
        ok = Boolean(approved);
      }
    }
  } catch {
    ok = false;
  }

  await dependencies.answerPreCheckout(
    queryId,
    ok,
    ok ? undefined : 'Не удалось подтвердить покупку. Вернитесь в LUMI и попробуйте ещё раз.',
  );
  return jsonResponse({ ok: true });
}

async function handleSuccessfulPayment(
  message: TelegramMessage,
  payment: SuccessfulPayment,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> {
  const telegramUserId = Number(message.from?.id);
  const payload = typeof payment.invoice_payload === 'string' ? payment.invoice_payload : '';
  const telegramChargeId = typeof payment.telegram_payment_charge_id === 'string'
    ? payment.telegram_payment_charge_id
    : '';
  const providerChargeId = typeof payment.provider_payment_charge_id === 'string'
    ? payment.provider_payment_charge_id
    : '';

  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0 || !payload || !telegramChargeId) {
    return jsonResponse({ error: 'INVALID_SUCCESSFUL_PAYMENT' }, 400);
  }

  const player = await dependencies.repository.getOrCreatePlayer(telegramUserId);
  const order = await dependencies.store.findByPayload(payload);
  if (!validOrder(order, player.id, payment.currency, payment.total_amount, dependencies)) {
    return jsonResponse({ error: 'PAYMENT_MISMATCH' }, 400);
  }

  await dependencies.store.markPaid(order, telegramChargeId, providerChargeId);
  const paidOrder = await dependencies.store.findByPayload(payload);
  if (!paidOrder || paidOrder.status !== 'paid') {
    return jsonResponse({ error: 'PAYMENT_STATE_CONFLICT' }, 409);
  }
  if (paidOrder.fulfilledAt) return jsonResponse({ ok: true });

  if (paidOrder.productId === 'season-1') {
    await dependencies.store.setSeasonOwned(player.id, true);
    await dependencies.store.markFulfilled(paidOrder);
  } else {
    const input = await episodeRewindInput(player.id, paidOrder.productId, dependencies);
    await dependencies.store.fulfillEpisodeRewind(paidOrder, input);
  }
  return jsonResponse({ ok: true });
}

async function handleRefund(
  message: TelegramMessage,
  refund: RefundedPayment,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> {
  const telegramUserId = Number(message.from?.id);
  const payload = typeof refund.invoice_payload === 'string' ? refund.invoice_payload : '';
  const telegramChargeId = typeof refund.telegram_payment_charge_id === 'string'
    ? refund.telegram_payment_charge_id
    : '';

  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0 || !payload || !telegramChargeId) {
    return jsonResponse({ error: 'INVALID_REFUND' }, 400);
  }

  const player = await dependencies.repository.getOrCreatePlayer(telegramUserId);
  const order = await dependencies.store.findByPayload(payload);
  if (
    !order ||
    order.playerId !== player.id ||
    order.currency !== 'XTR' ||
    refund.currency !== 'XTR' ||
    order.amount !== refund.total_amount ||
    order.telegramPaymentChargeId !== telegramChargeId
  ) {
    return jsonResponse({ error: 'REFUND_MISMATCH' }, 400);
  }

  await dependencies.store.markRefunded(order, telegramChargeId);
  if (order.productId === 'season-1') {
    const stillOwned = await dependencies.store.hasPaidSeason(player.id);
    await dependencies.store.setSeasonOwned(player.id, stillOwned);
  }
  return jsonResponse({ ok: true });
}

async function handlePaySupport(
  message: TelegramMessage,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> {
  const telegramUserId = Number(message.from?.id);
  const chatId = Number(message.chat?.id);
  const text = typeof message.text === 'string' ? message.text : '';
  const details = text.replace(/^\/paysupport(?:@\w+)?/i, '').trim();

  if (!Number.isSafeInteger(telegramUserId) || telegramUserId <= 0 || !Number.isSafeInteger(chatId)) {
    return jsonResponse({ error: 'INVALID_SUPPORT_MESSAGE' }, 400);
  }

  if (!details) {
    await dependencies.sendMessage(
      chatId,
      'Опишите проблему после команды, например: /paysupport Оплата прошла, но доступ не открылся.',
    );
    return jsonResponse({ ok: true });
  }

  await dependencies.store.createSupportRequest(telegramUserId, details.slice(0, 2000));
  await dependencies.sendMessage(
    chatId,
    'Запрос по оплате получен. Мы проверим транзакцию и ответим в Telegram.',
  );
  return jsonResponse({ ok: true });
}

export async function handleTelegramWebhook(
  request: Request,
  dependencies: TelegramWebhookDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const receivedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!receivedSecret || !constantTimeTextEqual(receivedSecret, dependencies.webhookSecret)) {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return jsonResponse({ error: 'INVALID_UPDATE' }, 400);
  }

  if (update.pre_checkout_query) {
    return handlePreCheckout(update.pre_checkout_query, dependencies);
  }

  const message = update.message;
  if (message?.successful_payment) {
    return handleSuccessfulPayment(message, message.successful_payment, dependencies);
  }
  if (message?.refunded_payment) {
    return handleRefund(message, message.refunded_payment, dependencies);
  }
  if (typeof message?.text === 'string' && /^\/paysupport(?:@\w+)?(?:\s|$)/i.test(message.text)) {
    return handlePaySupport(message, dependencies);
  }

  return jsonResponse({ ok: true });
}
