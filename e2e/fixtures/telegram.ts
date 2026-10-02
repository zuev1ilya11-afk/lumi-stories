import type { Page, Route } from '@playwright/test';
import type { ProgressDto } from '../../src/api/types';

export const TEST_BOT_TOKEN = '123456789:lumi_e2e_test_token';

export type MockApiStore = {
  progress: ProgressDto | null;
  analytics: string[];
  failNextSave: boolean;
};

export function createMockApiStore(): MockApiStore {
  return { progress: null, analytics: [], failNextSave: false };
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

export async function signTelegramInitData(userId = 555111, nowSeconds = 1_800_000_000): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(nowSeconds - 30),
    user: JSON.stringify({ id: userId, first_name: 'Лера', username: `lumi_${userId}` }),
  });
  const check = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), TEST_BOT_TOKEN);
  const hash = await hmac(secret, check);
  params.set('hash', [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

export async function installTelegram(page: Page, initData: string, userId = 555111): Promise<void> {
  page.on('console', (message) => console.log('LUMI_BROWSER_CONSOLE', message.type(), message.text()));
  page.on('pageerror', (error) => console.log('LUMI_BROWSER_PAGEERROR', error.message, error.stack ?? ''));
  await page.addInitScript(({ signed, id }: { signed: string; id: number }) => {
    window.Telegram = {
      WebApp: {
        initData: signed,
        initDataUnsafe: { user: { id, first_name: 'Лера', username: `lumi_${id}` } },
        ready() {},
        expand() {},
      },
    };
  }, { signed: initData, id: userId });
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Content-Type': 'application/json',
};

function userIdFromRoute(route: Route): number {
  const header = route.request().headers()['x-telegram-init-data'] ?? '';
  const encoded = new URLSearchParams(header).get('user');
  if (!encoded) return 0;
  return Number((JSON.parse(encoded) as { id?: unknown }).id ?? 0);
}

export async function installMockLumiApi(page: Page, store: MockApiStore): Promise<void> {
  page.on('request', (request) => {
    if (request.url().includes('lumi')) console.log('LUMI_E2E_REQUEST', request.method(), request.url());
  });
  await page.route('http://lumi.test/**', async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors, body: '' });
      return;
    }
    const url = new URL(request.url());
    const userId = userIdFromRoute(route);

    if (url.pathname.endsWith('/bootstrap')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({
        playerId: `player-${userId}`, telegramUserId: userId, season1Owned: false, progress: store.progress,
      }) });
      return;
    }

    if (url.pathname.endsWith('/progress') && request.method() === 'PUT') {
      if (store.failNextSave) {
        store.failNextSave = false;
        await route.fulfill({ status: 503, headers: cors, body: JSON.stringify({ error: 'TEMPORARY_FAILURE' }) });
        return;
      }
      const body = request.postDataJSON() as ProgressDto;
      store.progress = { ...body, updatedAt: '2026-10-02T20:00:00.000Z' };
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ progress: store.progress }) });
      return;
    }

    if (url.pathname.endsWith('/progress')) {
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ progress: store.progress }) });
      return;
    }

    if (url.pathname.endsWith('/analytics')) {
      const body = request.postDataJSON() as { eventName?: string };
      if (body.eventName) store.analytics.push(body.eventName);
      await route.fulfill({ status: 204, headers: cors, body: '' });
      return;
    }

    await route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });
}
