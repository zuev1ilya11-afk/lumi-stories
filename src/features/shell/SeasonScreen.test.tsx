import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SeasonScreen } from './SeasonScreen';

it('marks episode 2 current after transition and lets the completed episode be replayed', () => {
  const onPlay = vi.fn();
  const onSelectEpisode = vi.fn();
  render(<SeasonScreen hasProgress currentEpisodeId="last-online-s1-e2" onPlay={onPlay} onSelectEpisode={onSelectEpisode} onBack={vi.fn()} />);
  expect(within(screen.getByText('Номер, который не должен отвечать').closest('article')!).getByText('Завершён · Пройти снова')).toBeVisible();
  expect(within(screen.getByText('Тот, кого все знают').closest('article')!).getByText('Текущий эпизод')).toBeVisible();
  expect(screen.getAllByText('В разработке')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Эпизод 1: Номер, который не должен отвечать. Пройти снова' }));
  expect(onSelectEpisode).toHaveBeenCalledExactlyOnceWith('last-online-s1-e1');
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(onPlay).toHaveBeenCalledTimes(1);
});

it('makes episode 2 available at the end of episode 1', () => {
  render(<SeasonScreen hasProgress episodeCompleted currentEpisodeId="last-online-s1-e1" onPlay={vi.fn()} onBack={vi.fn()} />);
  expect(within(screen.getByText('Тот, кого все знают').closest('article')!).getByText('149 ⭐')).toBeVisible();
});
