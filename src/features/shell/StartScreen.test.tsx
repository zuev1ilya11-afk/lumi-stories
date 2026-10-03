import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { StartScreen } from './StartScreen';
import { STORY_CATALOG } from '../../story/catalog';

beforeEach(() => sessionStorage.clear());

it('keeps interface settings after leaving and reopening the menu', () => {
  const first = render(<StartScreen onStart={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  fireEvent.click(screen.getByRole('button', { name: /Анимации интерфейса/ }));
  fireEvent.click(screen.getByRole('button', { name: /Тактильная отдача/ }));
  first.unmount();
  render(<StartScreen onStart={vi.fn()} />);
  expect(screen.getByRole('main')).toHaveClass('is-calm');
  fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
  expect(screen.getByRole('button', { name: /Анимации интерфейса/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: /Тактильная отдача/ })).toHaveAttribute('aria-pressed', 'false');
});

it.each([true, false])('keeps settings when session writes fail (reads also blocked: %s)', (blockReads) => {
  const read = blockReads ? vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); }) : undefined;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    const first = render(<StartScreen onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    fireEvent.click(screen.getByRole('button', { name: /Анимации интерфейса/ }));
    fireEvent.click(screen.getByRole('button', { name: /Тактильная отдача/ }));
    first.unmount();
    render(<StartScreen onStart={vi.fn()} />);
    expect(screen.getByRole('main')).toHaveClass('is-calm');
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(screen.getByRole('button', { name: /Тактильная отдача/ })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    read?.mockRestore(); write.mockRestore();
    for (const name of [/Анимации интерфейса/, /Тактильная отдача/]) {
      const button = screen.queryByRole('button', { name });
      if (button?.getAttribute('aria-pressed') === 'false') fireEvent.click(button);
    }
  }
});

it('returns from each tab to the home CTA without starting a story', () => {
  const onStart = vi.fn();
  render(<StartScreen onStart={onStart} />);
  for (const name of ['Истории', 'Профиль', 'Настройки']) {
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'На главный экран' }));
    expect(screen.getByRole('button', { name: 'Начать историю' })).toBeVisible();
  }
  expect(onStart).not.toHaveBeenCalled();
});

it('passes the selected story identity and blocks unavailable stories', () => {
  const onOpenStory = vi.fn();
  const onStart = vi.fn();
  const roses = STORY_CATALOG[1];
  const { rerender } = render(<StartScreen onStart={onStart} onOpenStory={onOpenStory} />);
  fireEvent.click(screen.getByRole('button', { name: 'Истории' }));
  fireEvent.click(screen.getByRole('button', { name: 'Открыть историю «Последний онлайн»' }));
  fireEvent.click(screen.getByRole('button', { name: 'Открыть историю «Дом чёрных роз»' }));
  expect(onOpenStory.mock.calls).toEqual([['last-online'], ['house-of-black-roses']]);
  try {
    roses.available = false;
    rerender(<StartScreen onStart={onStart} onOpenStory={onOpenStory} />);
    const coming = screen.getByRole('button', { name: 'История «Дом чёрных роз» скоро' });
    expect(coming).toBeDisabled();
    fireEvent.click(coming);
    expect(onOpenStory).toHaveBeenCalledTimes(2);
    expect(onStart).not.toHaveBeenCalled();
  } finally { roses.available = true; }
});

it('starts or continues from home and profile using the supplied progress', () => {
  const onStart = vi.fn();
  const { rerender } = render(<StartScreen onStart={onStart} />);
  fireEvent.click(screen.getByRole('button', { name: 'Начать историю' }));
  rerender(<StartScreen onStart={onStart} hasProgress currentStoryId="house-of-black-roses" currentEpisodeId="house-of-black-roses-s1-e1" season1PriceStars={0} />);
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить историю' }));
  fireEvent.click(screen.getByRole('button', { name: 'Профиль' }));
  expect(screen.getByText('Дом чёрных роз')).toBeVisible();
  expect(screen.getByText('Эпизод 1 · в процессе')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить историю' }));
  expect(onStart).toHaveBeenCalledTimes(3);
});

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
