import { playerAccess, SEASON_1_FREE } from '../_shared/access.ts';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';
import { createStarPaymentStore, type StarPaymentStore } from '../_shared/payments.ts';
import {
  createRepository,
  createSupabaseRestDatabaseAdapter,
  readSupabaseServerSecret,
  type LumiRepository,
} from '../_shared/repository.ts';
import {
  answerTelegramPreCheckout,
  createStarsInvoiceLink,
  deriveTelegramWebhookSecret,
  ensureTelegramPaymentsWebhook,
  sendTelegramMessage,
} from '../_shared/telegram-bot.ts';
import { handleAnalytics } from './routes/analytics.ts';
import { handleBootstrap } from './routes/bootstrap.ts';
import { handleCreateEpisodeRewindInvoice, handleCreateSeasonInvoice, handleEpisodeRewindStatus, handlePaymentStatus } from './routes/payments.ts';
import { handleProgress } from './routes/progress.ts';
import { handleTelegramWebhook } from './routes/telegram-webhook.ts';

const STORY_ID = 'last-online';
const SEASON_ID = 'season-1';
const SEASON_1_PRICE_STARS = 149;
const EPISODE_REWIND_PRICE_STARS = 49;
const ACCESS_POLICY = {
  seasonFree: SEASON_1_FREE,
  seasonPriceStars: SEASON_1_PRICE_STARS,
  rewindPriceStars: EPISODE_REWIND_PRICE_STARS,
};
let cachedRepository: LumiRepository | null = null;
let cachedPaymentStore: StarPaymentStore | null = null;

function runtimeCredentials(): { supabaseUrl: string; secretKey: string } {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = readSupabaseServerSecret((name) => Deno.env.get(name));
  if (!supabaseUrl || !secretKey) {
    throw new Error('Supabase server credentials are not configured');
  }
  return { supabaseUrl, secretKey };
}

function runtimeRepository(): LumiRepository {
  if (cachedRepository) return cachedRepository;
  const { supabaseUrl, secretKey } = runtimeCredentials();
  cachedRepository = createRepository(
    createSupabaseRestDatabaseAdapter(supabaseUrl, secretKey),
  );
  return cachedRepository;
}

function runtimePaymentStore(): StarPaymentStore {
  if (cachedPaymentStore) return cachedPaymentStore;
  const { supabaseUrl, secretKey } = runtimeCredentials();
  cachedPaymentStore = createStarPaymentStore(supabaseUrl, secretKey);
  return cachedPaymentStore;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (url.pathname.endsWith('/health')) {
    return jsonResponse({
      ok: true,
      telegramConfigured: Boolean(botToken),
      databaseConfigured: Boolean(
        supabaseUrl &&
          readSupabaseServerSecret((name) => Deno.env.get(name)),
      ),
      paymentsConfigured: Boolean(botToken && supabaseUrl),
      season1PriceStars: SEASON_1_FREE ? 0 : SEASON_1_PRICE_STARS,
      season1Free: SEASON_1_FREE,
      episodeRewindPriceStars: EPISODE_REWIND_PRICE_STARS,
    });
  }

  if (!botToken) {
    return jsonResponse({ error: 'SERVER_NOT_CONFIGURED' }, 500);
  }

  let repository: LumiRepository;
  let paymentStore: StarPaymentStore;
  try {
    repository = runtimeRepository();
    paymentStore = runtimePaymentStore();
  } catch {
    return jsonResponse({ error: 'SERVER_NOT_CONFIGURED' }, 500);
  }

  if (url.pathname.endsWith('/telegram/webhook')) {
    const webhookSecret = await deriveTelegramWebhookSecret(botToken);
    return handleTelegramWebhook(request, {
      webhookSecret,
      ...ACCESS_POLICY,
      repository,
      store: paymentStore,
      answerPreCheckout: (queryId, ok, errorMessage) =>
        answerTelegramPreCheckout(botToken, queryId, ok, errorMessage),
      sendMessage: (chatId, text) => sendTelegramMessage(botToken, chatId, text),
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (url.pathname.endsWith('/bootstrap')) {
    return handleBootstrap(request, {
      botToken,
      nowSeconds,
      repository: {
        async bootstrapPlayer(user) {
          const player = await repository.getOrCreatePlayer(user.id);
          const progress = await repository.getProgress(player.id, STORY_ID, SEASON_ID);
          return {
            playerId: player.id,
            telegramUserId: player.telegramUserId,
            ...playerAccess(player, ACCESS_POLICY),
            progress,
          };
        },
      },
    });
  }

  const paymentDependencies = {
    botToken,
    nowSeconds,
    ...ACCESS_POLICY,
    repository,
    store: paymentStore,
    telegram: {
      ensureWebhook: async () => {
        if (!supabaseUrl) throw new Error('SERVER_NOT_CONFIGURED');
        const webhookUrl = supabaseUrl.replace(/\/$/, '') + '/functions/v1/lumi-api/telegram/webhook';
        await ensureTelegramPaymentsWebhook(botToken, webhookUrl);
      },
      createInvoiceLink: (invoicePayload: string, priceStars: number) =>
        createStarsInvoiceLink(botToken, invoicePayload, priceStars),
    },
  };

  if (url.pathname.endsWith('/payments/invoice')) {
    return handleCreateSeasonInvoice(request, paymentDependencies);
  }

  if (url.pathname.endsWith('/payments/status')) {
    return handlePaymentStatus(request, paymentDependencies);
  }

  if (url.pathname.endsWith('/payments/rewind/invoice')) {
    return handleCreateEpisodeRewindInvoice(request, paymentDependencies);
  }

  if (url.pathname.endsWith('/payments/rewind/status')) {
    return handleEpisodeRewindStatus(request, paymentDependencies);
  }

  if (url.pathname.endsWith('/progress')) {
    return handleProgress(request, { botToken, nowSeconds, repository });
  }

  if (url.pathname.endsWith('/analytics')) {
    return handleAnalytics(request, { botToken, nowSeconds, repository });
  }

  return jsonResponse({ error: 'NOT_FOUND' }, 404);
});
