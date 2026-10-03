import { describe, expect, it, vi } from 'vitest';
import {
  TelegramContextError,
  getTelegramContext,
  openTelegramInvoice,
  readyTelegramApp,
  resolveTelegramContext,
} from './telegram';

describe('Telegram adapter', () => {
  it('returns the exact initData string from Telegram SDK', () => {
    const result = resolveTelegramContext(
      {
        initData: 'query_id=abc&user=%7B%22id%22%3A42%7D&hash=signed',
        initDataUnsafe: { user: { id: 42, first_name: 'Лера' } },
      },
      { production: true },
    );

    expect(result.initData).toBe('query_id=abc&user=%7B%22id%22%3A42%7D&hash=signed');
    expect(result.userDisplayName).toBe('Лера');
    expect(result).not.toHaveProperty('userId');
  });

  it('uses unsafe user data only for the display name', () => {
    const result = resolveTelegramContext(
      {
        initData: 'signed-payload',
        initDataUnsafe: { user: { id: 777, first_name: 'Анна', last_name: 'Ким' } },
      },
      { production: true },
    );

    expect(result).toEqual({ initData: 'signed-payload', userDisplayName: 'Анна Ким' });
  });

  it('throws TELEGRAM_CONTEXT_REQUIRED in production without initData', () => {
    expect(() => resolveTelegramContext(undefined, { production: true })).toThrowError(
      expect.objectContaining({ code: 'TELEGRAM_CONTEXT_REQUIRED' }),
    );
  });

  it('allows only an explicit development mock outside production', () => {
    expect(
      resolveTelegramContext(undefined, {
        production: false,
        developmentMock: { initData: 'explicit-dev-init-data', userDisplayName: 'Dev' },
      }),
    ).toEqual({ initData: 'explicit-dev-init-data', userDisplayName: 'Dev' });
  });

  it('signals ready and expand when Telegram WebApp exists', () => {
    const ready = vi.fn();
    const expand = vi.fn();
    readyTelegramApp({ ready, expand });
    expect(ready).toHaveBeenCalledOnce();
    expect(expand).toHaveBeenCalledOnce();
  });

  it('opens a Telegram invoice and resolves its payment status', async () => {
    const openInvoice = vi.fn((_url: string, callback?: (status: 'paid') => void) => callback?.('paid'));
    await expect(openTelegramInvoice('https://t.me/$invoice', { openInvoice })).resolves.toBe('paid');
    expect(openInvoice).toHaveBeenCalledWith('https://t.me/$invoice', expect.any(Function));
  });

  it('exposes a typed TelegramContextError', () => {
    const error = new TelegramContextError('TELEGRAM_CONTEXT_REQUIRED');
    expect(error.code).toBe('TELEGRAM_CONTEXT_REQUIRED');
  });

  it('getTelegramContext reads from window.Telegram.WebApp', () => {
    vi.stubGlobal('window', {
      Telegram: {
        WebApp: {
          initData: 'exact-window-init-data',
          initDataUnsafe: { user: { id: 9, username: 'lumi_reader' } },
          ready: vi.fn(),
          expand: vi.fn(),
        },
      },
    });

    expect(getTelegramContext({ production: true })).toEqual({
      initData: 'exact-window-init-data',
      userDisplayName: '@lumi_reader',
    });
  });
});
