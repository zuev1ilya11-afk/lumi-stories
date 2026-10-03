export type ProgressDto = {
  storyId: string;
  seasonId: string;
  episodeId: string;
  sceneId: string;
  junhoScore: number;
  taeyunScore: number;
  truthScore: number;
  riskScore: number;
  flags: Record<string, unknown>;
  updatedAt?: string;
};

export type BootstrapResponse = {
  playerId: string;
  telegramUserId: number;
  season1Owned: boolean;
  season1PriceStars?: number;
  episodeRewindPriceStars?: number;
  progress: ProgressDto | null;
};

export type PaymentInvoiceResponse = {
  season1Owned: boolean;
  priceStars: number;
  invoiceUrl?: string;
};

export type PaymentStatusResponse = {
  season1Owned: boolean;
  priceStars: number;
  episodeRewindPriceStars?: number;
};

export type EpisodeRewindInvoiceResponse = {
  episodeId: string;
  priceStars: number;
  invoiceUrl?: string;
  applied?: boolean;
};

export type EpisodeRewindStatusResponse = {
  episodeId: string;
  priceStars: number;
  applied: boolean;
};

export class LumiApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'LumiApiError';
  }
}

export type AnalyticsPayload = {
  eventName: string;
  episodeId?: string;
  sceneId?: string;
  metadata?: Record<string, unknown>;
};
