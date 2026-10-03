import { jsonResponse } from '../../_shared/http.ts';
import {
  verifyTelegramInitData,
  type VerifiedTelegramUser,
} from '../../_shared/telegram.ts';

export type BootstrapPayload = {
  playerId: string;
  telegramUserId: number;
  season1Owned: boolean;
  season1PriceStars: number;
  progress: unknown | null;
};

export interface BootstrapRepository {
  bootstrapPlayer(user: VerifiedTelegramUser): Promise<BootstrapPayload>;
}

export type BootstrapDependencies = {
  botToken: string;
  nowSeconds: number;
  repository: BootstrapRepository;
};

export async function handleBootstrap(
  request: Request,
  dependencies: BootstrapDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const initData = request.headers.get('X-Telegram-Init-Data') ?? '';
  let user: VerifiedTelegramUser;
  try {
    user = await verifyTelegramInitData(
      initData,
      dependencies.botToken,
      dependencies.nowSeconds,
    );
  } catch {
    return jsonResponse({ error: 'UNAUTHORIZED' }, 401);
  }

  const payload = await dependencies.repository.bootstrapPlayer(user);
  return jsonResponse(payload);
}
