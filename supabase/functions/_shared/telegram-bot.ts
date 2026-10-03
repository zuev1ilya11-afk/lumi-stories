type TelegramApiEnvelope<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramWebhookInfo = {
  url?: string;
};

const encoder = new TextEncoder();

async function telegramApi<T>(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const response = await fetcher('https://api.telegram.org/bot' + botToken + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body: TelegramApiEnvelope<T>;
  try {
    body = await response.json() as TelegramApiEnvelope<T>;
  } catch {
    throw new Error('TELEGRAM_API_INVALID_RESPONSE');
  }
  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error('TELEGRAM_API_' + method + '_FAILED:' + (body.description ?? response.status));
  }
  return body.result;
}

export class TelegramWebhookConflictError extends Error {
  constructor(public readonly currentUrl: string) {
    super('TELEGRAM_WEBHOOK_CONFLICT');
    this.name = 'TelegramWebhookConflictError';
  }
}

export async function deriveTelegramWebhookSecret(botToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode('lumi-stars-webhook:' + botToken),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function ensureTelegramPaymentsWebhook(
  botToken: string,
  webhookUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const info = await telegramApi<TelegramWebhookInfo>(botToken, 'getWebhookInfo', {}, fetcher);
  const currentUrl = info.url ?? '';
  if (currentUrl && currentUrl !== webhookUrl) {
    throw new TelegramWebhookConflictError(currentUrl);
  }

  const secret = await deriveTelegramWebhookSecret(botToken);
  await telegramApi<boolean>(
    botToken,
    'setWebhook',
    {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message', 'pre_checkout_query'],
    },
    fetcher,
  );
}

export async function createStarsInvoiceLink(
  botToken: string,
  invoicePayload: string,
  priceStars: number,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  return telegramApi<string>(
    botToken,
    'createInvoiceLink',
    {
      title: 'LUMI — Сезон 1',
      description: 'Полный доступ к сезону «Последний онлайн»',
      payload: invoicePayload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: 'Полный сезон', amount: priceStars }],
    },
    fetcher,
  );
}

export async function answerTelegramPreCheckout(
  botToken: string,
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const payload: Record<string, unknown> = {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
  };
  if (!ok && errorMessage) payload.error_message = errorMessage;
  await telegramApi<boolean>(botToken, 'answerPreCheckoutQuery', payload, fetcher);
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  await telegramApi<unknown>(botToken, 'sendMessage', { chat_id: chatId, text }, fetcher);
}
