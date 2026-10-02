export type TelegramUserDisplay = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramWebAppLike = {
  initData?: string;
  initDataUnsafe?: { user?: TelegramUserDisplay };
  ready?: () => void;
  expand?: () => void;
};

export type TelegramContext = {
  initData: string;
  userDisplayName?: string;
};

type DevelopmentMock = TelegramContext;

type ResolveTelegramOptions = {
  production: boolean;
  developmentMock?: DevelopmentMock;
};

export type TelegramContextErrorCode =
  | 'TELEGRAM_CONTEXT_REQUIRED'
  | 'TELEGRAM_DEV_CONTEXT_NOT_CONFIGURED';

export class TelegramContextError extends Error {
  readonly code: TelegramContextErrorCode;

  constructor(code: TelegramContextErrorCode) {
    super(code);
    this.name = 'TelegramContextError';
    this.code = code;
  }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppLike };
  }
}

function displayName(user?: TelegramUserDisplay): string | undefined {
  if (!user) return undefined;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return undefined;
}

export function resolveTelegramContext(
  webApp: TelegramWebAppLike | undefined,
  options: ResolveTelegramOptions,
): TelegramContext {
  const initData = webApp?.initData ?? '';
  if (initData) {
    return {
      initData,
      ...(displayName(webApp?.initDataUnsafe?.user)
        ? { userDisplayName: displayName(webApp?.initDataUnsafe?.user) }
        : {}),
    };
  }

  if (options.production) {
    throw new TelegramContextError('TELEGRAM_CONTEXT_REQUIRED');
  }

  if (options.developmentMock?.initData) {
    return { ...options.developmentMock };
  }

  throw new TelegramContextError('TELEGRAM_DEV_CONTEXT_NOT_CONFIGURED');
}

function viteEnv(): Record<string, unknown> {
  return ((import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {});
}

function explicitDevelopmentMock(): DevelopmentMock | undefined {
  const env = viteEnv();
  const initData = typeof env.VITE_LUMI_DEV_INIT_DATA === 'string' ? env.VITE_LUMI_DEV_INIT_DATA : '';
  if (!initData) return undefined;
  const userDisplayName =
    typeof env.VITE_LUMI_DEV_DISPLAY_NAME === 'string' && env.VITE_LUMI_DEV_DISPLAY_NAME
      ? env.VITE_LUMI_DEV_DISPLAY_NAME
      : undefined;
  return { initData, ...(userDisplayName ? { userDisplayName } : {}) };
}

export function getTelegramContext(
  options?: Partial<Pick<ResolveTelegramOptions, 'production' | 'developmentMock'>>,
): TelegramContext {
  const env = viteEnv();
  const production = options?.production ?? env.PROD === true;
  const developmentMock = options?.developmentMock ?? (!production ? explicitDevelopmentMock() : undefined);
  return resolveTelegramContext(window.Telegram?.WebApp, { production, developmentMock });
}

export function readyTelegramApp(webApp: TelegramWebAppLike | undefined = window.Telegram?.WebApp): void {
  webApp?.ready?.();
  webApp?.expand?.();
}
