export const MAX_INIT_DATA_AGE_SECONDS = 86_400;

type TelegramInitDataErrorCode =
  | 'MISSING_HASH'
  | 'INVALID_SIGNATURE'
  | 'INVALID_AUTH_DATE'
  | 'EXPIRED'
  | 'INVALID_USER';

export class TelegramInitDataError extends Error {
  constructor(public readonly code: TelegramInitDataErrorCode, message: string) {
    super(message);
    this.name = 'TelegramInitDataError';
  }
}

export type VerifiedTelegramUser = {
  id: number;
  firstName?: string;
  username?: string;
  authDate: number;
};

const encoder = new TextEncoder();

async function hmacSha256(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
  return new Uint8Array(signature);
}

function parseHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function requireAuthDate(params: URLSearchParams, nowSeconds: number): number {
  const raw = params.get('auth_date');
  const authDate = raw === null ? Number.NaN : Number(raw);
  if (!Number.isSafeInteger(authDate) || authDate <= 0) {
    throw new TelegramInitDataError('INVALID_AUTH_DATE', 'Telegram auth_date is missing or invalid');
  }
  if (nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new TelegramInitDataError('EXPIRED', 'Telegram initData is older than 24 hours');
  }
  return authDate;
}

function requireUser(params: URLSearchParams, authDate: number): VerifiedTelegramUser {
  const raw = params.get('user');
  if (!raw) throw new TelegramInitDataError('INVALID_USER', 'Telegram user is missing');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TelegramInitDataError('INVALID_USER', 'Telegram user is invalid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new TelegramInitDataError('INVALID_USER', 'Telegram user is not an object');
  }

  const record = parsed as Record<string, unknown>;
  if (!Number.isSafeInteger(record.id) || Number(record.id) <= 0) {
    throw new TelegramInitDataError('INVALID_USER', 'Telegram user.id is missing or invalid');
  }

  return {
    id: Number(record.id),
    firstName: typeof record.first_name === 'string' ? record.first_name : undefined,
    username: typeof record.username === 'string' ? record.username : undefined,
    authDate,
  };
}

export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds: number,
): Promise<VerifiedTelegramUser> {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) {
    throw new TelegramInitDataError('MISSING_HASH', 'Telegram hash is missing');
  }

  const hashBytes = parseHex(receivedHash);
  if (!hashBytes) {
    throw new TelegramInitDataError('INVALID_SIGNATURE', 'Telegram hash has invalid format');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmacSha256(encoder.encode('WebAppData'), botToken);
  const expectedHash = await hmacSha256(secretKey, dataCheckString);
  if (!constantTimeEqual(hashBytes, expectedHash)) {
    throw new TelegramInitDataError('INVALID_SIGNATURE', 'Telegram initData signature is invalid');
  }

  const authDate = requireAuthDate(params, nowSeconds);
  return requireUser(params, authDate);
}
