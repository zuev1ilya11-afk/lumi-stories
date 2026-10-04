import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EpisodeRecap } from './EpisodeRecap';

const mocks = vi.hoisted(() => ({ invoice: vi.fn(), status: vi.fn(), open: vi.fn() }));
vi.mock('../../api/client', () => ({ createEpisodeRewindInvoice: mocks.invoice, getEpisodeRewindStatus: mocks.status }));
vi.mock('../../analytics/events', () => ({ trackEvent: vi.fn() }));
vi.mock('../../telegram/telegram', () => ({ getTelegramContext: () => ({ initData: 'signed' }), openTelegramInvoice: mocks.open }));

it('personal free replay requires confirmation and applies without Telegram payment', async () => {
  mocks.invoice.mockResolvedValue({ episodeId: 'last-online-s1-e1', priceStars: 0, applied: true });
  mocks.status.mockResolvedValue({ episodeId: 'last-online-s1-e1', priceStars: 0, applied: true });
  const onRewindComplete = vi.fn();
  render(<EpisodeRecap episodeId="last-online-s1-e1" rewindPriceStars={0} onRewindComplete={onRewindComplete} onBack={vi.fn()} />);
  expect(mocks.invoice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Изменить события — бесплатно' }));
  expect(mocks.invoice).not.toHaveBeenCalled();
  expect(screen.getByText(/Прогресс всех следующих эпизодов будет сброшен/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Начать заново бесплатно' }));
  await waitFor(() => expect(onRewindComplete).toHaveBeenCalledWith('last-online-s1-e1'));
  expect(mocks.open).not.toHaveBeenCalled();
});


it('replays a completed Black Roses episode through the same Stars flow', async () => {
  mocks.invoice.mockResolvedValue({
    episodeId: 'house-of-black-roses-s1-e1',
    priceStars: 49,
    invoiceUrl: 'https://t.me/$rewind',
  });
  mocks.open.mockResolvedValue('paid');
  mocks.status.mockResolvedValue({
    episodeId: 'house-of-black-roses-s1-e1',
    priceStars: 49,
    applied: true,
  });
  const onRewindComplete = vi.fn();

  render(
    <EpisodeRecap
      episodeId="house-of-black-roses-s1-e1"
      rewindPriceStars={49}
      onRewindComplete={onRewindComplete}
      onBack={vi.fn()}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Наследница' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Изменить события — 49 ⭐' }));
  expect(screen.getByText(/Прогресс всех следующих эпизодов будет сброшен/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить за 49 ⭐' }));

  await waitFor(() => expect(onRewindComplete).toHaveBeenCalledWith('house-of-black-roses-s1-e1'));
  expect(mocks.invoice).toHaveBeenCalledWith('signed', 'house-of-black-roses-s1-e1');
  expect(mocks.open).toHaveBeenCalledWith('https://t.me/$rewind');
});
