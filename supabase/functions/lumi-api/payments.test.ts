import { handleCreateEpisodeRewindInvoice, handleCreateSeasonInvoice, handlePaymentStatus, type PaymentDependencies } from './routes/payments.ts';
import { handleTelegramWebhook, type TelegramWebhookDependencies } from './routes/telegram-webhook.ts';
import type { StarPaymentOrder, StarPaymentStore } from '../_shared/payments.ts';
import type { SaveProgressInput } from '../_shared/repository.ts';

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
    async hasPaidProduct(_playerId, productId) { return value?.status === 'paid' && value.productId === productId; },
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
      async saveProgress(playerId, input) { return { playerId, ...input, updatedAt: 'now' }; },
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

Deno.test('free season opens access without creating a payment or permanent purchase', async () => {
  const store = storeMock();
  let charged = false;
  store.createOrder = async () => { charged = true; return order(); };
  const deps = { ...paymentDependencies(store), seasonFree: true };
  const headers = { 'X-Telegram-Init-Data': await validInitData() };
  const invoice = await (await handleCreateSeasonInvoice(new Request('https://example.test/payments/invoice', { method: 'POST', headers }), deps)).json();
  const status = await (await handlePaymentStatus(new Request('https://example.test/payments/status', { headers }), deps)).json();
  assert(invoice.season1Owned && invoice.priceStars === 0 && !invoice.invoiceUrl, 'free season must bypass invoice');
  assert(status.season1Owned && status.priceStars === 0 && status.episodeRewindPriceStars === 49, 'public free season must not grant free rewinds');
  assert(!charged && !store.ownership, 'temporary free access must not create payment or permanent ownership');
});

Deno.test('personal free access survives end of public promotion and rewinds from the trusted checkpoint', async () => {
  const base = paymentDependencies(storeMock());
  const saved: SaveProgressInput[] = [];
  const deps = {
    ...base,
    seasonFree: false,
    repository: {
      ...base.repository,
      async getOrCreatePlayer(id: number) { return { ...await base.repository.getOrCreatePlayer(id), freeAccess: true }; },
      async saveProgress(playerId: string, input: SaveProgressInput) { saved.push(input); return { playerId, ...input, updatedAt: 'now' }; },
    },
    telegram: {
      async ensureWebhook() { throw new Error('free access must not contact Telegram payments'); },
      async createInvoiceLink() { throw new Error('free access must not create invoice'); },
    },
  };
  const headers = { 'X-Telegram-Init-Data': await validInitData() };
  const status = await (await handlePaymentStatus(new Request('https://example.test/payments/status', { headers }), deps)).json();
  assert(status.season1Owned && status.priceStars === 0 && status.episodeRewindPriceStars === 0, 'personal access must be free independently of promotion');
  const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST', headers, body: JSON.stringify({ episodeId: 'last-online-s1-e2', allowFreeRewind: true, junhoScore: 999, flags: { forged: true } }),
  }), deps);
  const payload = await response.json();
  assert(response.status === 200 && payload.applied && payload.priceStars === 0 && !payload.invoiceUrl, 'free rewind did not apply');
  assert(saved.length === 1 && saved[0].sceneId === 'ep2_morning' && saved[0].junhoScore === 6 && saved[0].truthScore === 1 && !saved[0].flags.forged, 'rewind must restore trusted previous-episode state');
  const legacy = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST', headers, body: JSON.stringify({ episodeId: 'last-online-s1-e2' }),
  }), deps);
  assert(legacy.status === 409 && saved.length === 1, 'old clients must reload before a free rewind can mutate progress');
});

Deno.test('public free season cannot be used to forge a free personal rewind', async () => {
  const deps = { ...paymentDependencies(storeMock()), seasonFree: true };
  const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST', headers: { 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ episodeId: 'last-online-s1-e1', freeAccess: true, priceStars: 0 }),
  }), deps);
  const payload = await response.json();
  assert(payload.priceStars === 49 && payload.invoiceUrl && !payload.applied, 'client must not grant itself free rewinds');
});

Deno.test('old season invoices are rejected at pre-checkout while the season is free', async () => {
  const store = storeMock();
  let approved: boolean | undefined;
  const deps = {
    webhookSecret: 'secret', seasonPriceStars: 149, rewindPriceStars: 49, seasonFree: true,
    repository: paymentDependencies(store).repository, store,
    async answerPreCheckout(_id: string, ok: boolean) { approved = ok; },
    async sendMessage() {},
  };
  await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
    body: JSON.stringify({ pre_checkout_query: { id: 'old-invoice', from: { id: 555111 }, currency: 'XTR', total_amount: 149, invoice_payload: order().invoicePayload } }),
  }), deps);
  assert(approved === false, 'old invoice must not charge for free season');
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

Deno.test('Episode 3 progress permits rewinding completed earlier episodes and its own completed chapter', async () => {
  for (const [target, sceneId, wanted] of [
    ['last-online-s1-e1', 'ep3_elevator', 200],
    ['last-online-s1-e2', 'ep3_elevator', 200],
    ['last-online-s1-e3', 'ep3_elevator', 409],
    ['last-online-s1-e3', 'ep3_end', 200],
  ] as const) {
    const deps = paymentDependencies(storeMock(order({ productId: 'episode-rewind:' + target, amount: 49 })));
    const getProgress = deps.repository.getProgress;
    deps.repository.getProgress = async (...args) => ({ ...(await getProgress(...args))!, episodeId: 'last-online-s1-e3', sceneId });
    const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() }, body: JSON.stringify({ episodeId: target }),
    }), deps);
    assert(response.status === wanted, `${target} from ${sceneId}: expected ${wanted}, got ${response.status}`);
  }
});

Deno.test('Episode 4 progress permits rewinding completed earlier episodes and its own completed chapter', async () => {
  for (const [target, sceneId, wanted] of [
    ['last-online-s1-e1', 'ep4_morning', 200],
    ['last-online-s1-e2', 'ep4_morning', 200],
    ['last-online-s1-e3', 'ep4_morning', 200],
    ['last-online-s1-e4', 'ep4_morning', 409],
    ['last-online-s1-e4', 'ep4_end', 200],
  ] as const) {
    const deps = paymentDependencies(storeMock(order({ productId: 'episode-rewind:' + target, amount: 49 })));
    const getProgress = deps.repository.getProgress;
    deps.repository.getProgress = async (...args) => ({ ...(await getProgress(...args))!, episodeId: 'last-online-s1-e4', sceneId });
    const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() }, body: JSON.stringify({ episodeId: target }),
    }), deps);
    assert(response.status === wanted, `${target} from ${sceneId}: expected ${wanted}, got ${response.status}`);
  }
});


Deno.test('Episode 5 progress permits rewinding its completed chapter from every ending', async () => {
  for (const [sceneId, wanted] of [
    ['ep5_morning', 409],
    ['ep5_end_junho', 200],
    ['ep5_end_taeyun', 200],
    ['ep5_end_self', 200],
  ] as const) {
    const target = 'last-online-s1-e5';
    const deps = paymentDependencies(storeMock(order({ productId: 'episode-rewind:' + target, amount: 49 })));
    const getProgress = deps.repository.getProgress;
    deps.repository.getProgress = async (...args) => ({ ...(await getProgress(...args))!, episodeId: target, sceneId });
    const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
      body: JSON.stringify({ episodeId: target }),
    }), deps);
    assert(response.status === wanted, `${target} from ${sceneId}: expected ${wanted}, got ${response.status}`);
  }
});

Deno.test('Black Roses completed episodes use the shared replay flow', async () => {
  const target = 'house-of-black-roses-s1-e1';
  let createdProduct = '';
  const store = storeMock(order({
    productId: 'episode-rewind:' + target,
    amount: 49,
    invoicePayload: 'lumi:episode-rewind:house-of-black-roses-s1-e1:rewind',
  }));
  store.createOrder = async (playerId, productId, amount) => {
    createdProduct = productId;
    return order({
      playerId,
      productId,
      amount,
      invoicePayload: 'lumi:' + productId + ':rewind',
    });
  };
  const deps = paymentDependencies(store);
  deps.repository = {
    ...deps.repository,
    async getProgress(playerId, storyId, seasonId) {
      assert(storyId === 'house-of-black-roses' && seasonId === 'season-1', 'rewind read wrong story scope');
      return {
        playerId,
        storyId,
        seasonId,
        episodeId: 'house-of-black-roses-s1-e2',
        sceneId: 'gothic_ep2_after_portrait',
        junhoScore: 2,
        taeyunScore: 0,
        truthScore: 4,
        riskScore: 2,
        flags: { gothic_gallery_choice: 'alone' },
        updatedAt: 'now',
      };
    },
  };

  const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ episodeId: target }),
  }), deps);
  const payload = await response.json();

  assert(response.status === 200, 'Black Roses rewind invoice failed');
  assert(payload.priceStars === 49 && payload.invoiceUrl, 'Black Roses rewind must use shared 49 Stars price');
  assert(createdProduct === 'episode-rewind:' + target, 'Black Roses rewind product was not scoped to its episode');
});

Deno.test('Black Roses episode 2 replay restores its trusted checkpoint', async () => {
  const target = 'house-of-black-roses-s1-e2';
  const store = storeMock(order({ productId: 'episode-rewind:' + target, amount: 49 }));
  const deps = paymentDependencies(store);
  deps.repository = {
    ...deps.repository,
    async getProgress(playerId, storyId, seasonId) {
      return {
        playerId,
        storyId,
        seasonId,
        episodeId: target,
        sceneId: 'gothic_ep2_end',
        junhoScore: 8,
        taeyunScore: 3,
        truthScore: 11,
        riskScore: 6,
        flags: { changed_inside_episode: true },
        updatedAt: 'now',
      };
    },
    async getEpisodeCheckpoint(playerId, storyId, seasonId, episodeId) {
      assert(storyId === 'house-of-black-roses' && seasonId === 'season-1', 'checkpoint read wrong story scope');
      assert(episodeId === target, 'checkpoint read wrong episode');
      return {
        playerId,
        storyId,
        seasonId,
        episodeId,
        sceneId: 'gothic_ep2_after_portrait',
        junhoScore: 2,
        taeyunScore: 0,
        truthScore: 4,
        riskScore: 2,
        flags: { gothic_gallery_choice: 'alone' },
        updatedAt: 'now',
      };
    },
  };

  const response = await handleCreateEpisodeRewindInvoice(new Request('https://example.test/payments/rewind/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ episodeId: target }),
  }), deps);
  assert(response.status === 200, 'completed Black Roses episode 2 must be replayable');
});

Deno.test('season invoice product is scoped to the selected story', async () => {
  const store = storeMock();
  let createdProduct = '';
  store.createOrder = async (playerId, productId, amount) => {
    createdProduct = productId;
    return order({
      playerId,
      productId,
      amount,
      invoicePayload: 'lumi:' + productId + ':scoped',
    });
  };
  const response = await handleCreateSeasonInvoice(new Request('https://example.test/payments/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ storyId: 'house-of-black-roses', seasonId: 'season-1' }),
  }), paymentDependencies(store));
  const payload = await response.json();
  assert(response.status === 200, 'scoped season invoice failed');
  assert(createdProduct === 'season:house-of-black-roses:season-1', 'season product was not scoped to the story');
  assert(payload.priceStars === 249 && payload.invoiceUrl, 'scoped invoice response is incomplete');
});


Deno.test('Black Roses pre-checkout requires the story-specific 249 Stars price', async () => {
  const blackRosesOrder = order({
    productId: 'season:house-of-black-roses:season-1',
    amount: 249,
    invoicePayload: 'lumi:season:house-of-black-roses:season-1:11111111-1111-4111-8111-111111111111',
  });
  const store = storeMock(blackRosesOrder);
  let approved: boolean | undefined;
  const deps: TelegramWebhookDependencies = {
    webhookSecret: 'secret',
    seasonPriceStars: 149,
    rewindPriceStars: 49,
    repository: paymentDependencies(store).repository,
    store,
    async answerPreCheckout(_id, ok) { approved = ok; },
    async sendMessage() {},
  };
  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': 'secret' };

  await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pre_checkout_query: {
      id: 'black-roses-good',
      from: { id: 555111 },
      currency: 'XTR',
      total_amount: 249,
      invoice_payload: blackRosesOrder.invoicePayload,
    } }),
  }), deps);
  assert(approved === true, '249 Stars Black Roses payment must be approved');

  approved = undefined;
  const freshStore = storeMock(order({ ...blackRosesOrder, id: '22222222-2222-4222-8222-222222222222', status: 'pending' }));
  deps.store = freshStore;
  await handleTelegramWebhook(new Request('https://example.test/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pre_checkout_query: {
      id: 'black-roses-old-price',
      from: { id: 555111 },
      currency: 'XTR',
      total_amount: 149,
      invoice_payload: blackRosesOrder.invoicePayload,
    } }),
  }), deps);
  assert(approved === false, 'old 149 Stars Black Roses price must be rejected');
});
