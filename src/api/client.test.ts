import { test } from 'vitest';
import { createApiClient } from './client';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

test('api client sends Telegram initData on bootstrap progress load and save', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const isBootstrap = String(input).endsWith('/bootstrap');
    const payload = isBootstrap
      ? { playerId: 'p1', telegramUserId: 1, season1Owned: false, progress: null }
      : init?.method === 'PUT'
        ? { progress: JSON.parse(String(init.body)) }
        : { progress: null };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const api = createApiClient({ baseUrl: 'https://api.example.test', fetcher });
  await api.bootstrap('signed-init');
  await api.loadProgress('signed-init');
  await api.saveProgress('signed-init', {
    storyId: 'last-online', seasonId: 'season-1', episodeId: 'ep1', sceneId: 's1',
    junhoScore: 0, taeyunScore: 0, truthScore: 0, riskScore: 0, flags: {}, updatedAt: 'ignored-by-save',
  });
  assert(calls.length === 3, `expected 3 calls, got ${calls.length}`);
  for (const call of calls) {
    assert(new Headers(call.init?.headers).get('X-Telegram-Init-Data') === 'signed-init', 'missing Telegram initData header');
  }
  assert(calls[0].init?.method === 'POST', 'bootstrap must POST');
  assert(calls[1].url.includes('storyId=last-online') && calls[1].url.includes('seasonId=season-1'), 'loadProgress missing story/season');
  const saveBody = JSON.parse(String(calls[2].init?.body));
  assert(saveBody.updatedAt === undefined && saveBody.playerId === undefined, 'save request leaked server-owned fields');
});
