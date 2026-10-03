import { sendAnalytics } from '../api/client';
import { getTelegramContext } from '../telegram/telegram';

export const ANALYTICS_EVENTS = [
  'app_opened',
  'episode_started',
  'scene_reached',
  'choice_selected',
  'episode_finished',
  'paywall_opened',
  'purchase_clicked',
  'replay_started',
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENTS[number];
const allowlist = new Set<string>(ANALYTICS_EVENTS);

export async function trackEvent(
  name: AnalyticsEventName,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!allowlist.has(name)) return;
  let initData: string;
  try {
    initData = getTelegramContext().initData;
  } catch {
    return;
  }

  const episodeId = typeof metadata.episodeId === 'string' ? metadata.episodeId : undefined;
  const sceneId = typeof metadata.sceneId === 'string' ? metadata.sceneId : undefined;
  try {
    await sendAnalytics(initData, { eventName: name, episodeId, sceneId, metadata });
  } catch {
    const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
    if (env?.DEV) console.debug('LUMI analytics unavailable');
  }
}
