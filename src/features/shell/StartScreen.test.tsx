import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StartScreen } from './StartScreen';

it('opens profile and settings from the bottom navigation', () => {
  render(<StartScreen onStart={vi.fn()} userDisplayName="Илья" hasProgress currentEpisodeId="last-online-s1-e2" season1PriceStars={149} />);

  fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
  expect(screen.getByRole('region', { name: 'Профиль' })).toBeVisible();
  expect(screen.getByText('Илья')).toBeVisible();
  expect(screen.getByText(/Эпизод 2/)).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  expect(screen.getByRole('region', { name: 'Настройки' })).toBeVisible();
  const motion = screen.getByRole('button', { name: /Анимации интерфейса/ });
  expect(motion).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(motion);
  expect(motion).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(screen.getByRole('button', { name: 'Истории' }));
  expect(screen.getByRole('button', { name: 'Продолжить историю' })).toBeVisible();
});
