import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './events';

const { sendAnalytics, getTelegramContext } = vi.hoisted(() => ({
  sendAnalytics: vi.fn(),
  getTelegramContext: vi.fn(),
}));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client') as typeof import('../api/client');
  return { ...actual, sendAnalytics };
});
vi.mock('../telegram/telegram', async () => {
  const actual = await vi.importActual('../telegram/telegram') as typeof import('../telegram/telegram');
  return { ...actual, getTelegramContext };
});

describe('trackEvent', () => {
  beforeEach(() => {
    sendAnalytics.mockReset();
    getTelegramContext.mockReset();
    getTelegramContext.mockReturnValue({ initData: 'signed' });
    sendAnalytics.mockResolvedValue(undefined);
  });

  it('does not send unknown event names', async () => {
    await trackEvent('unknown_event' as never);
    expect(sendAnalytics).not.toHaveBeenCalled();
  });

  it('swallows transport failure so story reading continues', async () => {
    sendAnalytics.mockRejectedValue(new Error('offline'));
    await expect(trackEvent('scene_reached', { sceneId: 's1' })).resolves.toBeUndefined();
  });
});
