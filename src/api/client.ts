import {
  LumiApiError,
  type AnalyticsPayload,
  type BootstrapResponse,
  type EpisodeRewindInvoiceResponse,
  type EpisodeRewindStatusResponse,
  type PaymentInvoiceResponse,
  type PaymentStatusResponse,
  type ProgressDto,
} from './types';

export const STORY_ID = 'last-online';
export const SEASON_ID = 'season-1';

type ApiClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

type ProgressEnvelope = { progress: ProgressDto | null };

function normalizedRoot(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error('VITE_LUMI_API_URL is not configured');
  return trimmed.replace(/\/$/, '');
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `LUMI API ${response.status}`;
    try {
      const payload = await response.json() as { error?: unknown };
      if (typeof payload.error === 'string') message = payload.error;
    } catch {
      // Keep the status-based fallback.
    }
    throw new LumiApiError(response.status, message);
  }
  return await response.json() as T;
}

function telegramHeaders(initData: string, json = false): HeadersInit {
  const headers: Record<string, string> = { 'X-Telegram-Init-Data': initData };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

function saveBody(progress: ProgressDto): Omit<ProgressDto, 'updatedAt'> {
  return {
    storyId: progress.storyId,
    seasonId: progress.seasonId,
    episodeId: progress.episodeId,
    sceneId: progress.sceneId,
    junhoScore: progress.junhoScore,
    taeyunScore: progress.taeyunScore,
    truthScore: progress.truthScore,
    riskScore: progress.riskScore,
    flags: progress.flags,
  };
}

export function createApiClient({ baseUrl, fetcher = fetch }: ApiClientOptions) {
  const root = normalizedRoot(baseUrl);
  return {
    async bootstrap(initData: string): Promise<BootstrapResponse> {
      return parseJson<BootstrapResponse>(await fetcher(`${root}/bootstrap`, {
        method: 'POST',
        headers: telegramHeaders(initData),
      }));
    },

    async loadProgress(initData: string, storyId = STORY_ID, seasonId = SEASON_ID): Promise<ProgressDto | null> {
      const query = new URLSearchParams({ storyId, seasonId });
      const payload = await parseJson<ProgressEnvelope>(await fetcher(`${root}/progress?${query.toString()}`, {
        headers: telegramHeaders(initData),
      }));
      return payload.progress;
    },

    async saveProgress(initData: string, progress: ProgressDto): Promise<ProgressDto> {
      const payload = await parseJson<ProgressEnvelope>(await fetcher(`${root}/progress`, {
        method: 'PUT',
        headers: telegramHeaders(initData, true),
        body: JSON.stringify(saveBody(progress)),
      }));
      if (!payload.progress) throw new Error('LUMI API returned empty progress after save');
      return payload.progress;
    },

    async createSeasonInvoice(initData: string): Promise<PaymentInvoiceResponse> {
      return parseJson<PaymentInvoiceResponse>(await fetcher(`${root}/payments/invoice`, {
        method: 'POST',
        headers: telegramHeaders(initData),
      }));
    },

    async getPaymentStatus(initData: string): Promise<PaymentStatusResponse> {
      return parseJson<PaymentStatusResponse>(await fetcher(`${root}/payments/status`, {
        headers: telegramHeaders(initData),
      }));
    },

    async createEpisodeRewindInvoice(initData: string, episodeId: string): Promise<EpisodeRewindInvoiceResponse> {
      return parseJson<EpisodeRewindInvoiceResponse>(await fetcher(`${root}/payments/rewind/invoice`, {
        method: 'POST',
        headers: telegramHeaders(initData, true),
        body: JSON.stringify({ episodeId, allowFreeRewind: true }),
      }));
    },

    async getEpisodeRewindStatus(initData: string, episodeId: string): Promise<EpisodeRewindStatusResponse> {
      const query = new URLSearchParams({ episodeId });
      return parseJson<EpisodeRewindStatusResponse>(await fetcher(`${root}/payments/rewind/status?${query.toString()}`, {
        headers: telegramHeaders(initData),
      }));
    },

    async sendAnalytics(initData: string, event: AnalyticsPayload): Promise<void> {
      const response = await fetcher(`${root}/analytics`, {
        method: 'POST',
        headers: telegramHeaders(initData, true),
        body: JSON.stringify(event),
      });
      if (!response.ok) await parseJson<unknown>(response);
    },
  };
}

function configuredBaseUrl(): string {
  return import.meta.env.VITE_LUMI_API_URL ?? '';
}

export function bootstrap(initData: string): Promise<BootstrapResponse> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).bootstrap(initData);
}

export function loadProgress(initData: string, storyId = STORY_ID, seasonId = SEASON_ID): Promise<ProgressDto | null> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).loadProgress(initData, storyId, seasonId);
}

export function saveProgress(initData: string, progress: ProgressDto): Promise<ProgressDto> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).saveProgress(initData, progress);
}

export function createSeasonInvoice(initData: string): Promise<PaymentInvoiceResponse> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).createSeasonInvoice(initData);
}

export function getPaymentStatus(initData: string): Promise<PaymentStatusResponse> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).getPaymentStatus(initData);
}

export function createEpisodeRewindInvoice(initData: string, episodeId: string): Promise<EpisodeRewindInvoiceResponse> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).createEpisodeRewindInvoice(initData, episodeId);
}

export function getEpisodeRewindStatus(initData: string, episodeId: string): Promise<EpisodeRewindStatusResponse> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).getEpisodeRewindStatus(initData, episodeId);
}

export function sendAnalytics(initData: string, event: AnalyticsPayload): Promise<void> {
  return createApiClient({ baseUrl: configuredBaseUrl() }).sendAnalytics(initData, event);
}
