import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProgressDto } from './api/types';
import { App } from './App';

const { bootstrap, saveProgress } = vi.hoisted(() => ({ bootstrap: vi.fn(), saveProgress: vi.fn() }));
vi.mock('./api/client', async () => ({ ...await vi.importActual('./api/client'), bootstrap, saveProgress, sendAnalytics: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => { delete window.Telegram; vi.unstubAllGlobals(); bootstrap.mockReset(); saveProgress.mockReset(); });

const saved: ProgressDto = { storyId: 'last-online', seasonId: 'season-1', episodeId: 'last-online-s1-e1', sceneId: 'ep1_end_paywall', junhoScore: 4, taeyunScore: 1, truthScore: 2, riskScore: 3, flags: { clue: true } };
function connected(progress: ProgressDto, season1Owned = false) {
  window.Telegram = { WebApp: { initData: 'signed' } };
  bootstrap.mockResolvedValue({ playerId: 'p1', telegramUserId: 42, season1Owned, season1PriceStars: 149, progress });
}

it('renders the LUMI shell', () => {
  render(<App production={false} />);
  expect(screen.getByText('LUMI')).toBeInTheDocument();
});

it('asks the user to open LUMI from Telegram in production without initData', () => {
  render(<App production />);
  expect(screen.getByText('Откройте LUMI из Telegram')).toBeInTheDocument();
});

it('renders a usable retry when bootstrap contains an unknown episode', async () => {
  connected({ ...saved, episodeId: 'unknown' });
  render(<App production />);
  await screen.findByText('Не удалось загрузить историю.');
  bootstrap.mockResolvedValue({ playerId: 'p1', telegramUserId: 42, season1Owned: false, progress: saved });
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await screen.findByRole('button', { name: /(?:Начать|Продолжить) историю/ });
  expect(bootstrap).toHaveBeenCalledTimes(2);
});

it('opens the saved episode 2 and returns from the menu without resetting it', async () => {
  connected({ ...saved, episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' });
  render(<App production />);
  fireEvent.click(await screen.findByRole('button', { name: /(?:Начать|Продолжить) историю/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByTestId('story-stage')).toHaveAttribute('data-scene-id', 'ep2_morning');
  expect(screen.getByText('Тот, кого все знают')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
  expect(screen.getByText('Текущий эпизод')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByTestId('story-stage')).toHaveAttribute('data-scene-id', 'ep2_morning');
  expect(saveProgress).not.toHaveBeenCalled();
});

it('keeps episode 2 behind Stars when the server says the season is not owned', async () => {
  connected(saved, false);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  render(<App production />);
  fireEvent.click(await screen.findByRole('button', { name: /(?:Начать|Продолжить) историю/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  for (let i = 0; i < 30 && !screen.queryByRole('button', { name: 'Купить за 149 ⭐' }); i += 1) fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByRole('button', { name: 'Купить за 149 ⭐' })).toBeVisible();
  expect(saveProgress).not.toHaveBeenCalled();
});

it('continues from the episode 1 terminal into episode 2 without resetting saved state', async () => {
  connected(saved, true);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  saveProgress.mockImplementation(async (_init: string, dto: ProgressDto) => dto);
  render(<App production />);
  fireEvent.click(await screen.findByRole('button', { name: /(?:Начать|Продолжить) историю/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  for (let i = 0; i < 30 && !screen.queryByRole('button', { name: 'Продолжить — Эпизод 2' }); i += 1) fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(saveProgress).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить — Эпизод 2' }));
  await waitFor(() => expect(screen.getByTestId('story-stage')).toHaveAttribute('data-scene-id', 'ep2_morning'));
  expect(saveProgress).toHaveBeenCalledExactlyOnceWith('signed', { ...saved, episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' });
});

it('opens a read-only episode 1 recap without changing saved episode 2 progress', async () => {
  connected({ ...saved, episodeId: 'last-online-s1-e2', sceneId: 'ep2_morning' }, true);
  render(<App production />);
  fireEvent.click(await screen.findByRole('button', { name: /(?:Начать|Продолжить) историю/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Эпизод 1: Номер, который не должен отвечать. Краткая сводка' }));

  expect(screen.getByRole('heading', { name: 'Номер, который не должен отвечать' })).toBeVisible();
  expect(screen.getByText(/аккаунт исчезнувшей Юн Соа/)).toBeVisible();
  expect(screen.queryByTestId('story-stage')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Рассказать|Ответить|Скрыть|Пройти снова/ })).not.toBeInTheDocument();
  expect(saveProgress).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Назад к эпизодам' }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByTestId('story-stage')).toHaveAttribute('data-scene-id', 'ep2_morning');
  expect(saveProgress).not.toHaveBeenCalled();
});
