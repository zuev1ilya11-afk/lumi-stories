import { corsHeaders, jsonResponse } from '../_shared/http.ts';
import {
  createRepository,
  createSupabaseRestDatabaseAdapter,
  readSupabaseServerSecret,
  type LumiRepository,
} from '../_shared/repository.ts';
import { handleAnalytics } from './routes/analytics.ts';
import { handleBootstrap } from './routes/bootstrap.ts';
import { handleProgress } from './routes/progress.ts';

const STORY_ID = 'last-online';
const SEASON_ID = 'season-1';
let cachedRepository: LumiRepository | null = null;

function runtimeRepository(): LumiRepository {
  if (cachedRepository) return cachedRepository;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = readSupabaseServerSecret((name) => Deno.env.get(name));
  if (!supabaseUrl || !secretKey) {
    throw new Error('Supabase server credentials are not configured');
  }

  cachedRepository = createRepository(
    createSupabaseRestDatabaseAdapter(supabaseUrl, secretKey),
  );
  return cachedRepository;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');

  if (url.pathname.endsWith('/health')) {
    return jsonResponse({
      ok: true,
      telegramConfigured: Boolean(botToken),
      databaseConfigured: Boolean(
        Deno.env.get('SUPABASE_URL') &&
          readSupabaseServerSecret((name) => Deno.env.get(name)),
      ),
    });
  }

  if (!botToken) {
    return jsonResponse({ error: 'SERVER_NOT_CONFIGURED' }, 500);
  }

  let repository: LumiRepository;
  try {
    repository = runtimeRepository();
  } catch {
    return jsonResponse({ error: 'SERVER_NOT_CONFIGURED' }, 500);
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
            season1Owned: player.season1Owned,
            progress,
          };
        },
      },
    });
  }

  if (url.pathname.endsWith('/progress')) {
    return handleProgress(request, { botToken, nowSeconds, repository });
  }

  if (url.pathname.endsWith('/analytics')) {
    return handleAnalytics(request, { botToken, nowSeconds, repository });
  }

  return jsonResponse({ error: 'NOT_FOUND' }, 404);
});
