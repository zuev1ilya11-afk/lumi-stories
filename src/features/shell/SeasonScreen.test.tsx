import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SeasonScreen } from './SeasonScreen';

it('marks episode 2 current and opens a recap for the completed episode', () => {
  const onPlay = vi.fn();
  const onOpenRecap = vi.fn();
  render(<SeasonScreen hasProgress currentEpisodeId="last-online-s1-e2" onPlay={onPlay} onOpenRecap={onOpenRecap} onBack={vi.fn()} />);
  expect(within(screen.getByText('Номер, который не должен отвечать').closest('article')!).getByText('Завершён · Краткая сводка')).toBeVisible();
  expect(within(screen.getByText('Тот, кого все знают').closest('article')!).getByText('Текущий эпизод')).toBeVisible();
  expect(screen.queryByText('В разработке')).toBeNull();
  expect(within(screen.getByText('Последний онлайн').closest('article')!).getByText('После Эпизода 4')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Эпизод 1: Номер, который не должен отвечать. Краткая сводка' }));
  expect(onOpenRecap).toHaveBeenCalledExactlyOnceWith('last-online-s1-e1');
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(onPlay).toHaveBeenCalledTimes(1);
});
it('makes episode 2 available at the end of episode 1', () => {
  render(<SeasonScreen hasProgress episodeCompleted currentEpisodeId="last-online-s1-e1" onPlay={vi.fn()} onBack={vi.fn()} />);
  expect(within(screen.getByText('Тот, кого все знают').closest('article')!).getByText('149 ⭐')).toBeVisible();
});

it('tracks Episode 3 and exposes only completed recaps and unlocks Episode 4 after completion', () => {
  const onOpenRecap = vi.fn();
  const { rerender } = render(<SeasonScreen hasProgress currentEpisodeId="last-online-s1-e3" season1Owned onPlay={vi.fn()} onOpenRecap={onOpenRecap} onBack={vi.fn()} />);
  expect(within(screen.getByText('Все лгут').closest('article')!).getByText('Текущий эпизод')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Эпизод 2:.*Краткая сводка/ }));
  expect(onOpenRecap).toHaveBeenCalledWith('last-online-s1-e2');
  expect(screen.queryByRole('button', { name: /Эпизод 3:.*Краткая сводка/ })).toBeNull();
  rerender(<SeasonScreen hasProgress episodeCompleted currentEpisodeId="last-online-s1-e3" season1Owned onPlay={vi.fn()} onOpenRecap={onOpenRecap} onBack={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Эпизод 3:.*Краткая сводка/ }));
  expect(onOpenRecap).toHaveBeenLastCalledWith('last-online-s1-e3');
  expect(within(screen.getByText('Ночь исчезновения').closest('article')!).getByText('Доступно')).toBeVisible();
});
