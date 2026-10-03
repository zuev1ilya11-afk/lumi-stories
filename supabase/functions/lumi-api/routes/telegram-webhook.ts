import { jsonResponse } from '../../_shared/http.ts';
import type { StarPaymentOrder, StarPaymentStore } from '../../_shared/payments.ts';
import type { LumiRepository } from '../../_shared/repository.ts';
import { constantTimeTextEqual } from '../../_shared/telegram-bot.ts';

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

export type TelegramWebhookRepository = Pick<LumiRepository, 'getOrCreatePlayer'>;

export type TelegramWebhookDependencies = {
  webhookSecret: string;
  priceStars: number;
  repository: TelegramWebhookRepository;
  store: StarPaymentStore;
  answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string): Promise<void>;
  sendMessage(chatId: number, text: string): Promise<void>;
};

function validOrder(
  order: StarPaymentOrder | null,
  playerId: string,
  currency: unknown,
  amount: unknown,
  priceStars: number,
): order is StarPaymentOrder {
  return Boolean(
    order &&
    order.playerId === playerId &&
    order.productId === 'season-1' &&
    order.currency === 'XTR' &&
    currency === 'XTR' &&
    order.amount === priceStars &&
    amount === priceStars,
  );
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
        !player.season1Owned &&
        validOrder(order, player.id, query.currency, query.total_amount, dependencies.priceStars)
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
  if (!validOrder(order, player.id, payment.currency, payment.total_amount, dependencies.priceStars)) {
    return jsonResponse({ error: 'PAYMENT_MISMATCH' }, 400);
  }

  await dependencies.store.markPaid(order, telegramChargeId, providerChargeId);
  await dependencies.store.setSeasonOwned(player.id, true);
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
  const stillOwned = await dependencies.store.hasPaidSeason(player.id);
  await dependencies.store.setSeasonOwned(player.id, stillOwned);
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
