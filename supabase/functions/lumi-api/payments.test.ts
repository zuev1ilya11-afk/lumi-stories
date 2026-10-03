import { handleCreateEpisodeRewindInvoice, handleCreateSeasonInvoice, handlePaymentStatus, type PaymentDependencies } from './routes/payments.ts';
import { handleTelegramWebhook, type TelegramWebhookDependencies } from './routes/telegram-webhook.ts';
import type { StarPaymentOrder, StarPaymentStore } from '../_shared/payments.ts';

const BOT_TOKEN = '123456789:test_token_for_lumi';
const NOW = 1_800_000_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function keyArrayBuffer(key: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(key.byteLength);
  copy.set(key);
  return copy.buffer;
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', keyArrayBuffer(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

async function validInitData(userId = 555111): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(NOW - 30),
    user: JSON.stringify({ id: userId, first_name: 'Лера' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + '=' + value)
    .join('\n');
  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const signature = await hmac(secretKey, dataCheckString);
  params.set('hash', [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

function order(overrides: Partial<StarPaymentOrder> = {}): StarPaymentOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    playerId: 'player-555111',
    productId: 'season-1',
    currency: 'XTR',
    amount: 149,
    invoicePayload: 'lumi:s1:11111111-1111-4111-8111-111111111111',
    status: 'pending',
    createdAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

function storeMock(current = order()): StarPaymentStore & {
  ownership: boolean;
  paidCalls: number;
  support: string[];
} {
  let value: StarPaymentOrder | null = current;
  return {
    ownership: false,
    paidCalls: 0,
    support: [],
    async createOrder(playerId, productId, amount) {
      return value ?? order({ playerId, productId, amount, invoicePayload: 'lumi:' + productId + ':new' });
    },
    async findByPayload(payload) { return value?.invoicePayload === payload ? value : null; },
    async approveOrder(existing, queryId) {
      value = { ...existing, status: 'approved', preCheckoutQueryId: queryId };
      return value;
    },
    async markPaid(existing, charge, provider) {
      this.paidCalls += 1;
      value = { ...existing, status: 'paid', telegramPaymentChargeId: charge, providerPaymentChargeId: provider, paidAt: 'now' };
      return true;
    },
    async markRefunded(existing) {
      value = { ...existing, status: 'refunded', refundedAt: 'now' };
      return true;
    },
    async markFulfilled(existing) {
      value = { ...existing, fulfilledAt: 'now' };
      return true;
    },
    async fulfillEpisodeRewind(existing, input) {
      value = { ...existing, fulfilledAt: 'now' };
      return Boolean(input.episodeId && input.sceneId);
    },
    async hasPaidSeason() { return value?.status === 'paid'; },
    async setSeasonOwned(_playerId, owned) { this.ownership = owned; },
    async createSupportRequest(_userId, messageText) { this.support.push(messageText); },
  };
}

function paymentDependencies(store: StarPaymentStore): PaymentDependencies {
  return {
    botToken: BOT_TOKEN,
    nowSeconds: NOW,
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: {
      async getOrCreatePlayer(telegramUserId) {
        return { id: 'player-' + telegramUserId, telegramUserId, season1Owned: false, createdAt: 'now' };
      },
      async getProgress(playerId) {
        return {
          playerId,
          storyId: 'last-online',
          seasonId: 'season-1',
          episodeId: 'last-online-s1-e2',
          sceneId: 'ep2_end',
          junhoScore: 6,
          taeyunScore: 8,
          truthScore: 5,
          riskScore: 5,
          flags: {},
          updatedAt: 'now',
        };
      },
      async getEpisodeCheckpoint(playerId, storyId, seasonId, episodeId) {
        return {
          playerId,
          storyId,
          seasonId,
          episodeId,
          sceneId: episodeId === 'last-online-s1-e2' ? 'ep2_morning' : 'ep1_arrival',
          junhoScore: episodeId === 'last-online-s1-e2' ? 6 : 0,
          taeyunScore: 0,
          truthScore: episodeId === 'last-online-s1-e2' ? 1 : 0,
          riskScore: 0,
          flags: {},
          updatedAt: 'now',
        };
      },
    },
    store,
    telegram: {
      async ensureWebhook() {},
      async createInvoiceLink() { return 'https://t.me/$invoice'; },
    },
  };
}

Deno.test('Stars invoice is created only for verified Telegram player', async () => {
  const store = storeMock();
  const bad = await handleCreateSeasonInvoice(new Request('https://example.test/payments/invoice', { method: 'POST' }), paymentDependencies(store));
  assert(bad.status === 401, 'missing initData must be rejected');

  const good = await handleCreateSeasonInvoice(new Request('https://example.test/payments/invoice', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': await validInitData() },
  }), paymentDependencies(store));
  assert(good.status === 200, 'verified invoice request failed');
  const payload = await good.json();
  assert(payload.invoiceUrl === 'https://t.me/$invoice', 'invoice link missing');
  assert(payload.priceStars === 149, 'wrong Stars price');
});

Deno.test('payment status returns server-owned entitlement', async () => {
  const store = storeMock();
  const deps = paymentDependencies(store);
  deps.repository = {
    ...deps.repository,
    async getOrCreatePlayer(telegramUserId) {
      return { id: 'player-' + telegramUserId, telegramUserId, season1Owned: true, createdAt: 'now' };
    },
  };
  const response = await handlePaymentStatus(new Request('https://example.test/payments/status', {
    headers: { 'X-Telegram-Init-Data': await validInitData() },
  }), deps);
  const payload = await response.json();
  assert(payload.season1Owned === true, 'ownership was not returned');
});

Deno.test('pre-checkout validates player, amount and order before approval', async () => {
  const store = storeMock();
  let answeredId = '';
  let answeredOk = false;
  const deps: TelegramWebhookDependencies = {
    webhookSecret: 'secret',
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: {
      ...paymentDependencies(store).repository,
      async saveProgress(playerId, input) {
        return { playerId, ...input, updatedAt: 'now' };
      },
    },
    store,
    async answerPreCheckout(id, ok) { answeredId = id; answeredOk = ok; },
    async sendMessage() {},
  };
  const response = await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({
      pre_checkout_query: {
        id: 'pcq-1',
        from: { id: 555111 },
        currency: 'XTR',
        total_amount: 149,
        invoice_payload: order().invoicePayload,
      },
    }),
  }), deps);
  assert(response.status === 200, 'pre-checkout webhook failed');
  assert(answeredOk && answeredId === 'pcq-1', 'pre-checkout was not approved');
});

Deno.test('successful_payment grants season ownership after charge is recorded', async () => {
  const store = storeMock(order({ status: 'approved', preCheckoutQueryId: 'pcq-1' }));
  const deps: TelegramWebhookDependencies = {
    webhookSecret: 'secret',
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: {
      ...paymentDependencies(store).repository,
      async saveProgress(playerId, input) {
        return { playerId, ...input, updatedAt: 'now' };
      },
    },
    store: rewindStore,
    async answerPreCheckout() {},
    async sendMessage() {},
  };
  const response = await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({
      message: {
        from: { id: 555111 },
        successful_payment: {
          currency: 'XTR',
          total_amount: 149,
          invoice_payload: order().invoicePayload,
          telegram_payment_charge_id: 'charge-1',
          provider_payment_charge_id: '',
        },
      },
    }),
  }), deps);
  assert(response.status === 200, 'successful payment webhook failed');
  assert(store.paidCalls === 1, 'charge was not recorded');
  assert(store.ownership === true, 'season entitlement was not granted');
});

Deno.test('episode rewind invoice uses its own Stars product and price', async () => {
  const rewindOrder = order({
    productId: 'episode-rewind:last-online-s1-e1',
    amount: 49,
    invoicePayload: 'lumi:episode-rewind:last-online-s1-e1:11111111-1111-4111-8111-111111111111',
  });
  const store = storeMock(rewindOrder);
  const deps = paymentDependencies(store);
  const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ episodeId: 'last-online-s1-e1' }),
  }), deps);
  assert(response.status === 200, 'rewind invoice request failed');
  const payload = await response.json();
  assert(payload.priceStars === 49, 'wrong rewind Stars price');
  assert(payload.episodeId === 'last-online-s1-e1', 'wrong rewind episode');
});

Deno.test('successful rewind payment resets canonical progress to the paid episode start', async () => {
  const rewindOrder = order({
    productId: 'episode-rewind:last-online-s1-e1',
    amount: 49,
    invoicePayload: 'lumi:episode-rewind:last-online-s1-e1:11111111-1111-4111-8111-111111111111',
    status: 'approved',
    preCheckoutQueryId: 'pcq-rewind',
  });
  const store = storeMock(rewindOrder);
  let savedScene = '';
  let savedEpisode = '';
  const baseStore = store;
  const rewindStore: StarPaymentStore = {
    ...baseStore,
    async fulfillEpisodeRewind(existing, input) {
      savedEpisode = input.episodeId;
      savedScene = input.sceneId;
      return baseStore.fulfillEpisodeRewind(existing, input);
    },
  };
  const deps: TelegramWebhookDependencies = {
    webhookSecret: 'secret',
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: {
      ...paymentDependencies(store).repository,
      async saveProgress(playerId, input) {
        savedEpisode = input.episodeId;
        savedScene = input.sceneId;
        return { playerId, ...input, updatedAt: 'now' };
      },
    },
    store,
    async answerPreCheckout() {},
    async sendMessage() {},
  };
  const response = await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({
      message: {
        from: { id: 555111 },
        successful_payment: {
          currency: 'XTR',
          total_amount: 49,
          invoice_payload: rewindOrder.invoicePayload,
          telegram_payment_charge_id: 'charge-rewind',
          provider_payment_charge_id: '',
        },
      },
    }),
  }), deps);
  assert(response.status === 200, 'rewind successful payment webhook failed');
  assert(savedEpisode === 'last-online-s1-e1', 'rewind saved wrong episode');
  assert(savedScene === 'ep1_arrival', 'rewind did not reset to episode start');
  assert(store.ownership === false, 'rewind must not grant season ownership');
});

Deno.test('/paysupport accepts a payment support request through the bot webhook', async () => {
  const store = storeMock();
  let reply = '';
  const deps: TelegramWebhookDependencies = {
    webhookSecret: 'secret',
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: {
      ...paymentDependencies(store).repository,
      async saveProgress(playerId, input) {
        return { playerId, ...input, updatedAt: 'now' };
      },
    },
    store,
    async answerPreCheckout() {},
    async sendMessage(_chatId, text) { reply = text; },
  };
  const response = await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({
      message: {
        from: { id: 555111 },
        chat: { id: 555111 },
        text: '/paysupport Оплата прошла, доступ не открылся',
      },
    }),
  }), deps);
  assert(response.status === 200, 'support webhook failed');
  assert(store.support.length === 1, 'support request was not stored');
  assert(reply.includes('получен'), 'support acknowledgement was not sent');
});
