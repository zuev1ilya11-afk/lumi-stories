import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrototypePaywall } from './PrototypePaywall';

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  createSeasonInvoice: vi.fn(),
  getPaymentStatus: vi.fn(),
  getTelegramContext: vi.fn(),
  openTelegramInvoice: vi.fn(),
}));

vi.mock('../../analytics/events', () => ({ trackEvent: mocks.trackEvent }));
vi.mock('../../api/client', () => ({
  createSeasonInvoice: mocks.createSeasonInvoice,
  getPaymentStatus: mocks.getPaymentStatus,
}));
vi.mock('../../telegram/telegram', () => ({
  getTelegramContext: mocks.getTelegramContext,
  openTelegramInvoice: mocks.openTelegramInvoice,
}));

describe('PrototypePaywall', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.getTelegramContext.mockReturnValue({ initData: 'signed' });
    mocks.createSeasonInvoice.mockResolvedValue({ season1Owned: false, priceStars: 149, invoiceUrl: 'https://t.me/$invoice' });
    mocks.getPaymentStatus.mockResolvedValue({ season1Owned: true, priceStars: 149 });
    mocks.openTelegramInvoice.mockResolvedValue('paid');
  });

  it('shows a real Telegram Stars offer', () => {
    render(<PrototypePaywall priceStars={149} />);
    expect(screen.getByText('149 ⭐', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Telegram Stars/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Купить за 149 ⭐' })).toBeInTheDocument();
  });

  it('opens Telegram invoice and unlocks only after server ownership is confirmed', async () => {
    const onPurchased = vi.fn();
    render(<PrototypePaywall priceStars={149} onPurchased={onPurchased} />);
    fireEvent.click(screen.getByRole('button', { name: 'Купить за 149 ⭐' }));
    await waitFor(() => expect(mocks.createSeasonInvoice).toHaveBeenCalledWith('signed', 'last-online', 'season-1'));
    expect(mocks.openTelegramInvoice).toHaveBeenCalledWith('https://t.me/$invoice');
    await waitFor(() => expect(mocks.getPaymentStatus).toHaveBeenCalledWith('signed', 'last-online', 'season-1'));
    await waitFor(() => expect(onPurchased).toHaveBeenCalledOnce());
  });

  it('does not unlock when the Telegram invoice is cancelled', async () => {
    mocks.openTelegramInvoice.mockResolvedValue('cancelled');
    const onPurchased = vi.fn();
    render(<PrototypePaywall onPurchased={onPurchased} />);
    fireEvent.click(screen.getByRole('button', { name: 'Купить за 149 ⭐' }));
    expect(await screen.findByText('Оплата отменена. Доступ не изменён.')).toBeVisible();
    expect(onPurchased).not.toHaveBeenCalled();
    expect(mocks.getPaymentStatus).not.toHaveBeenCalled();
  });
});
