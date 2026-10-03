import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Episode, StoryState } from '../../story/schema';
import { StoryScreen } from './StoryScreen';

const state: StoryState = {
  junhoScore: 0,
  taeyunScore: 0,
  truthScore: 0,
  riskScore: 0,
  flags: {},
};

const episode: Episode = {
  id: 'episode-test',
  title: 'Тестовый эпизод',
  startSceneId: 'dialogue',
  scenes: [
    {
      id: 'dialogue',
      kind: 'dialogue',
      speaker: 'Кан Джунхо',
      text: 'Ты ведь что-то от меня скрываешь?',
      background: 'apartment_hall_night',
      character: 'junho-guarded',
      nextSceneId: 'choice',
    },
    {
      id: 'choice',
      kind: 'dialogue',
      speaker: 'Лера',
      text: 'Что ответить?',
      background: 'apartment_hall_night',
      choices: [
        { id: 'open', text: 'Рассказать правду', nextSceneId: 'dialogue' },
        {
          id: 'locked',
          text: 'Показать улику',
          nextSceneId: 'dialogue',
          conditions: [{ kind: 'flagEquals', flag: 'has_clue', value: true }],
        },
      ],
    },
  ],
};

describe('StoryScreen', () => {
  it('renders dialogue speaker, text and background asset', () => {
    render(
      <StoryScreen episode={episode} sceneId="dialogue" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByText('Кан Джунхо')).toBeInTheDocument();
    expect(screen.getByText('Ты ведь что-то от меня скрываешь?')).toBeInTheDocument();
    expect(screen.getByTestId('story-stage').querySelector('.lumi-story__backdrop')).toHaveAttribute('src', '/assets/last-online/backgrounds/apartment_hall_night.webp');
  });

  it('renders only available choices', () => {
    render(<StoryScreen episode={episode} sceneId="choice" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    expect(screen.getByRole('button', { name: 'Рассказать правду' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Показать улику' })).not.toBeInTheDocument();
  });

  it('disables choice buttons while async choose is pending and ignores repeated click', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const onChoose = vi.fn(() => pending);
    render(<StoryScreen episode={episode} sceneId="choice" state={state} onChoose={onChoose} onAdvance={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    const button = screen.getByRole('button', { name: 'Рассказать правду' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    release();
  });
});

it('continues a completed episode only once while its save is pending', async () => {
  const terminal: Episode = { id: 'last-online-s1-e1', title: 'One', startSceneId: 'end', scenes: [{ id: 'end', kind: 'terminal', text: 'Конец' }] };
  const second: Episode = { ...terminal, id: 'last-online-s1-e2', title: 'Two' };
  let release!: () => void;
  const onNextEpisode = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
  const onAdvance = vi.fn();
  render(<StoryScreen episode={terminal} nextEpisode={second} sceneId="end" state={state} onChoose={vi.fn()} onAdvance={onAdvance} onNextEpisode={onNextEpisode} season1Owned />);
  expect(screen.queryByRole('button', { name: 'Продолжить — Эпизод 2' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  const next = screen.getByRole('button', { name: 'Продолжить — Эпизод 2' });
  fireEvent.click(next);
  fireEvent.click(next);
  expect(next).toBeDisabled();
  expect(onNextEpisode).toHaveBeenCalledTimes(1);
  expect(onAdvance).not.toHaveBeenCalled();
  await act(async () => release());
});

it('shows the Stars paywall instead of entering episode 2 for an unpaid player', () => {
  const terminal: Episode = { id: 'last-online-s1-e1', title: 'One', startSceneId: 'end', scenes: [{ id: 'end', kind: 'terminal', text: 'Конец' }] };
  const second: Episode = { ...terminal, id: 'last-online-s1-e2', title: 'Two' };
  render(<StoryScreen episode={terminal} nextEpisode={second} sceneId="end" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} onNextEpisode={vi.fn()} season1PriceStars={149} />);
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByRole('button', { name: 'Купить за 149 ⭐' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Продолжить — Эпизод 2' })).not.toBeInTheDocument();
});

it('finishes episode 2 with development notice and a return to season', () => {
  const terminal: Episode = { id: 'last-online-s1-e2', title: 'Two', startSceneId: 'ep2_end', scenes: [{ id: 'ep2_end', kind: 'terminal', text: 'Конец' }] };
  const onMenu = vi.fn();
  render(<StoryScreen episode={terminal} sceneId="ep2_end" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} onMenu={onMenu} />);
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  expect(screen.getByText('Эпизод 2 завершён')).toBeVisible();
  expect(screen.getByText('Эпизод 3 в разработке')).toBeVisible();
  expect(screen.queryByText('149 ₽')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'К сезону' }));
  expect(onMenu).toHaveBeenCalledTimes(1);
});

it('labels episode 2 chat without the episode 1 night time or photograph name', () => {
  const chatEpisode: Episode = { id: 'last-online-s1-e2', title: 'Two', startSceneId: 'ep2_chat', scenes: [{ id: 'ep2_chat', kind: 'message', text: 'Посмотри.', attachment: 'assets/last-online/episode-2/cg/cafe-photo.webp', nextSceneId: 'end' }] };
  render(<StoryScreen episode={chatEpisode} sceneId="ep2_chat" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
  expect(screen.getByText('Сегодня')).toBeVisible();
  expect(screen.queryByText('Сегодня · 23:46')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  expect(screen.getByRole('button', { name: 'Открыть cafe-photo.webp' })).toBeVisible();
});

it('preserves the original episode 1 attachment filename for its current artwork', () => {
  const chatEpisode: Episode = { id: 'last-online-s1-e1', title: 'One', startSceneId: 'ep1_photo', scenes: [{ id: 'ep1_photo', kind: 'message', text: 'Посмотри.', attachment: 'assets/last-online/v2/cg/old-photo.webp', nextSceneId: 'end' }] };
  render(<StoryScreen episode={chatEpisode} sceneId="ep1_photo" state={state} onChoose={vi.fn()} onAdvance={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Показать сообщения' }));
  expect(screen.getByRole('button', { name: 'Открыть IMG_0317_old.jpg' })).toBeVisible();
});


it('renders message scenes as a dedicated full-screen chat stage', () => {
  const chatEpisode: Episode = {
    id: 'chat-episode',
    title: 'Chat',
    startSceneId: 'ep1_soa_first_message',
    scenes: [{
      id: 'ep1_soa_first_message',
      kind: 'message',
      text: 'Ты живёшь напротив него?',
      nextSceneId: 'end',
    }, {
      id: 'end',
      kind: 'terminal',
      text: 'end',
    }],
  };

  const { container } = render(
    <StoryScreen
      episode={chatEpisode}
      sceneId="ep1_soa_first_message"
      state={state}
      onChoose={vi.fn()}
      onAdvance={vi.fn()}
    />,
  );

  expect(container.querySelector('.lumi-chat-stage')).toBeInTheDocument();
  expect(container.querySelector('.lumi-story')).not.toBeInTheDocument();
});

it('marks key scenes as cinematic and exposes motion variant', () => {
  const cinematicEpisode: Episode = {
    id: 'cinematic',
    title: 'Cinematic',
    startSceneId: 'ep1_noise_hall',
    scenes: [{
      id: 'ep1_noise_hall',
      kind: 'narrative',
      text: 'Джунхо увидел подвеску и остановился.',
      presentation: { mode: 'cinematic', motion: 'tension' },
      background: 'apartment_hall_night',
      character: 'junho-guarded',
      nextSceneId: 'end',
    }, {
      id: 'end',
      kind: 'terminal',
      text: 'end',
    }],
  };

  render(
    <StoryScreen
      episode={cinematicEpisode}
      sceneId="ep1_noise_hall"
      state={state}
      onChoose={vi.fn()}
      onAdvance={vi.fn()}
    />,
  );

  const stage = screen.getByTestId('story-stage');
  expect(stage).toHaveAttribute('data-presentation', 'cinematic');
  expect(stage).toHaveAttribute('data-motion', 'tension');
  expect(stage.querySelector('.lumi-story__backdrop')).toBeInTheDocument();
});
