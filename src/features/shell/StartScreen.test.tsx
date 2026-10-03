import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StartScreen } from './StartScreen';

it('describes the free first season without claiming a purchase', () => {
  render(<StartScreen onStart={vi.fn()} season1Owned season1PriceStars={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
  expect(screen.getByText('Эпизоды 1–5 бесплатно')).toBeVisible();
  expect(screen.queryByText('Покупка подтверждена')).not.toBeInTheDocument();
});

it('opens the story catalog, profile and settings from the bottom navigation', () => {
  const onStart = vi.fn();
  render(<StartScreen onStart={onStart} userDisplayName="Илья" hasProgress currentEpisodeId="last-online-s1-e2" season1PriceStars={149} />);

  expect(screen.getByRole('button', { name: 'Продолжить историю' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Истории' }));
  expect(screen.getByRole('region', { name: 'Истории' })).toBeVisible();
  expect(screen.getByText('Последний онлайн')).toBeVisible();
  const currentStory = screen.getByRole('button', { name: 'Открыть историю «Последний онлайн»' });
  expect(currentStory).toBeVisible();
  fireEvent.click(currentStory);
  expect(onStart).toHaveBeenCalledTimes(1);

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
  expect(screen.getByRole('region', { name: 'Истории' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Открыть историю «Последний онлайн»' })).toBeVisible();
});
