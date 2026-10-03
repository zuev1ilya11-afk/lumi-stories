import { handleBootstrap, type BootstrapRepository } from './routes/bootstrap.ts';

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

async function validInitData(): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(NOW - 30),
    user: JSON.stringify({ id: 555111, first_name: 'Лера' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), BOT_TOKEN);
  const signature = await hmac(secretKey, dataCheckString);
  params.set('hash', [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

Deno.test('bootstrap returns 401 for invalid initData and does not call repository', async () => {
  let calls = 0;
  const repository: BootstrapRepository = {
    async bootstrapPlayer() {
      calls += 1;
      throw new Error('must not be called');
    },
  };
  const request = new Request('https://example.test/bootstrap', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': 'auth_date=1&hash=bad' },
  });

  const response = await handleBootstrap(request, { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 401, `expected 401, got ${response.status}`);
  assert(calls === 0, `repository called ${calls} times`);
});

Deno.test('bootstrap returns verified Telegram identity from repository', async () => {
  const repository: BootstrapRepository = {
    async bootstrapPlayer(user) {
      assert(user.id === 555111, 'repository received wrong Telegram id');
      return {
        playerId: 'player-1',
        telegramUserId: user.id,
        season1Owned: false,
        season1PriceStars: 149,
        progress: null,
      };
    },
  };
  const request = new Request('https://example.test/bootstrap', {
    method: 'POST',
    headers: { 'X-Telegram-Init-Data': await validInitData() },
  });

  const response = await handleBootstrap(request, { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const payload = await response.json();
  assert(payload.telegramUserId === 555111, 'wrong telegramUserId');
  assert(payload.playerId === 'player-1', 'wrong playerId');
  assert(payload.season1Owned === false, 'wrong ownership');
  assert(payload.season1PriceStars === 149, 'wrong Stars price');
});

import { handleProgress, type ProgressRepository } from './routes/progress.ts';

function createProgressRepository(): ProgressRepository & { saves: number } {
  let current: import('../_shared/repository.ts').Progress | null = null;
  return {
    saves: 0,
    async getOrCreatePlayer(telegramUserId) {
      return { id: `player-${telegramUserId}`, telegramUserId, season1Owned: false, createdAt: '2026-10-02T00:00:00.000Z' };
    },
    async getProgress() { return current; },
    async saveProgress(playerId, input) {
      this.saves += 1;
      current = { playerId, ...input, updatedAt: '2026-10-02T00:00:00.000Z' };
      return current;
    },
  };
}

Deno.test('progress GET returns null when player has no saved progress', async () => {
  const repository = createProgressRepository();
  const request = new Request('https://example.test/progress?storyId=last-online&seasonId=season-1', {
    headers: { 'X-Telegram-Init-Data': await validInitData() },
  });
  const response = await handleProgress(request, { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 200, `expected 200, got ${response.status}`);
  const payload = await response.json();
  assert(payload.progress === null, 'expected null progress');
});

Deno.test('progress PUT saves verified player progress and GET returns it', async () => {
  const repository = createProgressRepository();
  const initData = await validInitData();
  const input = {
    storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 'scene-2',
    junhoScore: 2, taeyunScore: 0, truthScore: 1, riskScore: 0, flags: { toldJunho: true },
  };
  const put = await handleProgress(new Request('https://example.test/progress', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData }, body: JSON.stringify(input),
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(put.status === 200, `expected PUT 200, got ${put.status}`);
  const putPayload = await put.json();
  assert(putPayload.progress.playerId === 'player-555111', 'handler did not derive player from verified Telegram id');

  const get = await handleProgress(new Request('https://example.test/progress?storyId=last-online&seasonId=season-1', {
    headers: { 'X-Telegram-Init-Data': initData },
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  const getPayload = await get.json();
  assert(getPayload.progress.sceneId === 'scene-2', 'GET did not return saved progress');
});

Deno.test('progress PUT rejects client-supplied player identity fields', async () => {
  const repository = createProgressRepository();
  const request = new Request('https://example.test/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({
      playerId: 'attacker-player', telegramUserId: 999, season1Owned: true,
      storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 'scene-2',
      junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {},
    }),
  });
  const response = await handleProgress(request, { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 400, `expected 400, got ${response.status}`);
  assert(repository.saves === 0, 'repository save was called for identity-tampering request');
});

Deno.test('progress rejects invalid Telegram initData before repository access', async () => {
  let calls = 0;
  const repository: ProgressRepository = {
    async getOrCreatePlayer() { calls += 1; throw new Error('must not be called'); },
    async getProgress() { calls += 1; return null; },
    async saveProgress() { calls += 1; throw new Error('must not be called'); },
  };
  const response = await handleProgress(new Request('https://example.test/progress?storyId=last-online&seasonId=season-1', {
    headers: { 'X-Telegram-Init-Data': 'auth_date=1&hash=bad' },
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 401, `expected 401, got ${response.status}`);
  assert(calls === 0, `repository called ${calls} times`);
});

import { handleAnalytics, type AnalyticsRepository } from './routes/analytics.ts';

function createAnalyticsRepository(): AnalyticsRepository & { events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  return {
    events,
    async getOrCreatePlayer(telegramUserId) {
      return { id: `player-${telegramUserId}`, telegramUserId, season1Owned: false, createdAt: '2026-10-02T00:00:00.000Z' };
    },
    async recordAnalytics(playerId, input) {
      events.push({ playerId, ...input });
    },
  };
}

Deno.test('analytics rejects invalid Telegram auth before repository access', async () => {
  let calls = 0;
  const repository: AnalyticsRepository = {
    async getOrCreatePlayer() { calls += 1; throw new Error('must not be called'); },
    async recordAnalytics() { calls += 1; },
  };
  const response = await handleAnalytics(new Request('https://example.test/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'auth_date=1&hash=bad' },
    body: JSON.stringify({ eventName: 'app_opened', metadata: {} }),
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 401, `expected 401, got ${response.status}`);
  assert(calls === 0, `repository called ${calls} times`);
});

Deno.test('analytics rejects unknown event and oversized metadata', async () => {
  const repository = createAnalyticsRepository();
  const initData = await validInitData();
  const unknown = await handleAnalytics(new Request('https://example.test/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
    body: JSON.stringify({ eventName: 'made_up', metadata: {} }),
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(unknown.status === 400, `expected unknown event 400, got ${unknown.status}`);
  const oversized = await handleAnalytics(new Request('https://example.test/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
    body: JSON.stringify({ eventName: 'scene_reached', metadata: { blob: 'x'.repeat(5000) } }),
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(oversized.status === 400, `expected oversized metadata 400, got ${oversized.status}`);
});

Deno.test('analytics derives player id from verified Telegram identity', async () => {
  const repository = createAnalyticsRepository();
  const response = await handleAnalytics(new Request('https://example.test/analytics', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': await validInitData() },
    body: JSON.stringify({ eventName: 'choice_selected', episodeId: 'ep1', sceneId: 'scene-1', metadata: { choiceId: 'hide' } }),
  }), { botToken: BOT_TOKEN, nowSeconds: NOW, repository });
  assert(response.status === 204, `expected 204, got ${response.status}`);
  assert(repository.events.length === 1, 'event not recorded');
  assert(repository.events[0]?.playerId === 'player-555111', 'player id was not derived server-side');
});


import { corsHeaders } from '../_shared/http.ts';

Deno.test('CORS allows progress PUT requests from the Mini App', () => {
  const methods = corsHeaders['Access-Control-Allow-Methods']
    .split(',')
    .map((method) => method.trim());
  assert(methods.includes('PUT'), 'CORS does not allow PUT progress saves');
});
