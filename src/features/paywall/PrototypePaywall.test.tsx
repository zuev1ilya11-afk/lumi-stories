import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrototypePaywall } from './PrototypePaywall';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('../../analytics/events', () => ({ trackEvent }));

describe('PrototypePaywall', () => {
  it('explains the future season offer without pretending ruble payment works in Telegram', () => {
    render(<PrototypePaywall />);
    expect(screen.getByText('История только начинается')).toBeInTheDocument();
    expect(screen.getByText(/Следующие эпизоды/)).toBeInTheDocument();
    expect(screen.getByText('249 ₽', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/ориентир будущей цены/i)).toBeInTheDocument();
  });

  it('tracks click and does not unlock anything or invoke an invoice', () => {
    render(<PrototypePaywall />);
    fireEvent.click(screen.getByRole('button', { name: /Продолжить/i }));
    expect(trackEvent).toHaveBeenCalledWith('purchase_clicked', expect.any(Object));
    expect(screen.getByText('Покупка появится в полной версии')).toBeInTheDocument();
  });
});
