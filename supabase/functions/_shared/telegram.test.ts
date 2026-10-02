import { TelegramInitDataError, verifyTelegramInitData } from './telegram.ts';

const BOT_TOKEN = '123456789:test_token_for_lumi';
const NOW = 1_800_000_000;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = 'values differ'): void {
  if (actual !== expected) throw new Error(`${message}: ${String(actual)} !== ${String(expected)}`);
}

function keyArrayBuffer(key: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(key.byteLength);
  copy.set(key);
  return copy.buffer;
}

async function hmac(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyArrayBuffer(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

async function signedInitData(
  fields: Record<string, string>,
  botToken = BOT_TOKEN,
): Promise<string> {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const signature = await hmac(secretKey, dataCheckString);
  params.set('hash', [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}

Deno.test('verifyTelegramInitData accepts a correctly signed payload', async () => {
  const initData = await signedInitData({
    auth_date: String(NOW - 60),
    query_id: 'AAEAAAE',
    user: JSON.stringify({ id: 100200300, first_name: 'Лера', username: 'lera' }),
  });

  const user = await verifyTelegramInitData(initData, BOT_TOKEN, NOW);
  assertEquals(user.id, 100200300);
  assertEquals(user.firstName, 'Лера');
  assertEquals(user.username, 'lera');
  assertEquals(user.authDate, NOW - 60);
});

Deno.test('verifyTelegramInitData rejects a one-symbol user mutation', async () => {
  const signed = await signedInitData({
    auth_date: String(NOW - 60),
    user: JSON.stringify({ id: 100200300, first_name: 'Лера' }),
  });
  const params = new URLSearchParams(signed);
  params.set('user', JSON.stringify({ id: 100200300, first_name: 'Лера!' }));

  let error: unknown;
  try {
    await verifyTelegramInitData(params.toString(), BOT_TOKEN, NOW);
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof TelegramInitDataError, 'expected TelegramInitDataError');
  assertEquals(error.code, 'INVALID_SIGNATURE');
});

Deno.test('verifyTelegramInitData rejects an invalid hash', async () => {
  const signed = await signedInitData({
    auth_date: String(NOW - 60),
    user: JSON.stringify({ id: 100200300 }),
  });
  const params = new URLSearchParams(signed);
  params.set('hash', '00'.repeat(32));

  let error: unknown;
  try {
    await verifyTelegramInitData(params.toString(), BOT_TOKEN, NOW);
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof TelegramInitDataError, 'expected TelegramInitDataError');
  assertEquals(error.code, 'INVALID_SIGNATURE');
});

Deno.test('verifyTelegramInitData rejects auth_date older than 24 hours', async () => {
  const initData = await signedInitData({
    auth_date: String(NOW - 86_401),
    user: JSON.stringify({ id: 100200300 }),
  });

  let error: unknown;
  try {
    await verifyTelegramInitData(initData, BOT_TOKEN, NOW);
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof TelegramInitDataError, 'expected TelegramInitDataError');
  assertEquals(error.code, 'EXPIRED');
});

Deno.test('verifyTelegramInitData rejects a signed user without id', async () => {
  const initData = await signedInitData({
    auth_date: String(NOW - 60),
    user: JSON.stringify({ first_name: 'Лера' }),
  });

  let error: unknown;
  try {
    await verifyTelegramInitData(initData, BOT_TOKEN, NOW);
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof TelegramInitDataError, 'expected TelegramInitDataError');
  assertEquals(error.code, 'INVALID_USER');
});
