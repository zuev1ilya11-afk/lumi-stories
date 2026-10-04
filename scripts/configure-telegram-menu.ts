type TelegramBotApiResponse = { ok: boolean; description?: string };

export async function configureTelegramMenu(botToken: string, miniAppUrl: string): Promise<void> {
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');
  if (!miniAppUrl) throw new Error('LUMI_MINI_APP_URL_REQUIRED');

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Играть в LUMI',
        web_app: { url: miniAppUrl },
      },
    }),
  });

  const payload = (await response.json()) as TelegramBotApiResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(`TELEGRAM_MENU_CONFIGURATION_FAILED:${payload.description ?? response.status}`);
  }
}

declare const process:
  | { argv: string[]; env: Record<string, string | undefined>; exitCode?: number }
  | undefined;

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('configure-telegram-menu.ts')) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const miniAppUrl = process.env.LUMI_MINI_APP_URL ?? '';
  configureTelegramMenu(token, miniAppUrl).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
